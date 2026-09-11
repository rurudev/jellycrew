import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userMeta, type UserMeta } from "@/lib/db/schema";
import { JellyfinError, fetchUser, fetchUsers, setUserPasswordRaw } from "@/lib/jellyfin";
import { MailNotConfiguredError, isMailConfigured, sendMail } from "@/lib/mail";
import { verifyEmailMail } from "@/lib/mail-templates";
import { publicBaseUrl } from "@/lib/urls";
import type { SessionView } from "@/lib/sessions/view";
import { recordAudit, type Actor } from "./audit";
import { LoginError, verifyCredentials, type VerifiedIdentity } from "./auth";
import { listDevices, revokeDevice, type DeviceView } from "./devices";
import { getProfile } from "./profiles";
import { sessionsForUser } from "./sessions";
import { getServerStatus } from "./system";
import { VERIFY_TOKEN_TTL_MS, consumeToken, issueToken } from "./tokens";
import { validatePassword } from "./user-actions";
import { getMeta } from "./users";

export class SelfServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelfServiceError";
  }
}

const selfActor = (userId: string, requestId?: string): Actor => ({ type: "self", id: userId, requestId });

/**
 * Self-service login. Any Jellyfin account may sign in. For a disabled account the
 * app-side reason is attached so the person knows why.
 */
export async function loginSelf(username: string, password: string, requestId?: string): Promise<VerifiedIdentity> {
  try {
    const identity = await verifyCredentials(username, password);
    recordAudit({ actor: selfActor(identity.userId, requestId), action: "self.login", targetUserId: identity.userId });
    return identity;
  } catch (err) {
    if (err instanceof LoginError && err.code === "disabled") {
      const user = (await fetchUsers().catch(() => [])).find((u) => (u.Name ?? "").toLowerCase() === username.trim().toLowerCase());
      const meta = user ? getMeta(user.Id) : null;
      const why = meta?.disabledReason === "expired" ? " Your access has expired." : meta?.disabledReason === "inactive" ? " It was disabled after a period of inactivity." : "";
      throw new LoginError("disabled", `This account is disabled.${why} Contact the administrator.`);
    }
    throw err;
  }
}

export interface SelfOverview {
  userId: string;
  userName: string;
  serverName: string;
  profileName: string | null;
  expiresAt: Date | null;
  isDisabled: boolean;
  disabledReason: UserMeta["disabledReason"];
  email: string | null;
  emailVerified: boolean;
  mailConfigured: boolean;
  sessions: SessionView[];
  devices: DeviceView[];
}

export async function getSelfOverview(userId: string): Promise<SelfOverview | null> {
  let user;
  try {
    user = await fetchUser(userId);
  } catch (err) {
    if (err instanceof JellyfinError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
  const meta = getMeta(userId);
  const [server, sessions, devices] = await Promise.all([getServerStatus(), sessionsForUser(userId), listDevices(userId)]);
  const profile = meta.profileId ? getProfile(meta.profileId) : undefined;
  return {
    userId,
    userName: user.Name ?? userId,
    serverName: server.serverName ?? "Jellyfin",
    profileName: profile?.name ?? null,
    expiresAt: meta.expiresAt,
    isDisabled: user.Policy?.IsDisabled ?? false,
    disabledReason: meta.disabledReason,
    email: meta.email,
    emailVerified: !!meta.emailVerifiedAt,
    mailConfigured: isMailConfigured(),
    sessions,
    devices: devices.filter((d) => d.lastUserId === userId),
  };
}

/** Verifies the current password with Jellyfin before setting the new one. */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string, requestId?: string): Promise<void> {
  const user = await fetchUser(userId);
  const problem = validatePassword(newPassword);
  if (problem) throw new SelfServiceError(problem);
  let identity: VerifiedIdentity;
  try {
    identity = await verifyCredentials(user.Name ?? "", currentPassword);
  } catch (err) {
    if (err instanceof LoginError) throw new SelfServiceError("The current password is not correct.");
    throw err;
  }
  if (identity.userId !== userId) throw new SelfServiceError("The current password is not correct.");
  await setUserPasswordRaw(userId, newPassword);
  recordAudit({ actor: selfActor(userId, requestId), action: "self.password.change", targetUserId: userId });
}

/** Revokes one of the signed-in user's own devices. */
export async function revokeOwnDevice(userId: string, deviceId: string, requestId?: string): Promise<void> {
  const device = (await listDevices(userId)).find((d) => d.id === deviceId && d.lastUserId === userId);
  if (!device) throw new SelfServiceError("That device does not belong to your account.");
  await revokeDevice(selfActor(userId, requestId), deviceId);
}

async function sendVerification(actor: Actor, userId: string, userName: string, email: string): Promise<void> {
  if (!isMailConfigured()) throw new MailNotConfiguredError();
  const { token } = issueToken({ kind: "email_verify", userId, createdBy: actor.type === "admin" ? "admin" : "self", ttlMs: VERIFY_TOKEN_TTL_MS, email });
  const server = await getServerStatus();
  const mail = verifyEmailMail({ serverName: server.serverName ?? "Jellyfin", userName, url: `${publicBaseUrl()}/me/verify/${token}`, expiresInHours: VERIFY_TOKEN_TTL_MS / 3_600_000 });
  await sendMail({ to: email, ...mail });
  recordAudit({ actor, action: "email.verification.sent", targetUserId: userId, detail: { email } });
}

/** Stores a new (unverified) address and mails a verification link. */
export async function setOwnEmail(userId: string, email: string, requestId?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new SelfServiceError("Enter an email address.");
  if (!isMailConfigured()) throw new MailNotConfiguredError();
  const user = await fetchUser(userId);
  const before = getMeta(userId);
  getDb().update(userMeta).set({ email: normalized, emailVerifiedAt: null, updatedAt: new Date() }).where(eq(userMeta.jellyfinUserId, userId)).run();
  const actor = selfActor(userId, requestId);
  recordAudit({ actor, action: "self.email.set", targetUserId: userId, before: { email: before.email, verified: !!before.emailVerifiedAt }, after: { email: normalized, verified: false } });
  await sendVerification(actor, userId, user.Name ?? userId, normalized);
}

export async function resendOwnVerification(userId: string, requestId?: string): Promise<void> {
  const meta = getMeta(userId);
  if (!meta.email) throw new SelfServiceError("No email address on file.");
  if (meta.emailVerifiedAt) throw new SelfServiceError("This address is already verified.");
  const user = await fetchUser(userId);
  await sendVerification(selfActor(userId, requestId), userId, user.Name ?? userId, meta.email);
}

/** Admin-triggered (re)send of the verification mail for the address on file. */
export async function adminSendVerification(actor: Actor, userId: string): Promise<void> {
  const meta = getMeta(userId);
  if (!meta.email) throw new SelfServiceError("No email address on file.");
  const user = await fetchUser(userId);
  await sendVerification(actor, userId, user.Name ?? userId, meta.email);
}

export type VerifyEmailResult = { ok: true; email: string } | { ok: false; reason: "invalid" | "used" | "expired" | "mismatch" };

/** Consumes a verification token; the address must still be the one on file. */
export function verifyEmailToken(token: string, requestId?: string): VerifyEmailResult {
  const result = consumeToken("email_verify", token);
  if (!result.ok) return result;
  const meta = getMeta(result.row.jellyfinUserId);
  if (!result.row.email || meta.email !== result.row.email) return { ok: false, reason: "mismatch" };
  getDb().update(userMeta).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(userMeta.jellyfinUserId, meta.jellyfinUserId)).run();
  recordAudit({ actor: selfActor(meta.jellyfinUserId, requestId), action: "self.email.verify", targetUserId: meta.jellyfinUserId, after: { email: meta.email, verified: true } });
  return { ok: true, email: meta.email };
}
