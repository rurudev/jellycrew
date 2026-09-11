import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { token as tokenTable, userMeta, type UserMeta } from "@/lib/db/schema";
import { parseDate } from "@/lib/format";
import { JellyfinError, deleteUser as deleteJellyfinUser, fetchUser, fetchUsers } from "@/lib/jellyfin";
import { decideLifecycle, effectiveInactivityDays, type LifecycleDecision, type LifecycleInput } from "@/lib/lifecycle/decide";
import { getSettingOrDefault } from "@/lib/settings";
import { activityBasis } from "@/lib/users/status";
import { SYSTEM_ACTOR, recordAudit, type Actor } from "./audit";
import { assertProtected } from "./protection";
import { invalidateSessionCache } from "./sessions";
import { setUserEnabled } from "./user-actions";
import { ensureMetaRows, getMeta, profilesById } from "./users";

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

export interface MetaPatch {
  email?: string | null;
  notes?: string | null;
  labels?: string[];
  expiresAt?: Date | null;
  inactivityDisableDays?: number | null;
}

export function normalizeLabels(labels: string[]): string[] {
  return [...new Set(labels.map((l) => l.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Edits the app-owned fields of a user. Changing the email clears its verification. */
export function updateUserMeta(actor: Actor, userId: string, patch: MetaPatch): UserMeta {
  const before = getMeta(userId);
  const set: Partial<UserMeta> = { updatedAt: new Date() };
  if (patch.email !== undefined) {
    const email = patch.email?.trim().toLowerCase() || null;
    if (email !== before.email) {
      set.email = email;
      set.emailVerifiedAt = null;
    }
  }
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
  if (patch.labels !== undefined) set.labels = normalizeLabels(patch.labels);
  if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt;
  if (patch.inactivityDisableDays !== undefined) set.inactivityDisableDays = patch.inactivityDisableDays;
  const after = getDb().update(userMeta).set(set).where(eq(userMeta.jellyfinUserId, userId)).returning().get();
  const keys = (Object.keys(set) as Array<keyof UserMeta>).filter((k) => k !== "updatedAt");
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (changed.length > 0) {
    recordAudit({
      actor,
      action: "user.meta.update",
      targetUserId: userId,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, after[k]])),
    });
  }
  return after;
}

export function setExpiry(actor: Actor, userId: string, expiresAt: Date | null): UserMeta {
  return updateUserMeta(actor, userId, { expiresAt });
}

/** Extends from the later of now and the current expiry; a user without expiry gets now + days. */
export function extendExpiry(actor: Actor, userId: string, days: number, now: Date = new Date()): UserMeta {
  const meta = getMeta(userId);
  const base = meta.expiresAt && meta.expiresAt > now ? meta.expiresAt : now;
  return updateUserMeta(actor, userId, { expiresAt: new Date(base.getTime() + days * 86_400_000) });
}

export function addLabel(actor: Actor, userId: string, label: string): UserMeta {
  const meta = getMeta(userId);
  return updateUserMeta(actor, userId, { labels: [...meta.labels, label] });
}

export function removeLabel(actor: Actor, userId: string, label: string): UserMeta {
  const meta = getMeta(userId);
  return updateUserMeta(actor, userId, { labels: meta.labels.filter((l) => l !== label) });
}

/**
 * Two-step deletion, step one: disable now and record when the account may be deleted.
 * Administrators and the acting admin are refused by the protection rules.
 */
export async function scheduleDeletion(actor: Actor, userId: string, opts: { graceDays?: number; now?: Date } = {}): Promise<UserMeta> {
  const now = opts.now ?? new Date();
  const grace = opts.graceDays ?? getSettingOrDefault("graceDays");
  await assertProtected(actor, userId, "delete");
  const user = await fetchUser(userId);
  if (user.Policy?.IsAdministrator) throw new LifecycleError("Administrators cannot be scheduled for deletion. Remove administrator rights first.");
  const before = getMeta(userId);
  if (before.deleteAfter) throw new LifecycleError("Deletion is already scheduled.");
  await setUserEnabled(actor, userId, false, "manual");
  const deleteAfter = new Date(now.getTime() + grace * 86_400_000);
  const after = getDb().update(userMeta).set({ deleteAfter, updatedAt: now }).where(eq(userMeta.jellyfinUserId, userId)).returning().get();
  recordAudit({ actor, action: "user.delete.schedule", targetUserId: userId, before: { deleteAfter: null }, after: { deleteAfter }, detail: { graceDays: grace } });
  return after;
}

/** Cancels a scheduled deletion and re-enables the account. */
export async function cancelDeletion(actor: Actor, userId: string): Promise<UserMeta> {
  const before = getMeta(userId);
  if (!before.deleteAfter) throw new LifecycleError("No deletion is scheduled.");
  const after = getDb().update(userMeta).set({ deleteAfter: null, updatedAt: new Date() }).where(eq(userMeta.jellyfinUserId, userId)).returning().get();
  recordAudit({ actor, action: "user.delete.cancel", targetUserId: userId, before: { deleteAfter: before.deleteAfter }, after: { deleteAfter: null } });
  await setUserEnabled(actor, userId, true);
  return after;
}

/** Immediate, irreversible deletion in Jellyfin. App metadata and tokens are removed; audit rows stay. */
export async function deleteUserNow(actor: Actor, userId: string, opts: { reason?: string } = {}): Promise<void> {
  await assertProtected(actor, userId, "delete");
  let name: string | null = null;
  try {
    const user = await fetchUser(userId);
    name = user.Name ?? null;
    if (user.Policy?.IsAdministrator && actor.type === "system") throw new LifecycleError("Automation never deletes administrators.");
  } catch (err) {
    if (err instanceof JellyfinError && (err.status === 404 || err.status === 400)) name = null;
    else throw err;
  }
  if (name !== null) await deleteJellyfinUser(userId);
  const db = getDb();
  const meta = db.select().from(userMeta).where(eq(userMeta.jellyfinUserId, userId)).get();
  db.delete(tokenTable).where(eq(tokenTable.jellyfinUserId, userId)).run();
  db.delete(userMeta).where(eq(userMeta.jellyfinUserId, userId)).run();
  recordAudit({
    actor,
    action: "user.delete",
    targetUserId: userId,
    before: { name, email: meta?.email ?? null, labels: meta?.labels ?? [], profileId: meta?.profileId ?? null },
    after: null,
    detail: { reason: opts.reason ?? "immediate", existedInJellyfin: name !== null },
  });
  invalidateSessionCache();
}

export interface LifecycleRunResult {
  at: string;
  scanned: number;
  disabled: Array<{ userId: string; name: string; reason: "expired" | "inactive" }>;
  deleted: Array<{ userId: string; name: string }>;
  skippedAdmins: number;
  errors: Array<{ userId: string; name: string; error: string }>;
}

/** Builds decision inputs for every Jellyfin user from live data plus app metadata. */
export async function collectLifecycleInputs(): Promise<LifecycleInput[]> {
  const users = await fetchUsers();
  const metas = ensureMetaRows(users.map((u) => u.Id));
  const profiles = profilesById();
  return users.map((u) => {
    const meta = metas.get(u.Id)!;
    const profile = meta.profileId ? profiles.get(meta.profileId) : undefined;
    const lastActivity = parseDate(u.LastActivityDate);
    const lastLogin = parseDate(u.LastLoginDate);
    return {
      userId: u.Id,
      name: u.Name ?? u.Id,
      isAdmin: u.Policy?.IsAdministrator ?? false,
      isDisabled: u.Policy?.IsDisabled ?? false,
      expiresAt: meta.expiresAt,
      inactivityDisableDays: effectiveInactivityDays(meta.inactivityDisableDays, profile?.inactivityDisableDays),
      activityBasis: activityBasis(lastActivity, lastLogin, meta.firstSeenAt),
      deleteAfter: meta.deleteAfter,
      disabledReason: meta.disabledReason,
    };
  });
}

/** One scheduler pass. Every change is audited with the system actor. */
export async function runLifecycle(now: Date = new Date()): Promise<LifecycleRunResult> {
  const inputs = await collectLifecycleInputs();
  const result: LifecycleRunResult = { at: now.toISOString(), scanned: inputs.length, disabled: [], deleted: [], skippedAdmins: 0, errors: [] };
  for (const input of inputs) {
    const decision: LifecycleDecision = decideLifecycle(input, now);
    if (input.isAdmin) result.skippedAdmins += 1;
    if (decision.action === "none") continue;
    try {
      if (decision.action === "disable") {
        await setUserEnabled(SYSTEM_ACTOR, input.userId, false, decision.reason);
        result.disabled.push({ userId: input.userId, name: input.name, reason: decision.reason });
      } else {
        await deleteUserNow(SYSTEM_ACTOR, input.userId, { reason: "grace period ended" });
        result.deleted.push({ userId: input.userId, name: input.name });
      }
    } catch (err) {
      result.errors.push({ userId: input.userId, name: input.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
