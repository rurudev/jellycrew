import { describe, expect, it } from "vitest";
import { JELLYFIN_DEFAULT_POLICY } from "./defaults";
import { POLICY_FIELDS } from "./fields";
import { summarizePolicy } from "./summary";

const none = new Set<string>();

describe("summarizePolicy", () => {
  it("surfaces nothing for a brand-new user", () => {
    const s = summarizePolicy(JELLYFIN_DEFAULT_POLICY, none);
    expect(s.highlighted).toBe(0);
    expect(s.groups).toEqual([]);
    expect(s.total).toBe(POLICY_FIELDS.length);
    expect(s.unknown).toEqual({});
  });

  it("surfaces fields that differ from the defaults, grouped in catalogue order", () => {
    const s = summarizePolicy({ ...JELLYFIN_DEFAULT_POLICY, IsAdministrator: true, EnableRemoteAccess: false }, none);
    expect(s.highlighted).toBe(2);
    expect(s.groups.map((g) => g.id)).toEqual(["remote", "admin"]);
    const remote = s.groups[0]!.rows[0]!;
    expect(remote.field.key).toBe("EnableRemoteAccess");
    expect(remote).toMatchObject({ value: false, drift: false, nonDefault: true });
  });

  it("marks drift from the caller's diff even when the live value is the default", () => {
    const s = summarizePolicy(JELLYFIN_DEFAULT_POLICY, new Set(["EnableRemoteAccess"]));
    expect(s.highlighted).toBe(1);
    expect(s.groups[0]!.rows[0]).toMatchObject({ drift: true, nonDefault: false, value: true });
  });

  it("ignores drift keys the catalogue does not know", () => {
    const s = summarizePolicy(JELLYFIN_DEFAULT_POLICY, new Set(["SomethingElse"]));
    expect(s.highlighted).toBe(0);
  });

  it("treats null and undefined as the same unset value", () => {
    const s = summarizePolicy({ ...JELLYFIN_DEFAULT_POLICY, MaxParentalRating: undefined }, none);
    expect(s.highlighted).toBe(0);
  });

  it("reports keys outside the catalogue so they are never hidden", () => {
    const s = summarizePolicy({ ...JELLYFIN_DEFAULT_POLICY, EnableNewThing: true }, none);
    expect(s.unknown).toEqual({ EnableNewThing: true });
    expect(s.highlighted).toBe(0);
  });
});
