import { PROFILE_MANAGED_FIELDS } from "./fields";

export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
}

/** Structural equality that treats null and undefined as the same "unset" value. */
export function policyValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => policyValueEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => policyValueEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Per-key differences between two policies over `keys` (default: the union of both key sets). */
export function diffPolicies(before: Record<string, unknown>, after: Record<string, unknown>, keys?: readonly string[]): FieldChange[] {
  const ks = keys ?? [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const out: FieldChange[] = [];
  for (const key of ks) {
    const a = before[key];
    const b = after[key];
    if (!policyValueEqual(a, b)) out.push({ key, before: a ?? null, after: b ?? null });
  }
  return out;
}

/**
 * Drift: how the user's live profile-managed fields differ from the assigned profile.
 * Only fields the profile defines are compared. `before` is live, `after` is the profile.
 */
export function driftDiff(live: Record<string, unknown>, profilePolicy: Record<string, unknown>): FieldChange[] {
  const keys = PROFILE_MANAGED_FIELDS.filter((k) => k in profilePolicy);
  return diffPolicies(live, profilePolicy, keys);
}
