import { describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, userMeta } from "@/lib/db/schema";
import { call, createJellyfinClient } from "@/lib/jellyfin/client";
import type { Actor } from "@/lib/services/audit";
import { DeviceNotFoundError, listDevices, revokeDevice } from "@/lib/services/devices";
import { getReferenceData } from "@/lib/services/reference";
import { SessionNotFoundError, invalidateSessionCache, listSessions, sendSessionMessage, stopPlayback } from "@/lib/services/sessions";
import { getUserDetail, listUsers } from "@/lib/services/users";
import { POLICY_FIELDS } from "@/lib/policy/fields";
import { createRawUser, deleteRawUser, rawClient, testServer, uniqueName } from "./helpers";

const actor: Actor = { type: "admin", id: "test-admin", requestId: "req-users" };

/** Signs a user in from a fake client so Jellyfin registers a session and a device. */
async function openSession(name: string, password: string, deviceId: string) {
  const client = createJellyfinClient({ baseUrl: testServer().url, deviceId, device: "Living room TV", client: "Jellyfin Android TV", version: "0.18.0" });
  const auth = await call("AuthenticateUserByName", () => client.POST("/Users/AuthenticateByName", { body: { Username: name, Pw: password } }));
  invalidateSessionCache();
  return { token: auth.AccessToken!, sessionId: auth.SessionInfo?.Id ?? null, client };
}

function lastAudit(action: string) {
  return getDb().select().from(audit).where(eq(audit.action, action)).orderBy(desc(audit.id)).limit(1).get();
}

describe("users read path", () => {
  it("lists users with lazily created meta rows, admin flag and status", async () => {
    const a = await createRawUser(uniqueName("list_a"));
    const b = await createRawUser(uniqueName("list_b"));
    try {
      // Disable b directly in Jellyfin so the status reflects live policy.
      const bUser = await call("GetUserById", () => rawClient().GET("/Users/{userId}", { params: { path: { userId: b.id } } }));
      await call("UpdateUserPolicy", () =>
        rawClient().POST("/Users/{userId}/Policy", { params: { path: { userId: b.id } }, body: { ...bUser.Policy!, IsDisabled: true } }),
      );
      const rows = await listUsers();
      const rowA = rows.find((r) => r.id === a.id)!;
      const rowB = rows.find((r) => r.id === b.id)!;
      const admin = rows.find((r) => r.id === testServer().admin.id)!;
      expect(rowA.status.kind).toBe("enabled");
      expect(rowB.status.kind).toBe("disabled");
      expect(rowB.isDisabled).toBe(true);
      expect(admin.isAdmin).toBe(true);
      expect(rowA.labels).toEqual([]);
      expect(rowA.activityBasis).toEqual(rowA.meta.firstSeenAt);
      const meta = getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, a.id)).get();
      expect(meta?.firstSeenAt).toBeInstanceOf(Date);
      // Listing again must not duplicate or reset anything.
      const again = await listUsers();
      expect(again.find((r) => r.id === a.id)!.meta.firstSeenAt).toEqual(meta!.firstSeenAt);
    } finally {
      await deleteRawUser(a.id);
      await deleteRawUser(b.id);
    }
  });

  it("returns detail with the full policy, sessions and devices", async () => {
    const u = await createRawUser(uniqueName("detail"));
    const deviceId = `${u.name}-tv`;
    try {
      await openSession(u.name, u.password, deviceId);
      const detail = await getUserDetail(u.id);
      expect(detail).not.toBeNull();
      expect(detail!.row.name).toBe(u.name);
      for (const f of POLICY_FIELDS) {
        if (f.key === "MaxParentalRating" || f.key === "MaxParentalSubRating") continue; // omitted when null
        expect(detail!.policy, `policy has ${f.key}`).toHaveProperty(f.key);
      }
      expect(detail!.sessions.some((s) => s.deviceId === deviceId)).toBe(true);
      expect(detail!.devices.some((d) => d.id === deviceId)).toBe(true);
      expect(detail!.row.activeSessions).toBeGreaterThanOrEqual(1);
      expect(detail!.row.deviceCount).toBeGreaterThanOrEqual(1);
      const ref = await getReferenceData();
      expect(ref.ratings.length).toBeGreaterThan(0);
      expect(ref.deviceById.has(deviceId)).toBe(true);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("returns null for unknown users", async () => {
    expect(await getUserDetail("00000000000000000000000000000001")).toBeNull();
  });

  it("stops a session and audits it", async () => {
    const u = await createRawUser(uniqueName("stop"));
    const deviceId = `${u.name}-phone`;
    try {
      await openSession(u.name, u.password, deviceId);
      const session = (await listSessions({ fresh: true })).find((s) => s.deviceId === deviceId);
      expect(session).toBeDefined();
      expect(session!.userId).toBe(u.id);
      await stopPlayback(actor, session!.id);
      const row = lastAudit("session.stop");
      expect(row?.targetUserId).toBe(u.id);
      expect(row?.actorId).toBe("test-admin");
      expect(row?.requestId).toBe("req-users");
      expect(row?.detail).toMatchObject({ sessionId: session!.id });
      await expect(stopPlayback(actor, "does-not-exist")).rejects.toBeInstanceOf(SessionNotFoundError);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("sends a message to a session and audits it", async () => {
    const u = await createRawUser(uniqueName("msg"));
    const deviceId = `${u.name}-tablet`;
    try {
      await openSession(u.name, u.password, deviceId);
      const session = (await listSessions({ fresh: true })).find((s) => s.deviceId === deviceId)!;
      await sendSessionMessage(actor, session.id, { text: "Dinner is ready", header: "Hi" });
      const row = lastAudit("session.message");
      expect(row?.targetUserId).toBe(u.id);
      expect(row?.detail).toMatchObject({ text: "Dinner is ready", header: "Hi" });
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("revokes a device, invalidating its token, and audits it", async () => {
    const u = await createRawUser(uniqueName("revoke"));
    const deviceId = `${u.name}-laptop`;
    try {
      const { client } = await openSession(u.name, u.password, deviceId);
      expect((await listDevices(u.id)).some((d) => d.id === deviceId)).toBe(true);
      await revokeDevice(actor, deviceId);
      expect((await listDevices()).some((d) => d.id === deviceId)).toBe(false);
      const res = await client.GET("/Users/Me");
      expect(res.response.status).toBe(401);
      const row = lastAudit("device.revoke");
      expect(row?.targetUserId).toBe(u.id);
      expect(row?.detail).toMatchObject({ deviceId });
      await expect(revokeDevice(actor, "no-such-device")).rejects.toBeInstanceOf(DeviceNotFoundError);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("caches the session list for 10 seconds and never includes the app's own device", async () => {
    const first = await listSessions({ fresh: true });
    const second = await listSessions();
    expect(second).toBe(first);
    const { ensureDeviceId } = await import("@/lib/settings");
    expect(first.some((s) => s.deviceId === ensureDeviceId())).toBe(false);
  });
});
