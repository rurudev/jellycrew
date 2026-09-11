import { describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, userMeta } from "@/lib/db/schema";
import { call } from "@/lib/jellyfin/client";
import { JELLYFIN_DEFAULT_MANAGED_POLICY } from "@/lib/policy/defaults";
import { extractManagedFields } from "@/lib/policy/merge";
import { policyHash } from "@/lib/policy/hash";
import { ProtectionError } from "@/lib/policy/protection";
import type { Actor } from "@/lib/services/audit";
import { executeBulk, previewBulk } from "@/lib/services/bulk";
import { copyPolicyFromUser, saveUserPolicy } from "@/lib/services/policies";
import {
  adoptPolicyFromUser,
  applyProfileToUser,
  assignProfile,
  cloneProfile,
  createBlankProfile,
  createProfileFromUser,
  deleteProfile,
  listProfileMembers,
  listProfilesWithCounts,
  previewAdopt,
  saveProfilePolicy,
} from "@/lib/services/profiles";
import { UserActionError, renameUser, setUserEnabled, setUserPassword } from "@/lib/services/user-actions";
import { listUsers } from "@/lib/services/users";
import { createRawUser, deleteRawUser, rawClient, testServer, uniqueName } from "./helpers";

const admin = () => ({ type: "admin", id: testServer().admin.id, requestId: "req-policies" }) as Actor;
const otherAdminActor: Actor = { type: "admin", id: "someone-else", requestId: "req-policies" };

async function livePolicy(userId: string): Promise<Record<string, unknown>> {
  const u = await call("GetUserById", () => rawClient().GET("/Users/{userId}", { params: { path: { userId } } }));
  return (u.Policy ?? {}) as Record<string, unknown>;
}

async function setRawPolicy(userId: string, patch: Record<string, unknown>) {
  const live = await livePolicy(userId);
  await call("UpdateUserPolicy", () =>
    rawClient().POST("/Users/{userId}/Policy", { params: { path: { userId } }, body: { ...live, ...patch } as never }),
  );
}

function lastAudit(action: string) {
  return getDb().select().from(audit).where(eq(audit.action, action)).orderBy(desc(audit.id)).limit(1).get();
}

describe("profiles and policy application", () => {
  it("hardcoded defaults match a freshly created Jellyfin user", async () => {
    const u = await createRawUser(uniqueName("defaults"));
    try {
      const managed = extractManagedFields(await livePolicy(u.id));
      expect(managed).toEqual(JELLYFIN_DEFAULT_MANAGED_POLICY);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("applying a profile changes only profile-managed fields and preserves per-user fields", async () => {
    const u = await createRawUser(uniqueName("apply"));
    try {
      // Per-user fields with non-default values that must survive.
      await setRawPolicy(u.id, { IsHidden: true, EnableAllDevices: false, EnabledDevices: ["some-device"], LoginAttemptsBeforeLockout: 3, EnableMediaPlayback: true, RemoteClientBitrateLimit: 0 });
      const profile = createBlankProfile(admin(), { name: uniqueName("kids") });
      const edit = saveProfilePolicy(admin(), {
        profileId: profile.id,
        baseHash: policyHash(profile.policy),
        edit: { EnableMediaPlayback: false, RemoteClientBitrateLimit: 4_000_000, MaxParentalRating: 10, BlockedTags: ["horror"], IsAdministrator: true, IsHidden: false },
        confirm: true,
      });
      expect(edit.status).toBe("saved");
      const changes = await applyProfileToUser(admin(), u.id, profile.id);
      const keys = changes.map((c) => c.key).sort();
      expect(keys).toEqual(["BlockedTags", "EnableMediaPlayback", "MaxParentalRating", "RemoteClientBitrateLimit"]);
      const after = await livePolicy(u.id);
      expect(after.EnableMediaPlayback).toBe(false);
      expect(after.RemoteClientBitrateLimit).toBe(4_000_000);
      expect(after.MaxParentalRating).toBe(10);
      expect(after.BlockedTags).toEqual(["horror"]);
      // per-user fields untouched even though the edit tried to smuggle IsAdministrator/IsHidden into the profile
      expect(after.IsHidden).toBe(true);
      expect(after.IsAdministrator).toBe(false);
      expect(after.EnableAllDevices).toBe(false);
      expect(after.EnabledDevices).toEqual(["some-device"]);
      expect(after.LoginAttemptsBeforeLockout).toBe(3);
      // assignment recorded, no drift
      const meta = getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, u.id)).get();
      expect(meta?.profileId).toBe(profile.id);
      const row = (await listUsers()).find((r) => r.id === u.id)!;
      expect(row.profileName).toBe(profile.name);
      expect(row.drift).toBe(false);
      expect(lastAudit("profile.apply")?.targetUserId).toBe(u.id);
      // drift appears when Jellyfin changes underneath
      await setRawPolicy(u.id, { EnableMediaPlayback: true });
      const members = await listProfileMembers(profile.id);
      expect(members.find((m) => m.id === u.id)?.drift).toEqual([{ key: "EnableMediaPlayback", before: true, after: false }]);
      const summary = (await listProfilesWithCounts()).find((p) => p.id === profile.id)!;
      expect(summary.memberCount).toBe(1);
      expect(summary.driftCount).toBe(1);
      // applying again is idempotent for the untouched fields
      const again = await applyProfileToUser(admin(), u.id, profile.id);
      expect(again.map((c) => c.key)).toEqual(["EnableMediaPlayback"]);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("creates profiles from a user, clones them, adopts and deletes (unassigning members)", async () => {
    const u = await createRawUser(uniqueName("snap"));
    const v = await createRawUser(uniqueName("member"));
    try {
      await setRawPolicy(u.id, { EnableContentDownloading: false, MaxActiveSessions: 2, IsHidden: false });
      const fromUser = await createProfileFromUser(admin(), u.id, { name: uniqueName("snapshot") });
      expect(fromUser.policy.EnableContentDownloading).toBe(false);
      expect(fromUser.policy.MaxActiveSessions).toBe(2);
      expect(fromUser.policy).not.toHaveProperty("IsHidden");
      const clone = cloneProfile(admin(), fromUser.id, { name: uniqueName("clone") });
      expect(clone.policy).toEqual(fromUser.policy);
      expect(() => cloneProfile(admin(), fromUser.id, { name: clone.name })).toThrow(/already exists/);

      assignProfile(admin(), v.id, clone.id);
      await applyProfileToUser(admin(), u.id, clone.id);
      await setRawPolicy(u.id, { MaxActiveSessions: 5 });
      const preview = await previewAdopt(clone.id, u.id);
      expect(preview.changes).toEqual([{ key: "MaxActiveSessions", before: 2, after: 5 }]);
      expect(preview.otherMembers).toEqual([{ id: v.id, name: v.name, willDrift: true }]);
      await adoptPolicyFromUser(admin(), clone.id, u.id);
      expect((await listProfileMembers(clone.id)).find((m) => m.id === v.id)?.drift.map((c) => c.key)).toContain("MaxActiveSessions");

      const { unassigned } = deleteProfile(admin(), clone.id);
      expect(unassigned).toBe(2);
      expect(getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, v.id)).get()?.profileId).toBeNull();
      // nothing changed in Jellyfin
      expect((await livePolicy(u.id)).MaxActiveSessions).toBe(5);
    } finally {
      await deleteRawUser(u.id);
      await deleteRawUser(v.id);
    }
  });
});

describe("policy editor save", () => {
  it("previews, saves and refuses stale writes", async () => {
    const u = await createRawUser(uniqueName("editor"));
    try {
      const base = await livePolicy(u.id);
      const baseHash = policyHash(base);
      const preview = await saveUserPolicy(admin(), { userId: u.id, baseHash, base, edit: { EnableLiveTvAccess: false, IsHidden: false }, confirm: false });
      expect(preview.status).toBe("preview");
      if (preview.status === "preview") expect(preview.changes.map((c) => c.key).sort()).toEqual(["EnableLiveTvAccess", "IsHidden"]);
      expect((await livePolicy(u.id)).EnableLiveTvAccess).toBe(true);

      // Someone else changes the policy in the meantime.
      await setRawPolicy(u.id, { EnableRemoteAccess: false });
      const stale = await saveUserPolicy(admin(), { userId: u.id, baseHash, base, edit: { EnableLiveTvAccess: false }, confirm: true });
      expect(stale.status).toBe("stale");
      if (stale.status === "stale") {
        expect(stale.changedSince).toEqual([{ key: "EnableRemoteAccess", before: true, after: false }]);
        const saved = await saveUserPolicy(admin(), { userId: u.id, baseHash: stale.liveHash, base: stale.live, edit: { EnableLiveTvAccess: false }, confirm: true });
        expect(saved.status).toBe("saved");
      }
      const after = await livePolicy(u.id);
      expect(after.EnableLiveTvAccess).toBe(false);
      expect(after.EnableRemoteAccess).toBe(false);
      const row = lastAudit("user.policy.update");
      expect(row?.before).toEqual({ EnableLiveTvAccess: true });
      expect(row?.after).toEqual({ EnableLiveTvAccess: false });
      const noop = await saveUserPolicy(admin(), { userId: u.id, baseHash: policyHash(after), edit: { EnableLiveTvAccess: false }, confirm: true });
      expect(noop.status).toBe("no_changes");
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("copies managed fields from another user", async () => {
    const a = await createRawUser(uniqueName("copy_a"));
    const b = await createRawUser(uniqueName("copy_b"));
    try {
      await setRawPolicy(a.id, { EnableSyncTranscoding: false, IsHidden: false });
      const preview = await copyPolicyFromUser(admin(), b.id, a.id, false);
      expect(preview.map((c) => c.key)).toEqual(["EnableSyncTranscoding"]);
      await copyPolicyFromUser(admin(), b.id, a.id, true);
      const after = await livePolicy(b.id);
      expect(after.EnableSyncTranscoding).toBe(false);
      expect(after.IsHidden).toBe(true);
    } finally {
      await deleteRawUser(a.id);
      await deleteRawUser(b.id);
    }
  });
});

describe("safeguards", () => {
  it("the last enabled administrator cannot be disabled or demoted, nor can the actor act on themselves", async () => {
    const adminId = testServer().admin.id;
    await expect(setUserEnabled(otherAdminActor, adminId, false)).rejects.toBeInstanceOf(ProtectionError);
    await expect(setUserEnabled(admin(), adminId, false)).rejects.toThrow(/own account/);
    const base = await livePolicy(adminId);
    await expect(
      saveUserPolicy(otherAdminActor, { userId: adminId, baseHash: policyHash(base), edit: { IsAdministrator: false }, confirm: true }),
    ).rejects.toBeInstanceOf(ProtectionError);
    await expect(
      saveUserPolicy(otherAdminActor, { userId: adminId, baseHash: policyHash(base), edit: { IsDisabled: true }, confirm: true }),
    ).rejects.toBeInstanceOf(ProtectionError);
    expect((await livePolicy(adminId)).IsDisabled).toBe(false);
    expect((await livePolicy(adminId)).IsAdministrator).toBe(true);
  });

  it("an admin can be demoted and disabled once another enabled admin exists, and bulk disable skips admins", async () => {
    const second = await createRawUser(uniqueName("admin2"));
    const plain = await createRawUser(uniqueName("plain"));
    try {
      await setRawPolicy(second.id, { IsAdministrator: true });
      const firstAdmin = testServer().admin.id;
      const asSecond: Actor = { type: "admin", id: second.id };
      // Jellyfin refuses to disable an administrator outright; the app says so.
      await expect(setUserEnabled(asSecond, firstAdmin, false)).rejects.toThrow(/Remove administrator rights first/);
      // Demoting the original admin is allowed now that a second enabled admin exists.
      const base = await livePolicy(firstAdmin);
      const demoted = await saveUserPolicy(asSecond, { userId: firstAdmin, baseHash: policyHash(base), edit: { IsAdministrator: false }, confirm: true });
      expect(demoted.status).toBe("saved");
      await setUserEnabled(asSecond, firstAdmin, false);
      expect((await livePolicy(firstAdmin)).IsDisabled).toBe(true);
      expect(lastAudit("user.disable")?.targetUserId).toBe(firstAdmin);
      expect(getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, firstAdmin)).get()?.disabledReason).toBe("manual");
      // Now the second admin is the last enabled one: nobody may demote or disable them.
      const secondBase = await livePolicy(second.id);
      await expect(
        saveUserPolicy(admin(), { userId: second.id, baseHash: policyHash(secondBase), edit: { IsAdministrator: false }, confirm: true }),
      ).rejects.toBeInstanceOf(ProtectionError);
      await expect(setUserEnabled(admin(), second.id, false)).rejects.toBeInstanceOf(ProtectionError);
      // Restore the original admin.
      await setUserEnabled(asSecond, firstAdmin, true);
      expect((await livePolicy(firstAdmin)).IsDisabled).toBe(false);
      expect(getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, firstAdmin)).get()?.disabledReason).toBeNull();
      await setRawPolicy(firstAdmin, { IsAdministrator: true });

      const preview = await previewBulk(admin(), "disable", [second.id, plain.id, firstAdmin, "ghost"], {});
      expect(preview.find((p) => p.userId === second.id)?.skip).toMatch(/Administrators are excluded/);
      expect(preview.find((p) => p.userId === firstAdmin)?.skip).toBeTruthy();
      expect(preview.find((p) => p.userId === "ghost")?.skip).toMatch(/no longer exists/);
      expect(preview.find((p) => p.userId === plain.id)?.changes).toEqual([{ key: "IsDisabled", before: false, after: true }]);
      const results = await executeBulk(admin(), "disable", [second.id, plain.id, "ghost"], {});
      expect(results.find((r) => r.userId === plain.id)).toMatchObject({ ok: true, message: "Disabled" });
      expect(results.find((r) => r.userId === second.id)?.message).toMatch(/Skipped/);
      expect((await livePolicy(second.id)).IsDisabled).toBe(false);
      expect((await livePolicy(plain.id)).IsDisabled).toBe(true);
      expect(lastAudit("bulk.disable")?.detail).toMatchObject({ requested: 3, succeeded: 1, skipped: 2, failed: 0 });
    } finally {
      await setRawPolicy(testServer().admin.id, { IsAdministrator: true, IsDisabled: false });
      await setRawPolicy(second.id, { IsAdministrator: false });
      await deleteRawUser(second.id);
      await deleteRawUser(plain.id);
    }
  });

  it("bulk apply reports per-user results including failures", async () => {
    const a = await createRawUser(uniqueName("bulk_a"));
    const b = await createRawUser(uniqueName("bulk_b"));
    try {
      const profile = createBlankProfile(admin(), { name: uniqueName("bulk") });
      saveProfilePolicy(admin(), { profileId: profile.id, baseHash: policyHash(profile.policy), edit: { EnableContentDownloading: false }, confirm: true });
      await deleteRawUser(b.id);
      const results = await executeBulk(admin(), "apply_profile", [a.id, b.id], { profileId: profile.id });
      expect(results).toHaveLength(2);
      expect(results.find((r) => r.userId === a.id)).toMatchObject({ ok: true });
      expect(results.find((r) => r.userId === b.id)?.message).toMatch(/Skipped: User no longer exists/);
      expect((await livePolicy(a.id)).EnableContentDownloading).toBe(false);
    } finally {
      await deleteRawUser(a.id);
    }
  });
});

describe("user actions", () => {
  it("renames with clash detection and sets passwords with a minimum length", async () => {
    const u = await createRawUser(uniqueName("rename"));
    try {
      await expect(renameUser(admin(), u.id, testServer().admin.name)).rejects.toBeInstanceOf(UserActionError);
      const newName = uniqueName("renamed");
      await renameUser(admin(), u.id, newName);
      const dto = await call("GetUserById", () => rawClient().GET("/Users/{userId}", { params: { path: { userId: u.id } } }));
      expect(dto.Name).toBe(newName);
      expect(lastAudit("user.rename")?.after).toEqual({ Name: newName });

      await expect(setUserPassword(admin(), u.id, "short")).rejects.toThrow(/at least 8/);
      await setUserPassword(admin(), u.id, "a-much-longer-password");
      const auth = await rawClient().POST("/Users/AuthenticateByName", { body: { Username: newName, Pw: "a-much-longer-password" } });
      expect(auth.response.status).toBe(200);
      expect(lastAudit("user.password.set")?.targetUserId).toBe(u.id);
    } finally {
      await deleteRawUser(u.id);
    }
  });
});
