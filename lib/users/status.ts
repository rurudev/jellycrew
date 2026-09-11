import type { DisabledReason, UserMeta } from "@/lib/db/schema";
import { daysBetween } from "@/lib/format";

export type UserStatusKind = "enabled" | "disabled" | "disabled_by_app" | "expiring" | "expired" | "deletion_scheduled";

export interface UserStatus {
  kind: UserStatusKind;
  label: string;
  /** Meaning, not colour: the badge maps it to the theme. */
  tone: "success" | "warning" | "destructive" | "neutral";
  reason?: DisabledReason;
  /** The relevant date: expiry or deletion date. */
  at?: Date;
}

export const EXPIRING_SOON_DAYS = 7;

type MetaBits = Pick<UserMeta, "disabledByAppAt" | "disabledReason" | "expiresAt" | "deleteAfter">;

const reasonLabel: Record<DisabledReason, string> = {
  expired: "Disabled (expired)",
  inactive: "Disabled (inactive)",
  manual: "Disabled by admin",
};

/** Derives the single status shown in lists. Precedence: deletion > disabled > expiry > enabled. */
export function computeUserStatus(isDisabled: boolean, meta: MetaBits | null | undefined, now: Date = new Date()): UserStatus {
  if (meta?.deleteAfter) {
    return { kind: "deletion_scheduled", label: "Deletion scheduled", tone: "destructive", at: meta.deleteAfter };
  }
  if (isDisabled) {
    if (meta?.disabledByAppAt && meta.disabledReason) {
      return { kind: "disabled_by_app", label: reasonLabel[meta.disabledReason], tone: "destructive", reason: meta.disabledReason, at: meta.disabledByAppAt };
    }
    return { kind: "disabled", label: "Disabled", tone: "destructive" };
  }
  if (meta?.expiresAt) {
    const days = daysBetween(meta.expiresAt, now);
    if (days <= 0) return { kind: "expired", label: "Expired", tone: "warning", at: meta.expiresAt };
    if (days <= EXPIRING_SOON_DAYS) return { kind: "expiring", label: "Expires soon", tone: "warning", at: meta.expiresAt };
  }
  return { kind: "enabled", label: "Enabled", tone: "success" };
}

/**
 * The date inactivity is measured from: last activity, else last login, else when the
 * app first saw the user.
 */
export function activityBasis(lastActivity: Date | null, lastLogin: Date | null, firstSeenAt: Date): Date {
  return lastActivity ?? lastLogin ?? firstSeenAt;
}
