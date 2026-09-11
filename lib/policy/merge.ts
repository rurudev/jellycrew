import { PROFILE_MANAGED_FIELDS, PER_USER_FIELDS, POLICY_FIELD_BY_KEY } from "./fields";

const managed = new Set(PROFILE_MANAGED_FIELDS);
const perUser = new Set(PER_USER_FIELDS);

/** The profile-managed subset of a live policy (a profile snapshot). */
export function extractManagedFields(live: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_MANAGED_FIELDS) {
    out[key] = key in live ? live[key] : null;
  }
  return out;
}

/**
 * Applies a profile onto a freshly fetched live policy. Only profile-managed keys that the
 * profile defines are overwritten; per-user fields and unknown fields pass through untouched.
 */
export function applyProfilePolicy(live: Record<string, unknown>, profilePolicy: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...live };
  for (const [key, value] of Object.entries(profilePolicy)) {
    if (managed.has(key)) out[key] = value;
  }
  return out;
}

/**
 * Applies an editor submission onto a live policy. Every submitted key that the catalog
 * knows (managed or per-user) is written; keys the catalog does not know are ignored so
 * that a stale client cannot inject arbitrary fields. Live keys not submitted stay as they are.
 */
export function mergeEdit(live: Record<string, unknown>, edit: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...live };
  for (const [key, value] of Object.entries(edit)) {
    if (managed.has(key) || perUser.has(key)) out[key] = value;
  }
  return out;
}

/** Keys in `edit` that are neither managed nor per-user (would be dropped by mergeEdit). */
export function unknownEditKeys(edit: Record<string, unknown>): string[] {
  return Object.keys(edit).filter((k) => !POLICY_FIELD_BY_KEY.has(k));
}

/** Copies the profile-managed fields of one live policy onto another (copy policy from user). */
export function copyManagedFields(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  return applyProfilePolicy(target, extractManagedFields(source));
}
