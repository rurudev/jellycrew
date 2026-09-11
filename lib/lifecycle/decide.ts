import { daysBetween } from "@/lib/format";
import type { DisabledReason } from "@/lib/db/schema";

export interface LifecycleInput {
  userId: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  expiresAt: Date | null;
  /** Effective rule: the user's own value, else the profile's, else null (never). */
  inactivityDisableDays: number | null;
  /** Date inactivity is measured from (last activity → last login → first seen). */
  activityBasis: Date;
  deleteAfter: Date | null;
  disabledReason: DisabledReason | null;
}

export type LifecycleDecision =
  | { action: "delete"; why: string }
  | { action: "disable"; reason: "expired" | "inactive"; why: string }
  | { action: "none"; why: string };

/**
 * Pure decision for one user at time `now`. Administrators are never touched. Deletion
 * (past the grace period) wins over disabling; expiry wins over inactivity.
 */
export function decideLifecycle(u: LifecycleInput, now: Date): LifecycleDecision {
  if (u.isAdmin) return { action: "none", why: "administrator" };
  if (u.deleteAfter && u.deleteAfter.getTime() <= now.getTime()) {
    return { action: "delete", why: `grace period ended ${u.deleteAfter.toISOString()}` };
  }
  if (u.deleteAfter) return { action: "none", why: "deletion scheduled, grace period running" };
  if (u.isDisabled) return { action: "none", why: "already disabled" };
  if (u.expiresAt && u.expiresAt.getTime() <= now.getTime()) {
    return { action: "disable", reason: "expired", why: `expired ${u.expiresAt.toISOString()}` };
  }
  if (u.inactivityDisableDays !== null && u.inactivityDisableDays > 0) {
    const idle = daysBetween(now, u.activityBasis);
    if (idle >= u.inactivityDisableDays) {
      return { action: "disable", reason: "inactive", why: `inactive for ${Math.floor(idle)} days (limit ${u.inactivityDisableDays})` };
    }
  }
  return { action: "none", why: "nothing due" };
}

/** The user's own inactivity rule overrides the profile's; null means never. */
export function effectiveInactivityDays(userDays: number | null | undefined, profileDays: number | null | undefined): number | null {
  if (userDays !== null && userDays !== undefined) return userDays;
  if (profileDays !== null && profileDays !== undefined) return profileDays;
  return null;
}
