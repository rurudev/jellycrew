import { JELLYFIN_DEFAULT_MANAGED_POLICY } from "./defaults";
import { policyValueEqual } from "./diff";
import { POLICY_FIELDS, POLICY_GROUPS, type PolicyFieldDef, type PolicyGroupId } from "./fields";

/**
 * Jellyfin 10.11's new-user values for the per-user fields (the managed ones live in
 * defaults.ts). Only used to decide which fields are worth surfacing first; never written.
 */
export const PER_USER_DEFAULTS: Record<string, unknown> = {
  IsAdministrator: false,
  IsDisabled: false,
  IsHidden: true,
  EnableAllDevices: true,
  EnabledDevices: [],
  AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
  PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
  InvalidLoginAttemptCount: 0,
  LoginAttemptsBeforeLockout: -1,
};

export interface SummaryRow {
  field: PolicyFieldDef;
  value: unknown;
  /** The assigned profile defines this field and the live value differs from it. */
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
}

function defaultFor(key: string): unknown {
  return key in JELLYFIN_DEFAULT_MANAGED_POLICY ? JELLYFIN_DEFAULT_MANAGED_POLICY[key] : PER_USER_DEFAULTS[key];
}

/**
 * What an admin needs to see first: every catalogued field whose live value differs from the
 * assigned profile (drift) or from Jellyfin's new-user default. Everything else is default and
 * can stay folded away.
 */
export function summarizePolicy(live: Record<string, unknown>, profilePolicy: Record<string, unknown> | null): PolicySummary {
  const groups: SummaryGroup[] = [];
  let highlighted = 0;
  for (const g of POLICY_GROUPS) {
    const rows: SummaryRow[] = [];
    for (const field of POLICY_FIELDS) {
      if (field.group !== g.id) continue;
      const value = live[field.key];
      const drift = profilePolicy !== null && field.key in profilePolicy && !policyValueEqual(value, profilePolicy[field.key]);
      const nonDefault = !policyValueEqual(value, defaultFor(field.key));
      if (drift || nonDefault) rows.push({ field, value, drift, nonDefault });
    }
    if (rows.length) {
      groups.push({ id: g.id, title: g.title, rows });
      highlighted += rows.length;
    }
  }
  return { groups, highlighted, total: POLICY_FIELDS.length };
}
