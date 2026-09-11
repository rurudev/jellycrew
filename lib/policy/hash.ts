import { createHash } from "node:crypto";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value === undefined ? null : value;
}

/** Stable SHA-256 of a policy, independent of key order. Used for stale-write detection. */
export function policyHash(policy: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonical(policy))).digest("hex");
}
