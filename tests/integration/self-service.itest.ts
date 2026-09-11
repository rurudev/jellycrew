import { beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, token as tokenTable, userMeta } from "@/lib/db/schema";
import { call, createJellyfinClient } from "@/lib/jellyfin/client";
import { rateLimiter } from "@/lib/ratelimit";
import type { Actor } from "@/lib/services/audit";
import { executeBulk } from "@/lib/services/bulk";
import { updateUserMeta } from "@/lib/services/lifecycle";
import { RESET_GENERIC_MESSAGE, ResetError, adminCreateResetLink, adminEmailResetLink, consumePasswordReset, requestPasswordReset, resetTokenStatus } from "@/lib/services/reset";
import { SelfServiceError, changeOwnPassword, getSelfOverview, loginSelf, revokeOwnDevice, setOwnEmail, verifyEmailToken } from "@/lib/services/self";
import { RESET_TOKEN_TTL_MS, issueToken } from "@/lib/services/tokens";
import { setUserEnabled } from "@/lib/services/user-actions";
import { POST as loginRoute } from "@/app/api/public/me/login/route";
import { POST as resetRequestRoute } from "@/app/api/public/reset/route";
import { GET as resetStatusRoute, POST as resetConsumeRoute } from "@/app/api/public/reset/[token]/route";
import { deleteAllMail, countMail, extractLink, waitForMail } from "./harness/mailpit";
import { createRawUser, deleteRawUser, rawClient, testServer, uniqueName } from "./helpers";
import { inject } from "vitest";

const admin = () => ({ type: "admin", id: testServer().admin.id, requestId: "req-self" }) as Actor;
const mailpit = () => inject("mailpit");

async function canLogin(name: string, password: string): Promise<boolean> {
  const res = await rawClient().POST("/Users/AuthenticateByName", { body: { Username: name, Pw: password } });
  if (res.response.ok && res.data?.AccessToken) {
    const c = createJellyfinClient({ baseUrl: testServer().url, deviceId: "jellycrew-test-raw", token: res.data.AccessToken });
    await c.POST("/Sessions/Logout");
  }
  return res.response.ok;
}
function tokenOf(url: string) {
  return url.split("/").pop()!;
}
function lastAudit(action: string) {
  return getDb().select().from(audit).where(eq(audit.action, action)).orderBy(desc(audit.id)).limit(1).get();
}
function jsonPost(url: string, body: unknown, ip = "203.0.113.9") {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip }, body: JSON.stringify(body) });
}

beforeEach(() => rateLimiter.reset());

describe("self-service", () => {
  it("logs in with Jellyfin credentials through the public route and reports disabled accounts", async () => {
    const u = await createRawUser(uniqueName("selflogin"));
    try {
      const res = await loginRoute(jsonPost("http://localhost:3000/api/public/me/login", { username: u.name, password: u.password }));
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toMatch(/^jellycrew_me=.+HttpOnly/);
      expect(lastAudit("self.login")?.targetUserId).toBe(u.id);
      const bad = await loginRoute(jsonPost("http://localhost:3000/api/public/me/login", { username: u.name, password: "wrong" }));
      expect(bad.status).toBe(401);
      expect(bad.headers.get("set-cookie")).toBeNull();
      await setUserEnabled(admin(), u.id, false, "expired");
      await expect(loginSelf(u.name, u.password)).rejects.toThrow(/disabled.*expired/i);
      const overview = await getSelfOverview(u.id);
      expect(overview).toMatchObject({ isDisabled: true, disabledReason: "expired", userName: u.name, serverName: "jellycrew-test" });
      let last: Response | undefined;
      for (let i = 0; i < 12; i++) last = await loginRoute(jsonPost("http://localhost:3000/api/public/me/login", { username: u.name, password: "x" }, "203.0.113.77"));
      expect(last!.status).toBe(429);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("changes the own password only after verifying the current one", async () => {
    const u = await createRawUser(uniqueName("selfpw"));
    try {
      await expect(changeOwnPassword(u.id, "not-the-password", "brand-new-password")).rejects.toBeInstanceOf(SelfServiceError);
      await expect(changeOwnPassword(u.id, u.password, "short")).rejects.toThrow(/at least 8/);
      expect(await canLogin(u.name, u.password)).toBe(true);
      await changeOwnPassword(u.id, u.password, "brand-new-password");
      expect(await canLogin(u.name, u.password)).toBe(false);
      expect(await canLogin(u.name, "brand-new-password")).toBe(true);
      const row = lastAudit("self.password.change");
      expect(row?.actorType).toBe("self");
      expect(row?.actorId).toBe(u.id);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("revokes only the user's own devices", async () => {
    const u = await createRawUser(uniqueName("selfdev"));
    const other = await createRawUser(uniqueName("otherdev"));
    try {
      const mine = createJellyfinClient({ baseUrl: testServer().url, deviceId: `${u.name}-phone`, client: "Jellyfin Mobile" });
      await call("AuthenticateUserByName", () => mine.POST("/Users/AuthenticateByName", { body: { Username: u.name, Pw: u.password } }));
      const theirs = createJellyfinClient({ baseUrl: testServer().url, deviceId: `${other.name}-phone`, client: "Jellyfin Mobile" });
      await call("AuthenticateUserByName", () => theirs.POST("/Users/AuthenticateByName", { body: { Username: other.name, Pw: other.password } }));
      await expect(revokeOwnDevice(u.id, `${other.name}-phone`)).rejects.toBeInstanceOf(SelfServiceError);
      const overview = await getSelfOverview(u.id);
      expect(overview!.devices.map((d) => d.id)).toEqual([`${u.name}-phone`]);
      await revokeOwnDevice(u.id, `${u.name}-phone`);
      expect((await getSelfOverview(u.id))!.devices).toEqual([]);
      expect(lastAudit("device.revoke")?.actorType).toBe("self");
    } finally {
      await deleteRawUser(u.id);
      await deleteRawUser(other.id);
    }
  });

  it("verifies an email through the mailed link; only then can it be used for reset", async () => {
    const u = await createRawUser(uniqueName("selfmail"));
    const email = `${u.name}@example.test`;
    try {
      await setOwnEmail(u.id, email.toUpperCase());
      let meta = getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, u.id)).get()!;
      expect(meta.email).toBe(email);
      expect(meta.emailVerifiedAt).toBeNull();
      const mail = await waitForMail(mailpit().apiUrl, email, { subject: /Verify/ });
      const link = extractLink(mail.Text, "/me/verify/");
      expect(link.startsWith("http://localhost:3000/me/verify/")).toBe(true);
      // unverified: reset request sends nothing
      await requestPasswordReset(email);
      expect(await countMail(mailpit().apiUrl, email)).toBe(1);
      const verified = verifyEmailToken(tokenOf(link));
      expect(verified).toEqual({ ok: true, email });
      expect(verifyEmailToken(tokenOf(link))).toEqual({ ok: false, reason: "used" });
      meta = getDb().select().from(userMeta).where(eq(userMeta.jellyfinUserId, u.id)).get()!;
      expect(meta.emailVerifiedAt).toBeInstanceOf(Date);
      expect(lastAudit("self.email.verify")?.actorType).toBe("self");
      // changing the address clears verification and a stale token no longer matches
      await setOwnEmail(u.id, `${u.name}-2@example.test`);
      const mail2 = await waitForMail(mailpit().apiUrl, `${u.name}-2@example.test`);
      updateUserMeta(admin(), u.id, { email: `${u.name}-3@example.test` });
      expect(verifyEmailToken(tokenOf(extractLink(mail2.Text, "/me/verify/")))).toEqual({ ok: false, reason: "mismatch" });
    } finally {
      await deleteRawUser(u.id);
    }
  });
});

describe("password reset", () => {
  it("resets a password through the mailed link and authenticates with the new one; tokens are single-use", async () => {
    const u = await createRawUser(uniqueName("reset"));
    const email = `${u.name}@example.test`;
    try {
      updateUserMeta(admin(), u.id, { email });
      getDb().update(userMeta).set({ emailVerifiedAt: new Date() }).where(eq(userMeta.jellyfinUserId, u.id)).run();
      // by username and by email both work; response is generic either way
      const res = await resetRequestRoute(jsonPost("http://localhost:3000/api/public/reset", { identifier: u.name }));
      expect(res.status).toBe(200);
      expect((await res.json()).message).toBe(RESET_GENERIC_MESSAGE);
      const mail = await waitForMail(mailpit().apiUrl, email, { subject: /Reset/ });
      const link = extractLink(mail.Text, "/reset/");
      const token = tokenOf(link);
      const status = await resetStatusRoute(new Request(`http://localhost:3000/api/public/reset/${token}`), { params: Promise.resolve({ token }) });
      expect(status.status).toBe(200);
      const consume = await resetConsumeRoute(jsonPost(`http://localhost:3000/api/public/reset/${token}`, { password: "reset-password-9", passwordConfirm: "reset-password-9" }), { params: Promise.resolve({ token }) });
      expect(consume.status).toBe(200);
      expect(await consume.json()).toMatchObject({ ok: true, userName: u.name });
      expect(await canLogin(u.name, "reset-password-9")).toBe(true);
      expect(await canLogin(u.name, u.password)).toBe(false);
      const row = lastAudit("self.password.reset");
      expect(row?.actorType).toBe("self");
      expect(row?.actorId).toBe(u.id);
      expect(row?.detail).toMatchObject({ tokenCreatedBy: "self" });
      // single use
      const again = await resetConsumeRoute(jsonPost(`http://localhost:3000/api/public/reset/${token}`, { password: "another-password-9" }), { params: Promise.resolve({ token }) });
      expect(again.status).toBe(410);
      expect((await again.json()).code).toBe("used");
      expect(resetTokenStatus(token)).toEqual({ ok: false, reason: "used" });
      expect(await canLogin(u.name, "another-password-9")).toBe(false);
      // requesting by email works too and invalidates any older unused token
      await requestPasswordReset(email);
      const a = extractLink((await waitForMail(mailpit().apiUrl, email, { subject: /Reset/ })).Text, "/reset/");
      await requestPasswordReset(email.toUpperCase());
      const rows = getDb().select().from(tokenTable).where(eq(tokenTable.jellyfinUserId, u.id)).all();
      expect(rows.filter((r) => r.kind === "password_reset" && !r.usedAt)).toHaveLength(1);
      expect(resetTokenStatus(tokenOf(a))).toEqual({ ok: false, reason: "used" });
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("expires tokens and gives unknown users the same generic response without sending mail", async () => {
    const u = await createRawUser(uniqueName("expire"));
    try {
      const { token } = issueToken({ kind: "password_reset", userId: u.id, createdBy: "self", ttlMs: RESET_TOKEN_TTL_MS, now: new Date(Date.now() - RESET_TOKEN_TTL_MS - 1000) });
      expect(resetTokenStatus(token)).toEqual({ ok: false, reason: "expired" });
      await expect(consumePasswordReset(token, "whatever-password")).rejects.toMatchObject({ code: "expired" });
      expect(await canLogin(u.name, u.password)).toBe(true);
      await expect(consumePasswordReset("not-a-token-shape!", "whatever-password")).rejects.toBeInstanceOf(ResetError);

      await deleteAllMail(mailpit().apiUrl);
      const unknown = await resetRequestRoute(jsonPost("http://localhost:3000/api/public/reset", { identifier: "nobody-here-" + Date.now() }));
      const known = await resetRequestRoute(jsonPost("http://localhost:3000/api/public/reset", { identifier: u.name }));
      expect(unknown.status).toBe(200);
      expect(known.status).toBe(200);
      expect(await unknown.json()).toEqual(await known.json());
      await new Promise((r) => setTimeout(r, 300));
      const info = (await (await fetch(`${mailpit().apiUrl}/api/v1/messages?limit=1`)).json()) as { total: number };
      expect(info.total).toBe(0);
      expect(lastAudit("self.reset.request")?.detail).toMatchObject({ matched: false });
      let last: Response | undefined;
      for (let i = 0; i < 6; i++) last = await resetRequestRoute(jsonPost("http://localhost:3000/api/public/reset", { identifier: "x" }, "203.0.113.55"));
      expect(last!.status).toBe(429);
    } finally {
      await deleteRawUser(u.id);
    }
  });

  it("lets admins generate a link without SMTP and email one to the address on file", async () => {
    const u = await createRawUser(uniqueName("adminreset"));
    try {
      const { url, expiresAt } = await adminCreateResetLink(admin(), u.id);
      expect(url.startsWith("http://localhost:3000/reset/")).toBe(true);
      expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(RESET_TOKEN_TTL_MS - 5000);
      expect(lastAudit("user.reset_link.create")?.targetUserId).toBe(u.id);
      await consumePasswordReset(tokenOf(url), "admin-issued-pass");
      expect(await canLogin(u.name, "admin-issued-pass")).toBe(true);
      expect(lastAudit("self.password.reset")?.detail).toMatchObject({ tokenCreatedBy: "admin" });

      await expect(adminEmailResetLink(admin(), u.id)).rejects.toMatchObject({ code: "no_email" });
      const email = `${u.name}@example.test`;
      updateUserMeta(admin(), u.id, { email });
      const { email: sentTo } = await adminEmailResetLink(admin(), u.id);
      expect(sentTo).toBe(email);
      const mail = await waitForMail(mailpit().apiUrl, email, { subject: /Reset/ });
      expect(mail.Text).toContain("An administrator");
      const results = await executeBulk(admin(), "send_reset_link", [u.id, testServer().admin.id], {});
      expect(results.find((r) => r.userId === u.id)).toMatchObject({ ok: true });
      expect(results.find((r) => r.userId === testServer().admin.id)?.message).toMatch(/Skipped: No email/);
    } finally {
      await deleteRawUser(u.id);
    }
  });
});
