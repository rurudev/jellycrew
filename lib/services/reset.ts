import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userMeta } from "@/lib/db/schema";
import { fetchUser, fetchUsers, setUserPasswordRaw } from "@/lib/jellyfin";
import { logger } from "@/lib/log";
import { MailNotConfiguredError, isMailConfigured, sendMail } from "@/lib/mail";
import { resetLinkMail } from "@/lib/mail-templates";
import { publicBaseUrl } from "@/lib/urls";
import { recordAudit, type Actor } from "./audit";
import { getServerStatus } from "./system";
import { RESET_TOKEN_TTL_MS, consumeToken, issueToken, peekToken } from "./tokens";
import { validatePassword } from "./user-actions";
import { getMeta } from "./users";

export class ResetError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "used" | "expired" | "password" | "no_email" | "mail",
  ) {
    super(message);
    this.name = "ResetError";
  }
}

export const RESET_GENERIC_MESSAGE = "If an account with a verified email address matches, a reset link has been sent. The link works once and expires in 60 minutes.";

export function resetUrl(token: string): string {
  return `${publicBaseUrl()}/reset/${token}`;
}

async function mailResetLink(userId: string, userName: string, email: string, token: string, requestedByAdmin: boolean): Promise<void> {
  const server = await getServerStatus();
  const mail = resetLinkMail({ serverName: server.serverName ?? "Jellyfin", userName, url: resetUrl(token), expiresInMinutes: RESET_TOKEN_TTL_MS / 60_000, requestedByAdmin });
  await sendMail({ to: email, ...mail });
}

/**
 * Public "forgot password". Never reveals whether the identifier matched: the caller
 * always shows RESET_GENERIC_MESSAGE. A mail goes out only for a verified address.
 */
export async function requestPasswordReset(identifier: string, ctx: { ip?: string | null; requestId?: string } = {}): Promise<{ sent: boolean }> {
  const needle = identifier.trim().toLowerCase();
  if (!needle || !isMailConfigured()) return { sent: false };
  let userId: string | undefined;
  let userName: string | undefined;
  const byEmail = getDb().select().from(userMeta).where(eq(userMeta.email, needle)).all().filter((m) => m.emailVerifiedAt);
  const users = await fetchUsers().catch((err) => {
    logger.warn({ err }, "reset request: could not list users");
    return [];
  });
  if (byEmail.length === 1) {
    const u = users.find((x) => x.Id === byEmail[0].jellyfinUserId);
    if (u) {
      userId = u.Id;
      userName = u.Name ?? u.Id;
    }
  } else if (byEmail.length > 1) {
    // Nothing enforces one verified address per account. Picking one of them would mail the
    // link to somebody who did not ask for it, so nothing is sent; typing the username instead
    // takes the branch below, which resolves to exactly one account.
    logger.warn({ count: byEmail.length }, "reset request: several accounts share this verified address, so the request was ignored; the user should enter their username");
  } else if (byEmail.length === 0) {
    const u = users.find((x) => (x.Name ?? "").toLowerCase() === needle);
    if (u) {
      const meta = getMeta(u.Id);
      if (meta.email && meta.emailVerifiedAt) {
        userId = u.Id;
        userName = u.Name ?? u.Id;
      }
    }
  }
  if (!userId || !userName) {
    recordAudit({ actor: { type: "self", id: null, requestId: ctx.requestId }, action: "self.reset.request", detail: { matched: false, ip: ctx.ip ?? null } });
    return { sent: false };
  }
  const meta = getMeta(userId);
  const { token } = issueToken({ kind: "password_reset", userId, createdBy: "self", ttlMs: RESET_TOKEN_TTL_MS });
  try {
    await mailResetLink(userId, userName, meta.email!, token, false);
  } catch (err) {
    logger.error({ err }, "reset mail failed");
    recordAudit({ actor: { type: "self", id: userId, requestId: ctx.requestId }, action: "self.reset.request", targetUserId: userId, detail: { matched: true, sent: false, ip: ctx.ip ?? null } });
    return { sent: false };
  }
  recordAudit({ actor: { type: "self", id: userId, requestId: ctx.requestId }, action: "self.reset.request", targetUserId: userId, detail: { matched: true, sent: true, ip: ctx.ip ?? null } });
  return { sent: true };
}

export function resetTokenStatus(token: string): { ok: true; userName: string | null } | { ok: false; reason: "invalid" | "used" | "expired" } {
  const peek = peekToken("password_reset", token);
  if (!peek.ok) return peek;
  return { ok: true, userName: null };
}

/** Consumes the token and sets the new password. Single use, audited with the self actor. */
export async function consumePasswordReset(token: string, newPassword: string, ctx: { ip?: string | null; requestId?: string } = {}): Promise<{ userId: string; userName: string }> {
  const problem = validatePassword(newPassword);
  if (problem) throw new ResetError(problem, "password");
  const peek = peekToken("password_reset", token);
  if (!peek.ok) throw new ResetError(peek.reason === "expired" ? "This reset link has expired." : peek.reason === "used" ? "This reset link has already been used." : "This reset link is not valid.", peek.reason);
  const user = await fetchUser(peek.row.jellyfinUserId);
  const result = consumeToken("password_reset", token);
  if (!result.ok) throw new ResetError("This reset link has already been used.", result.reason);
  await setUserPasswordRaw(user.Id, newPassword);
  recordAudit({
    actor: { type: "self", id: user.Id, requestId: ctx.requestId },
    action: "self.password.reset",
    targetUserId: user.Id,
    detail: { tokenCreatedBy: result.row.createdBy, ip: ctx.ip ?? null },
  });
  return { userId: user.Id, userName: user.Name ?? user.Id };
}

/** Admin: a one-hour single-use link to hand over out of band. Works without SMTP. */
export async function adminCreateResetLink(actor: Actor, userId: string): Promise<{ url: string; expiresAt: Date }> {
  await fetchUser(userId);
  const { token, row } = issueToken({ kind: "password_reset", userId, createdBy: "admin", ttlMs: RESET_TOKEN_TTL_MS });
  recordAudit({ actor, action: "user.reset_link.create", targetUserId: userId, detail: { expiresAt: row.expiresAt } });
  return { url: resetUrl(token), expiresAt: row.expiresAt };
}

/** Admin: mail a reset link to the address on file (verified or not; the admin vouches for it). */
export async function adminEmailResetLink(actor: Actor, userId: string): Promise<{ email: string }> {
  if (!isMailConfigured()) throw new MailNotConfiguredError();
  const user = await fetchUser(userId);
  const meta = getMeta(userId);
  if (!meta.email) throw new ResetError("This user has no email address on file.", "no_email");
  const { token, row } = issueToken({ kind: "password_reset", userId, createdBy: "admin", ttlMs: RESET_TOKEN_TTL_MS });
  try {
    await mailResetLink(userId, user.Name ?? userId, meta.email, token, true);
  } catch (err) {
    throw new ResetError(`Sending the mail failed: ${err instanceof Error ? err.message : String(err)}`, "mail");
  }
  recordAudit({ actor, action: "user.reset_link.email", targetUserId: userId, detail: { email: meta.email, expiresAt: row.expiresAt } });
  return { email: meta.email };
}
