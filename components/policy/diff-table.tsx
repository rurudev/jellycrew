import { POLICY_FIELD_BY_KEY } from "@/lib/policy/fields";
import type { FieldChange } from "@/lib/policy/diff";

function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "none";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Before/after table for a list of field changes. */
export function DiffTable({ changes, beforeLabel = "Before", afterLabel = "After", empty = "No differences." }: { changes: FieldChange[]; beforeLabel?: string; afterLabel?: string; empty?: string }) {
  if (changes.length === 0) return <p className="text-zinc-500">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-zinc-500">
          <th className="py-1 pr-2">Field</th>
          <th className="py-1 pr-2">{beforeLabel}</th>
          <th className="py-1">{afterLabel}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => {
          const def = POLICY_FIELD_BY_KEY.get(c.key);
          return (
            <tr key={c.key} className="border-t border-zinc-100 align-top dark:border-zinc-900">
              <td className="py-1 pr-2">
                <div>{def?.label ?? c.key}</div>
                <code className="text-[11px] text-zinc-400">{c.key}</code>
              </td>
              <td className="py-1 pr-2 break-all text-red-700 dark:text-red-300">{show(c.before)}</td>
              <td className="py-1 break-all text-green-700 dark:text-green-300">{show(c.after)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
