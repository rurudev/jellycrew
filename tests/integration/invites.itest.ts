import { beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, invite as inviteTable, inviteUse, profile as profileTable, userMeta } from "@/lib/db/schema";
import { call } from "@/lib/jellyfin/client";
import { policyHash } from "@/lib/policy/hash";
import { rateLimiter } from "@/lib/ratelimit";
import type { Actor } from "@/lib/services/audit";
import { InviteError, createInvite, inviteLink, listInvites, redeemInvite, revokeInvite } from "@/lib/services/invites";
import { createBlankProfile, saveProfilePolicy } from "@/lib/services/profiles";
import { GET as inviteInfo, POST as inviteSignup } from "@/app/api/public/invite/[token]/route";
import { createRawUser, deleteRawUser, rawClient, testServer, uniqueName } from "./helpers";

const admin = () => ({ type: "admin", id: testServer().admin.id, requestId: "req-invites" }) as Actor;
const day = 86_400_000;

async function findUser(name: string) {
  const users = await call("GetUsers", () => rawClient().GET("/Users"));
  return users.find((u) => u.Name === name) ?? null;
}
async function cleanup(name: string) {
  const u = await findUser(name);
  if (u?.Id) await deleteRawUser(u.Id);
}
function post(token: string, body: unknown, ip = "203.0.113.5") {
  return inviteSignup(
    new Request(`http://localhost:3000/api/public/invite/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "http://localhost:3000", "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token }) },
  );
}

beforeEach(() => rateLimiter.reset());

describe("invites", () => {
  it("creates an account, applies the profile, sets expiry from the invite and audits as invite", async () => {
    const profile = createBlankProfile(admin(), { name: uniqueName("guest"), defaultExpiryDays: 90 });
    saveProfilePolicy(admin(), { profileId: profile.id, baseHash: policyHash(profile.policy), edit: { EnableContentDownloading: false, MaxActiveSessions: 2 }, confirm: true });
    const { invite, token, url } = await createInvite(admin(), { label: "Friends", profileId: profile.id, maxUses: 3, accountExpiryDays: 30, requireEmail: true, noteForInvitee: "Welcome!" });
    expect(url).toBe(`http://localhost:3000/invite/${token}`);
    expect(await inviteLink(invite)).toBe(url);
    expect(getDb().select().from(inviteTable).where(eq(inviteTable.id, invite.id)).get()?.tokenHash).not.toContain(token);

    const info = await inviteInfo(new Request(`http://localhost:3000/api/public/invite/${token}`), { params: Promise.resolve({ token }) });
    expect(info.status).toBe(200);
    expect(await info.json()).toMatchObject({ status: "active", note: "Welcome!", requireEmail: true, profileName: profile.name, accountExpiryDays: 30, serverName: "jellycrew-test" });

    const name = uniqueName("invitee");
    try {
      const now = new Date();
      const res = await post(token, { username: name, password: "welcome-pass-1", passwordConfirm: "welcome-pass-1", email: "Invitee@Example.com" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, userName: name, serverUrl: testServer().url });
      const user = await findUser(name);
      expect(user).not.toBeNull();
      expect(user!.Policy?.EnableContentDownloading).toBe(false);
      expect(user!.Policy?.MaxActiveSessions).toBe(2);
      expect(user!.Policy?.IsAdministrator).toBe(false);
      const meta = getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, user!.Id!)).get()!;
      expect(meta.profileId).toBe(profile.id);
      expect(meta.email).toBe("invitee@example.com");
      expect(meta.emailVerifiedAt).toBeNull();
      expect(meta.createdViaInviteId).toBe(invite.id);
      expect(Math.abs(meta.expiresAt!.getTime() - (now.getTime() + 30 * day))).toBeLessThan(10_000);
      const use = getDb().select().from(inviteUse).where(eq(inviteUse.inviteId, invite.id)).get()!;
      expect(use.jellyfinUserId).toBe(user!.Id);
      expect(use.ip).toBe("203.0.113.5");
      expect(use.userAgent).toBe("vitest");
      const row = getDb().select().from(audit).where(eq(audit.action, "invite.signup")).orderBy(desc(audit.id)).limit(1).get()!;
      expect(row.actorType).toBe("invite");
      expect(row.actorId).toBe(invite.id);
      expect(row.targetUserId).toBe(user!.Id);
      const listed = (await listInvites()).find((i) => i.id === invite.id)!;
      expect(listed.uses).toBe(1);
      expect(listed.status).toBe("active");
      expect(listed.usedBy[0]?.userName).toBe(name);
      // the new user can sign in with the chosen password
      const auth = await rawClient().POST("/Users/AuthenticateByName", { body: { Username: name, Pw: "welcome-pass-1" } });
      expect(auth.response.status).toBe(200);
    } finally {
      await cleanup(name);
    }
  });

  it("falls back to the profile's default expiry and to Jellyfin defaults without a profile", async () => {
    const profile = createBlankProfile(admin(), { name: uniqueName("trial"), defaultExpiryDays: 14 });
    const withProfile = await createInvite(admin(), { profileId: profile.id });
    const plain = await createInvite(admin(), {});
    const a = uniqueName("fallback_a");
    const b = uniqueName("fallback_b");
    try {
      const now = new Date();
      const ra = await redeemInvite({ token: withProfile.token, username: a, password: "password-123" }, now);
      expect(ra.expiresAt!.getTime()).toBe(now.getTime() + 14 * day);
      const rb = await redeemInvite({ token: plain.token, username: b, password: "password-123" }, now);
      expect(rb.expiresAt).toBeNull();
      expect(getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, rb.userId)).get()?.profileId).toBeNull();
    } finally {
      await cleanup(a);
      await cleanup(b);
    }
  });

  it("enforces max uses, expiry and revocation", async () => {
    const one = await createInvite(admin(), { maxUses: 1 });
    const first = uniqueName("max_first");
    const second = uniqueName("max_second");
    try {
      await redeemInvite({ token: one.token, username: first, password: "password-123" });
      await expect(redeemInvite({ token: one.token, username: second, password: "password-123" })).rejects.toMatchObject({ code: "exhausted" });
      expect(await findUser(second)).toBeNull();
      expect((await listInvites()).find((i) => i.id === one.invite.id)?.status).toBe("exhausted");
      const res = await post(one.token, { username: second, password: "password-123" });
      expect(res.status).toBe(410);
    } finally {
      await cleanup(first);
    }

    const expired = await createInvite(admin(), { linkExpiryDays: 1 }, new Date(Date.now() - 2 * day));
    await expect(redeemInvite({ token: expired.token, username: uniqueName("late"), password: "password-123" })).rejects.toMatchObject({ code: "expired" });
    expect((await listInvites()).find((i) => i.id === expired.invite.id)?.status).toBe("expired");
    const expiredInfo = await inviteInfo(new Request(`http://localhost:3000/api/public/invite/${expired.token}`), { params: Promise.resolve({ token: expired.token }) });
    expect((await expiredInfo.json()).status).toBe("expired");

    const revocable = await createInvite(admin(), {});
    revokeInvite(admin(), revocable.invite.id);
    await expect(redeemInvite({ token: revocable.token, username: uniqueName("revoked"), password: "password-123" })).rejects.toMatchObject({ code: "revoked" });
    expect(getDb().select().from(audit).where(eq(audit.action, "invite.revoke")).orderBy(desc(audit.id)).limit(1).get()?.detail).toBeTruthy();

    expect(await redeemInvite({ token: "not-a-real-token-at-all", username: "x", password: "password-123" }).catch((e) => e)).toMatchObject({ code: "invalid" });
    const bad = await post("../../etc", { username: "x", password: "password-123" });
    expect(bad.status).toBe(404);
  });

  it("surfaces username conflicts, Jellyfin name errors, password and email rules", async () => {
    const inv = await createInvite(admin(), { requireEmail: true });
    const taken = await createRawUser(uniqueName("taken"));
    try {
      await expect(redeemInvite({ token: inv.token, username: taken.name.toUpperCase(), password: "password-123", email: "a@b.co" })).rejects.toMatchObject({ code: "username_taken" });
      await expect(redeemInvite({ token: inv.token, username: "bad<name>", password: "password-123", email: "a@b.co" })).rejects.toMatchObject({ code: "username_rejected" });
      await expect(redeemInvite({ token: inv.token, username: uniqueName("short"), password: "short", email: "a@b.co" })).rejects.toMatchObject({ code: "password" });
      await expect(redeemInvite({ token: inv.token, username: uniqueName("noemail"), password: "password-123" })).rejects.toMatchObject({ code: "email_required" });
      const res = await post(inv.token, { username: uniqueName("mismatch"), password: "password-123", passwordConfirm: "password-124", email: "a@b.co" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/do not match/);
      // nothing was created or counted
      expect(getDb().select().from(inviteTable).where(eq(inviteTable.id, inv.invite.id)).get()?.uses).toBe(0);
    } finally {
      await deleteRawUser(taken.id);
    }
  });

  it("rolls back the account when applying the profile fails", async () => {
    // A profile with a value Jellyfin rejects (EnabledFolders must be an array of GUIDs).
    const profile = createBlankProfile(admin(), { name: uniqueName("broken") });
    getDb().update(profileTable).set({ policy: { ...profile.policy, EnabledFolders: "not-an-array" } }).where(eq(profileTable.id, profile.id)).run();
    const inv = await createInvite(admin(), { profileId: profile.id });
    const name = uniqueName("rollback");
    try {
      const err = await redeemInvite({ token: inv.token, username: name, password: "password-123" }).catch((e) => e);
      expect(err).toBeInstanceOf(InviteError);
      expect(err.code).toBe("profile_failed");
      expect(err.message).toMatch(/removed again/);
      expect(await findUser(name)).toBeNull();
      expect(getDb().select().from(inviteTable).where(eq(inviteTable.id, inv.invite.id)).get()?.uses).toBe(0);
      const rows = getDb().select().from(audit).orderBy(desc(audit.id)).limit(3).all();
      expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["user.delete", "invite.signup_failed"]));
      expect(rows.find((r) => r.action === "user.delete")?.actorType).toBe("invite");
      expect(getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, rows.find((r) => r.action === "user.delete")!.targetUserId!)).get()).toBeUndefined();
      const res = await post(inv.token, { username: name, password: "password-123" });
      expect(res.status).toBe(502);
    } finally {
      await cleanup(name);
    }
  });

  it("rate limits per IP with 429 and Retry-After, and refuses cross-site posts", async () => {
    const inv = await createInvite(admin(), {});
    let last: Response | undefined;
    for (let i = 0; i < 25; i++) last = await post(inv.token, { username: "", password: "" }, "198.51.100.7");
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await last!.json()).error).toMatch(/Too many/);
    // a different IP is unaffected
    const other = await post(inv.token, { username: "", password: "" }, "198.51.100.8");
    expect(other.status).toBe(400);
    const cross = await inviteSignup(
      new Request(`http://localhost:3000/api/public/invite/${inv.token}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" }),
      { params: Promise.resolve({ token: inv.token }) },
    );
    expect(cross.status).toBe(403);
  });
});
