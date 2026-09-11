import { JellyfinError, fetchUser, fetchUsers, setUserPasswordRaw, updateUser, updateUserPolicy } from "@/lib/jellyfin";
import type { DisabledReason } from "@/lib/db/schema";
import { getSettingOrDefault } from "@/lib/settings";
import { recordAudit, type Actor } from "./audit";
import { assertProtected } from "./protection";
import { invalidateSessionCache } from "./sessions";
import { markDisabledByApp } from "./users";

export class UserActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserActionError";
  }
}

/**
 * Enables or disables a user (read-modify-write on IsDisabled). Disabling checks the
 * last-admin and self protections. `reason` is recorded in user_meta for disables.
 */
export async function setUserEnabled(actor: Actor, userId: string, enabled: boolean, reason: DisabledReason = "manual"): Promise<{ changed: boolean }> {
  const user = await fetchUser(userId);
  const live = (user.Policy ?? {}) as Record<string, unknown>;
  const currentlyDisabled = live.IsDisabled === true;
  if (currentlyDisabled === !enabled) {
    if (!enabled) markDisabledByApp(userId, reason, { onlyIfUnset: true });
    return { changed: false };
  }
  if (!enabled) {
    await assertProtected(actor, userId, "disable");
    // Jellyfin itself refuses this with HTTP 403; give the operator the fix instead.
    if (live.IsAdministrator === true) throw new UserActionError("Jellyfin does not allow disabling administrators. Remove administrator rights first.");
  }
  await updateUserPolicy(userId, { ...live, IsDisabled: !enabled });
  recordAudit({
    actor,
    action: enabled ? "user.enable" : "user.disable",
    targetUserId: userId,
    before: { IsDisabled: currentlyDisabled },
    after: { IsDisabled: !enabled },
    detail: enabled ? null : { reason },
  });
  markDisabledByApp(userId, enabled ? null : reason);
  invalidateSessionCache();
  return { changed: true };
}

export async function renameUser(actor: Actor, userId: string, newName: string): Promise<void> {
  const name = newName.trim();
  if (!name) throw new UserActionError("A name is required.");
  const users = await fetchUsers();
  const clash = users.find((u) => u.Id !== userId && (u.Name ?? "").toLowerCase() === name.toLowerCase());
  if (clash) throw new UserActionError(`The name "${name}" is already taken.`);
  const user = users.find((u) => u.Id === userId) ?? (await fetchUser(userId));
  const before = user.Name ?? null;
  if (before === name) return;
  try {
    await updateUser(userId, { ...user, Name: name });
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 400) throw new UserActionError(`Jellyfin rejected the name: ${String(err.body)}`);
    throw err;
  }
  recordAudit({ actor, action: "user.rename", targetUserId: userId, before: { Name: before }, after: { Name: name } });
}

export function validatePassword(password: string): string | null {
  const min = getSettingOrDefault("minPasswordLength");
  if (password.length < min) return `Password must be at least ${min} characters.`;
  return null;
}

/** Sets a password directly (admin action). No current password is required with the API key. */
export async function setUserPassword(actor: Actor, userId: string, password: string): Promise<void> {
  const problem = validatePassword(password);
  if (problem) throw new UserActionError(problem);
  await fetchUser(userId); // 404 → JellyfinError before we audit anything
  await setUserPasswordRaw(userId, password);
  recordAudit({ actor, action: "user.password.set", targetUserId: userId });
}
