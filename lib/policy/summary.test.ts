import { describe, expect, it } from "vitest";
import { JELLYFIN_DEFAULT_MANAGED_POLICY } from "./defaults";
import { POLICY_FIELDS } from "./fields";
import { PER_USER_DEFAULTS, summarizePolicy } from "./summary";

const defaults = { ...JELLYFIN_DEFAULT_MANAGED_POLICY, ...PER_USER_DEFAULTS };

describe("summarizePolicy", () => {
  it("covers every catalogued field with a default", () => {
    for (const f of POLICY_FIELDS) expect(f.key in defaults, f.key).toBe(true);
  });

  it("surfaces nothing for a brand-new user without a profile", () => {
    const s = summarizePolicy(defaults, null);
    expect(s.highlighted).toBe(0);
    expect(s.groups).toEqual([]);
    expect(s.total).toBe(POLICY_FIELDS.length);
  });

  it("surfaces fields that differ from the defaults, grouped in catalogue order", () => {
    const s = summarizePolicy({ ...defaults, IsAdministrator: true, EnableRemoteAccess: false }, null);
    expect(s.highlighted).toBe(2);
    expect(s.groups.map((g) => g.id)).toEqual(["remote", "admin"]);
    const remote = s.groups[0]!.rows[0]!;
    expect(remote.field.key).toBe("EnableRemoteAccess");
    expect(remote).toMatchObject({ value: false, drift: false, nonDefault: true });
  });

  it("marks drift against the assigned profile even when the live value is the default", () => {
    const profile = { ...JELLYFIN_DEFAULT_MANAGED_POLICY, EnableRemoteAccess: false };
    const s = summarizePolicy(defaults, profile);
    expect(s.highlighted).toBe(1);
    expect(s.groups[0]!.rows[0]).toMatchObject({ drift: true, nonDefault: false, value: true });
  });

  it("does not report drift for fields the profile leaves undefined", () => {
    const s = summarizePolicy({ ...defaults, EnableRemoteAccess: false }, { EnableMediaPlayback: true });
    expect(s.groups[0]!.rows[0]).toMatchObject({ drift: false, nonDefault: true });
  });

  it("treats null and undefined as the same unset value", () => {
    const s = summarizePolicy({ ...defaults, MaxParentalRating: undefined }, null);
    expect(s.highlighted).toBe(0);
  });
});
