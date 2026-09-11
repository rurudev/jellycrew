import { JELLYFIN_DEFAULT_POLICY } from "./defaults";
import { policyValueEqual } from "./diff";
import { POLICY_FIELDS, POLICY_GROUPS, type PolicyFieldDef, type PolicyGroupId } from "./fields";

export interface SummaryRow {
  field: PolicyFieldDef;
  value: unknown;
  /** The live value differs from the assigned profile (per the caller's drift diff). */
  drift: boolean;
  /** The live value differs from Jellyfin's new-user default. */
  nonDefault: boolean;
}

export interface SummaryGroup {
  id: PolicyGroupId;
  title: string;
  rows: SummaryRow[];
}

export interface PolicySummary {
  /** Groups that have at least one row to show, in catalogue order. */
  groups: SummaryGroup[];
  highlighted: number;
  total: number;
  /** Keys Jellyfin returned that the catalogue does not know. Never hidden. */
  unknown: Record<string, unknown>;
}

/**
 * What an admin needs to see first: every catalogued field whose live value drifts from the
 * assigned profile (`drift` is the key set of the page's drift diff, so both sections agree)
 * or differs from Jellyfin's new-user default. Everything else can stay folded away.
 */
export function summarizePolicy(live: Record<string, unknown>, drift: ReadonlySet<string>): PolicySummary {
  const groups: SummaryGroup[] = [];
  const known = new Set<string>();
  let highlighted = 0;
  for (const g of POLICY_GROUPS) {
    const rows: SummaryRow[] = [];
    for (const field of POLICY_FIELDS) {
      if (field.group !== g.id) continue;
      known.add(field.key);
      const value = live[field.key];
      const drifted = drift.has(field.key);
      const nonDefault = !policyValueEqual(value, JELLYFIN_DEFAULT_POLICY[field.key]);
      if (drifted || nonDefault) rows.push({ field, value, drift: drifted, nonDefault });
    }
    if (rows.length) {
      groups.push({ id: g.id, title: g.title, rows });
      highlighted += rows.length;
    }
  }
  const unknown = Object.fromEntries(Object.entries(live).filter(([k]) => !known.has(k)));
  return { groups, highlighted, total: POLICY_FIELDS.length, unknown };
}
