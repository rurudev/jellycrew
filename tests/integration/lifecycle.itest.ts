import { describe, expect, it } from "vitest";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, userMeta } from "@/lib/db/schema";
import { call } from "@/lib/jellyfin/client";
import { ProtectionError } from "@/lib/policy/protection";
import type { Actor } from "@/lib/services/audit";
import { executeBulk, previewBulk } from "@/lib/services/bulk";
import { cancelDeletion, collectLifecycleInputs, deleteUserNow, extendExpiry, runLifecycle, scheduleDeletion, updateUserMeta } from "@/lib/services/lifecycle";
import { createBlankProfile, assignProfile } from "@/lib/services/profiles";
import { getJobStatus, runJob, runLifecycleJob } from "@/lib/services/scheduler";
import { setSetting } from "@/lib/settings";
import { createRawUser, deleteRawUser, rawClient, testServer, uniqueName } from "./helpers";

const admin = () => ({ type: "admin", id: testServer().admin.id, requestId: "req-lifecycle" }) as Actor;
const day = 86_400_000;

async function livePolicy(userId: string) {
  const u = await call("GetUserById", () => rawClient().GET("/Users/{userId}", { params: { path: { userId } } }));
  return (u.Policy ?? {}) as Record<string, unknown>;
}
async function exists(userId: string) {
  const r = await rawClient().GET("/Users/{userId}", { params: { path: { userId } } });
  return r.response.ok;
}
function meta(userId: string) {
  return getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, userId)).get();
}
function auditSince(id: number) {
  return getDb().select().from(audit).where(gte(audit.id, id)).orderBy(audit.id).all();
}
function lastAuditId() {
  return getDb().select({ id: audit.id }).from(audit).orderBy(desc(audit.id)).limit(1).get()?.id ?? 0;
}

describe("lifecycle metadata", () => {
  it("edits email, notes, labels, expiry and inactivity with audit", async () => {
    const u = await createRawUser(uniqueName("meta"));
    try {
      const now = new Date();
      updateUserMeta(admin(), u.id, { email: "  Person@Example.com ", notes: "vip", labels: ["b", "a", "a", " "], expiresAt: new Date(now.getTime() + 3 * day), inactivityDisableDays: 45 });
      const m = meta(u.id)!;
      expect(m.email).toBe("person@example.com");
      expect(m.notes).toBe("vip");
      expect(m.labels).toEqual(["a", "b"]);
      expect(m.inactivityDisableDays).toBe(45);
      const row = getDb().select().from(audit).where(eq(audit.action, "user.meta.update")).orderBy(desc(audit.id)).limit(1).get();
      expect(row?.targetUserId).toBe(u.id);
      expect(row?.after).toMatchObject({ email: "person@example.com", labels: ["a", "b"] });
      // extending from a future expiry adds to it; from a past one, from now
      extendExpiry(admin(), u.id, 7, now);
      expect(meta(u.id)!.expiresAt!.getTime()).toBe(now.getTime() + 10 * day);
      updateUserMeta(admin(), u.id, { expiresAt: new Date(now.getTime() - 5 * day) });
      extendExpiry(admin(), u.id, 7, now);
      expect(meta(u.id)!.expiresAt!.getTime()).toBe(now.getTime() + 7 * day);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("schedules deletion (disable now, delete after grace), cancels it, and deletes immediately", async () => {
    const u = await createRawUser(uniqueName("del"));
    const v = await createRawUser(uniqueName("delnow"));
    setSetting("graceDays", 3);
    try {
      const now = new Date();
      const m = await scheduleDeletion(admin(), u.id, { now });
      expect(m.deleteAfter!.getTime()).toBe(now.getTime() + 3 * day);
      expect((await livePolicy(u.id)).IsDisabled).toBe(true);
      await expect(scheduleDeletion(admin(), u.id)).rejects.toThrow(/already scheduled/);
      await cancelDeletion(admin(), u.id);
      expect(meta(u.id)!.deleteAfter).toBeNull();
      expect((await livePolicy(u.id)).IsDisabled).toBe(false);
      await expect(cancelDeletion(admin(), u.id)).rejects.toThrow(/No deletion/);
      // admins and self are protected
      await expect(scheduleDeletion(admin(), testServer().admin.id)).rejects.toBeInstanceOf(ProtectionError);
      await expect(deleteUserNow(admin(), testServer().admin.id)).rejects.toBeInstanceOf(ProtectionError);
      // immediate delete
      await deleteUserNow(admin(), v.id);
      expect(await exists(v.id)).toBe(false);
      expect(meta(v.id)).toBeUndefined();
      const row = getDb().select().from(audit).where(eq(audit.action, "user.delete")).orderBy(desc(audit.id)).limit(1).get();
      expect(row?.targetUserId).toBe(v.id);
      expect(row?.before).toMatchObject({ name: v.name });
    } finally {
      setSetting("graceDays", 14);
      await deleteRawUser(u.id);
    }
  });
});

describe("scheduler", () => {
  it("disables expired and inactive users, deletes after grace, never touches admins, audits everything as system", async () => {
    const expired = await createRawUser(uniqueName("expired"));
    const inactive = await createRawUser(uniqueName("inactive"));
    const fresh = await createRawUser(uniqueName("fresh"));
    const doomed = await createRawUser(uniqueName("doomed"));
    const adminId = testServer().admin.id;
    const now = new Date();
    try {
      // admin with everything overdue must stay untouched
      updateUserMeta(admin(), adminId, { expiresAt: new Date(now.getTime() - day), inactivityDisableDays: 1 });
      getDb().update(userMeta).set({ firstSeenAt: new Date(now.getTime() - 400 * day) }).where(eq(userMeta.jellyfinUserId, adminId)).run();
      updateUserMeta(admin(), expired.id, { expiresAt: new Date(now.getTime() - 60_000) });
      // inactivity through the profile rule; activity basis falls back to first_seen_at
      const profile = createBlankProfile(admin(), { name: uniqueName("idle"), inactivityDisableDays: 30 });
      assignProfile(admin(), inactive.id, profile.id);
      getDb().update(userMeta).set({ firstSeenAt: new Date(now.getTime() - 31 * day) }).where(eq(userMeta.jellyfinUserId, inactive.id)).run();
      assignProfile(admin(), fresh.id, profile.id); // fresh: first seen now, must not be disabled
      await scheduleDeletion(admin(), doomed.id, { graceDays: 1, now: new Date(now.getTime() - 2 * day) });

      const inputs = await collectLifecycleInputs();
      expect(inputs.find((i) => i.userId === inactive.id)?.inactivityDisableDays).toBe(30);
      expect(inputs.find((i) => i.userId === fresh.id)?.inactivityDisableDays).toBe(30);

      const auditStart = lastAuditId() + 1;
      const result = await runLifecycle(now);
      expect(result.disabled).toEqual(
        expect.arrayContaining([
          { userId: expired.id, name: expired.name, reason: "expired" },
          { userId: inactive.id, name: inactive.name, reason: "inactive" },
        ]),
      );
      expect(result.disabled).toHaveLength(2);
      expect(result.deleted).toEqual([{ userId: doomed.id, name: doomed.name }]);
      expect(result.errors).toEqual([]);
      expect(result.skippedAdmins).toBeGreaterThanOrEqual(1);

      expect((await livePolicy(expired.id)).IsDisabled).toBe(true);
      expect(meta(expired.id)?.disabledReason).toBe("expired");
      expect((await livePolicy(inactive.id)).IsDisabled).toBe(true);
      expect(meta(inactive.id)?.disabledReason).toBe("inactive");
      expect((await livePolicy(fresh.id)).IsDisabled).toBe(false);
      expect((await livePolicy(adminId)).IsDisabled).toBe(false);
      expect(await exists(doomed.id)).toBe(false);
      expect(meta(doomed.id)).toBeUndefined();

      const rows = auditSince(auditStart);
      expect(rows.every((r) => r.actorType === "system" && r.actorId === null)).toBe(true);
      expect(rows.map((r) => [r.action, r.targetUserId])).toEqual(
        expect.arrayContaining([
          ["user.disable", expired.id],
          ["user.disable", inactive.id],
          ["user.delete", doomed.id],
        ]),
      );
      expect(rows.some((r) => r.targetUserId === adminId)).toBe(false);
      expect(rows.some((r) => r.targetUserId === fresh.id)).toBe(false);

      // a second run is a no-op
      const again = await runLifecycle(now);
      expect(again.disabled).toEqual([]);
      expect(again.deleted).toEqual([]);
    } finally {
      updateUserMeta(admin(), adminId, { expiresAt: null, inactivityDisableDays: null });
      for (const u of [expired, inactive, fresh]) await deleteRawUser(u.id);
    }
  });

  it("takes a DB lock so concurrent runs do not overlap, and records the last result", async () => {
    let running = 0;
    let maxConcurrent = 0;
    const job = async () => {
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((r) => setTimeout(r, 150));
      running -= 1;
      return { done: true };
    };
    const [a, b] = await Promise.all([runJob("test-job", job), runJob("test-job", job)]);
    expect([a, b].filter((x) => x === null)).toHaveLength(1);
    expect(maxConcurrent).toBe(1);
    const status = getJobStatus("test-job");
    expect(status?.lockUntil).toBeNull();
    expect(status?.lastResult).toMatchObject({ ok: true, done: true });
    await expect(runJob("test-job", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(getJobStatus("test-job")?.lastResult).toMatchObject({ ok: false, error: "boom" });
    const lifecycle = await runLifecycleJob();
    expect(lifecycle).not.toBeNull();
    expect(getJobStatus("lifecycle")?.lastFinishedAt).toBeInstanceOf(Date);
  });
});

describe("bulk lifecycle actions", () => {
  it("previews and executes expiry, labels and deletion scheduling with admins excluded", async () => {
    const a = await createRawUser(uniqueName("bulk_l1"));
    const b = await createRawUser(uniqueName("bulk_l2"));
    const adminId = testServer().admin.id;
    try {
      const date = new Date(Date.now() + 30 * day).toISOString();
      const preview = await previewBulk(admin(), "set_expiry", [a.id, adminId], { date });
      expect(preview.find((p) => p.userId === adminId)?.skip).toMatch(/Administrators/);
      let results = await executeBulk(admin(), "set_expiry", [a.id, b.id], { date });
      expect(results.every((r) => r.ok)).toBe(true);
      expect(meta(a.id)!.expiresAt!.toISOString()).toBe(date);
      results = await executeBulk(admin(), "extend_expiry", [a.id], { days: 5 });
      expect(meta(a.id)!.expiresAt!.getTime()).toBe(new Date(date).getTime() + 5 * day);
      results = await executeBulk(admin(), "add_label", [a.id, b.id], { label: "trial" });
      expect(meta(b.id)!.labels).toEqual(["trial"]);
      results = await executeBulk(admin(), "remove_label", [a.id, adminId], { label: "trial" });
      expect(results.find((r) => r.userId === adminId)?.message).toMatch(/Skipped/);
      expect(meta(a.id)!.labels).toEqual([]);
      results = await executeBulk(admin(), "clear_expiry", [a.id, b.id], {});
      expect(meta(a.id)!.expiresAt).toBeNull();
      results = await executeBulk(admin(), "schedule_deletion", [a.id, adminId], {});
      expect(results.find((r) => r.userId === adminId)?.message).toMatch(/Skipped: Administrators/);
      expect(meta(a.id)!.deleteAfter).toBeInstanceOf(Date);
      expect((await livePolicy(a.id)).IsDisabled).toBe(true);
      results = await executeBulk(admin(), "cancel_deletion", [a.id, b.id], {});
      expect(results.find((r) => r.userId === b.id)?.message).toMatch(/Skipped: No deletion/);
      expect(meta(a.id)!.deleteAfter).toBeNull();
      expect((await livePolicy(a.id)).IsDisabled).toBe(false);
      const summary = getDb().select().from(audit).where(and(eq(audit.action, "bulk.cancel_deletion"))).orderBy(desc(audit.id)).limit(1).get();
      expect(summary?.detail).toMatchObject({ requested: 2, succeeded: 1, skipped: 1 });
    } finally {
      await deleteRawUser(a.id);
      await deleteRawUser(b.id);
    }
  });
});
