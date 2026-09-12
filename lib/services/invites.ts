import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { sealData, unsealData } from "iron-session";
import { getDb } from "@/lib/db";
import { invite as inviteTable, inviteUse, userMeta, type Invite, type InviteUse } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { JellyfinError, createUserRaw, fetchUsers, updateUserPolicy } from "@/lib/jellyfin";
import { applyProfilePolicy } from "@/lib/policy/merge";
import { diffPolicies } from "@/lib/policy/diff";
import { generateToken, hashToken, isTokenShaped } from "@/lib/tokens";
import { inviteUrl } from "@/lib/urls";
import { recordAudit, type Actor } from "./audit";
import { withUserPolicyLock } from "./policy-writes";
import { deleteUserNow } from "./lifecycle";
import { getProfile } from "./profiles";
import { invalidateSessionCache } from "./sessions";
import { validatePassword } from "./user-actions";
import { ensureMetaRows } from "./users";

export const INVITE_DEFAULT_EXPIRY_DAYS = 7;

export type InviteStatus = "active" | "expired" | "exhausted" | "revoked";

export interface InviteInput {
  label?: string | null;
  profileId?: string | null;
  /** Link validity in days; null = default 7. 0 = never expires. */
  linkExpiryDays?: number | null;
  maxUses?: number | null;
  accountExpiryDays?: number | null;
  requireEmail?: boolean;
  noteForInvitee?: string | null;
}

export class InviteError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "expired" | "exhausted" | "revoked" | "username_taken" | "username_rejected" | "password" | "email_required" | "profile_failed" | "jellyfin",
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export function inviteStatus(inv: Invite, now: Date = new Date()): InviteStatus {
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt && inv.expiresAt.getTime() <= now.getTime()) return "expired";
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return "exhausted";
  return "active";
}

export async function createInvite(actor: Actor, input: InviteInput, now: Date = new Date()): Promise<{ invite: Invite; token: string; url: string }> {
  if (input.profileId && !getProfile(input.profileId)) throw new InviteError("Profile not found.", "invalid");
  const token = generateToken();
  const days = input.linkExpiryDays ?? INVITE_DEFAULT_EXPIRY_DAYS;
  const row = getDb()
    .insert(inviteTable)
    .values({
      id: randomUUID(),
      tokenHash: hashToken(token),
      tokenSealed: await sealData({ token }, { password: env().SESSION_SECRET }),
      label: input.label?.trim() || null,
      profileId: input.profileId || null,
      expiresAt: days > 0 ? new Date(now.getTime() + days * 86_400_000) : null,
      maxUses: input.maxUses ?? null,
      uses: 0,
      accountExpiryDays: input.accountExpiryDays ?? null,
      requireEmail: input.requireEmail ?? false,
      noteForInvitee: input.noteForInvitee?.trim() || null,
      createdBy: actor.id ?? "system",
      createdAt: now,
      revokedAt: null,
    })
    .returning()
    .get();
  recordAudit({
    actor,
    action: "invite.create",
    after: { id: row.id, label: row.label, profileId: row.profileId, expiresAt: row.expiresAt, maxUses: row.maxUses, accountExpiryDays: row.accountExpiryDays, requireEmail: row.requireEmail },
  });
  return { invite: row, token, url: inviteUrl(token) };
}

/** Recovers the plain token for an existing invite (needs SESSION_SECRET). */
export async function inviteLink(inv: Invite): Promise<string | null> {
  if (!inv.tokenSealed) return null;
  try {
    const { token } = await unsealData<{ token: string }>(inv.tokenSealed, { password: env().SESSION_SECRET });
    return token ? inviteUrl(token) : null;
  } catch {
    return null;
  }
}

export interface InviteWithUses extends Invite {
  status: InviteStatus;
  usedBy: Array<InviteUse & { userName: string | null }>;
}

export async function listInvites(now: Date = new Date()): Promise<InviteWithUses[]> {
  const db = getDb();
  const rows = db.select().from(inviteTable).orderBy(desc(inviteTable.createdAt)).all();
  const uses = db.select().from(inviteUse).orderBy(desc(inviteUse.createdAt)).all();
  let names = new Map<string, string>();
  try {
    names = new Map((await fetchUsers()).map((u) => [u.Id, u.Name ?? u.Id]));
  } catch {
    // Jellyfin down: still list invites, without names.
  }
  return rows.map((r) => ({
    ...r,
    status: inviteStatus(r, now),
    usedBy: uses.filter((u) => u.inviteId === r.id).map((u) => ({ ...u, userName: names.get(u.jellyfinUserId) ?? null })),
  }));
}

export function getInvite(id: string): Invite | undefined {
  return getDb().select().from(inviteTable).where(eq(inviteTable.id, id)).get();
}

export function revokeInvite(actor: Actor, id: string): Invite {
  const before = getInvite(id);
  if (!before) throw new InviteError("Invite not found.", "invalid");
  if (before.revokedAt) return before;
  const row = getDb().update(inviteTable).set({ revokedAt: new Date() }).where(eq(inviteTable.id, id)).returning().get();
  recordAudit({ actor, action: "invite.revoke", before: { id, revokedAt: null }, after: { id, revokedAt: row.revokedAt }, detail: { label: row.label } });
  return row;
}

/** Looks an invite up by its plain token. Null for unknown or malformed tokens. */
export function findInviteByToken(token: string): Invite | null {
  if (!isTokenShaped(token)) return null;
  return getDb().select().from(inviteTable).where(eq(inviteTable.tokenHash, hashToken(token))).get() ?? null;
}

export interface PublicInviteInfo {
  status: InviteStatus;
  label: string | null;
  note: string | null;
  requireEmail: boolean;
  profileName: string | null;
  accountExpiryDays: number | null;
}

export function publicInviteInfo(token: string, now: Date = new Date()): PublicInviteInfo | null {
  const inv = findInviteByToken(token);
  if (!inv) return null;
  const profile = inv.profileId ? getProfile(inv.profileId) : undefined;
  return {
    status: inviteStatus(inv, now),
    label: inv.label,
    note: inv.noteForInvitee,
    requireEmail: inv.requireEmail,
    profileName: profile?.name ?? null,
    accountExpiryDays: inv.accountExpiryDays ?? profile?.defaultExpiryDays ?? null,
  };
}

export interface RedeemInput {
  token: string;
  username: string;
  password: string;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RedeemResult {
  userId: string;
  userName: string;
  inviteId: string;
  expiresAt: Date | null;
}

function assertRedeemable(inv: Invite, now: Date): void {
  const status = inviteStatus(inv, now);
  if (status === "revoked") throw new InviteError("This invite has been revoked.", "revoked");
  if (status === "expired") throw new InviteError("This invite has expired.", "expired");
  if (status === "exhausted") throw new InviteError("This invite has already been used the maximum number of times.", "exhausted");
}

/**
 * Public signup. Creates the Jellyfin user, applies the profile, records metadata and the
 * use. If anything after user creation fails, the user is deleted again so nobody is left
 * on Jellyfin's default policy.
 */
export async function redeemInvite(input: RedeemInput, now: Date = new Date()): Promise<RedeemResult> {
  const inv = findInviteByToken(input.token);
  if (!inv) throw new InviteError("This invite link is not valid.", "invalid");
  assertRedeemable(inv, now);

  const username = input.username.trim();
  if (!username) throw new InviteError("A username is required.", "username_rejected");
  const passwordProblem = validatePassword(input.password);
  if (passwordProblem) throw new InviteError(passwordProblem, "password");
  const email = input.email?.trim().toLowerCase() || null;
  if (inv.requireEmail && !email) throw new InviteError("An email address is required for this invite.", "email_required");
  const profile = inv.profileId ? getProfile(inv.profileId) : null;
  if (inv.profileId && !profile) throw new InviteError("The profile for this invite no longer exists. Contact the administrator.", "invalid");

  const existing = await fetchUsers();
  if (existing.some((u) => (u.Name ?? "").toLowerCase() === username.toLowerCase())) {
    throw new InviteError(`The username "${username}" is already taken.`, "username_taken");
  }

  const inviteActor: Actor = { type: "invite", id: inv.id };
  let user;
  try {
    user = await createUserRaw(username, input.password);
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 400) {
      throw new InviteError(`Jellyfin rejected the username: ${typeof err.body === "string" ? err.body : JSON.stringify(err.body)}`, "username_rejected");
    }
    throw new InviteError("Jellyfin could not create the account. Try again later.", "jellyfin");
  }
  const userId = user.Id;

  try {
    let appliedKeys: string[] = [];
    if (profile) {
      const live = (user.Policy ?? {}) as Record<string, unknown>;
      const merged = applyProfilePolicy(live, profile.policy);
      appliedKeys = diffPolicies(live, merged).map((c) => c.key);
      if (appliedKeys.length > 0) await withUserPolicyLock(userId, () => updateUserPolicy(userId, merged));
    }
    const db = getDb();
    const claimed = db
      .update(inviteTable)
      .set({ uses: sql`${inviteTable.uses} + 1` })
      .where(and(eq(inviteTable.id, inv.id), isNull(inviteTable.revokedAt), or(isNull(inviteTable.maxUses), lt(inviteTable.uses, inviteTable.maxUses))))
      .run();
    if (claimed.changes === 0) throw new InviteError("This invite has already been used the maximum number of times.", "exhausted");

    const expiryDays = inv.accountExpiryDays ?? profile?.defaultExpiryDays ?? null;
    const expiresAt = expiryDays ? new Date(now.getTime() + expiryDays * 86_400_000) : null;
    ensureMetaRows([userId]);
    db.update(userMeta)
      .set({ email, profileId: profile?.id ?? null, expiresAt, createdViaInviteId: inv.id, firstSeenAt: now, updatedAt: now })
      .where(eq(userMeta.jellyfinUserId, userId))
      .run();
    db.insert(inviteUse).values({ id: randomUUID(), inviteId: inv.id, jellyfinUserId: userId, ip: input.ip ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null, createdAt: now }).run();
    recordAudit({
      actor: inviteActor,
      action: "invite.signup",
      targetUserId: userId,
      after: { userName: username, email, profileId: profile?.id ?? null, profileName: profile?.name ?? null, expiresAt },
      detail: { inviteId: inv.id, label: inv.label, ip: input.ip ?? null, appliedKeys },
    });
    invalidateSessionCache();
    return { userId, userName: username, inviteId: inv.id, expiresAt };
  } catch (err) {
    // Roll back: never leave an account on Jellyfin's default policy.
    try {
      await deleteUserNow(inviteActor, userId, { reason: "invite signup rolled back" });
    } catch (rollbackErr) {
      recordAudit({ actor: inviteActor, action: "invite.rollback_failed", targetUserId: userId, detail: { error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr) } });
    }
    recordAudit({ actor: inviteActor, action: "invite.signup_failed", targetUserId: userId, detail: { inviteId: inv.id, userName: username, error: err instanceof Error ? err.message : String(err) } });
    if (err instanceof InviteError) throw err;
    const message = err instanceof JellyfinError ? `Applying the profile failed (${err.message}). The account was removed again.` : "Signup failed after the account was created; it was removed again.";
    throw new InviteError(message, "profile_failed");
  }
}
