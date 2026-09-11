import { POLICY_FIELD_BY_KEY } from "@/lib/policy/fields";
import type { FieldChange } from "@/lib/policy/diff";

/** Plain-text rendering of a policy value, for diffs and compact lists. */
export function showPolicyValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "none";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Before/after table for a list of field changes. Small enough to live inside a callout. */
export function DiffTable({ changes, beforeLabel = "Before", afterLabel = "After", empty = "No differences." }: { changes: FieldChange[]; beforeLabel?: string; afterLabel?: string; empty?: string }) {
  if (changes.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 pr-2 font-medium">Field</th>
          <th className="py-1 pr-2 font-medium">{beforeLabel}</th>
          <th className="py-1 font-medium">{afterLabel}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => {
          const def = POLICY_FIELD_BY_KEY.get(c.key);
          return (
            <tr key={c.key} className="border-t border-border align-top">
              <td className="py-1 pr-2">
                <div>{def?.label ?? c.key}</div>
                <code className="text-xs text-muted-foreground">{c.key}</code>
              </td>
              <td className="py-1 pr-2 break-all text-destructive">{showPolicyValue(c.before)}</td>
              <td className="py-1 break-all text-success">{showPolicyValue(c.after)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
