import { describe, expect, it } from "vitest";
import spec from "@/lib/jellyfin/openapi.json";
import { JELLYFIN_DEFAULT_MANAGED_POLICY } from "./defaults";
import { diffPolicies, driftDiff, policyValueEqual } from "./diff";
import { PER_USER_FIELDS, POLICY_FIELDS, PROFILE_MANAGED_FIELDS } from "./fields";
import { policyHash } from "./hash";
import { applyProfilePolicy, copyManagedFields, extractManagedFields, mergeEdit, unknownEditKeys } from "./merge";
import { checkProtection } from "./protection";

const live: Record<string, unknown> = {
  IsAdministrator: false,
  IsDisabled: false,
  IsHidden: true,
  EnableAllDevices: false,
  EnabledDevices: ["dev-1"],
  AuthenticationProviderId: "Default",
  PasswordResetProviderId: "Default",
  InvalidLoginAttemptCount: 2,
  LoginAttemptsBeforeLockout: 5,
  EnableAllFolders: false,
  EnabledFolders: ["f1", "f2"],
  EnableMediaPlayback: true,
  MaxActiveSessions: 0,
  RemoteClientBitrateLimit: 0,
  SomeFutureField: { nested: true },
};

describe("classification", () => {
  it("classifies every UserPolicy field as exactly one of profile-managed or per-user", () => {
    const schemaKeys = Object.keys(spec.components.schemas.UserPolicy.properties);
    for (const key of schemaKeys) {
      const managed = PROFILE_MANAGED_FIELDS.includes(key);
      const per = PER_USER_FIELDS.includes(key);
      expect(managed !== per, `${key} must be classified exactly once`).toBe(true);
    }
    expect(PROFILE_MANAGED_FIELDS.length + PER_USER_FIELDS.length).toBe(schemaKeys.length);
    expect(POLICY_FIELDS.every((f) => f.scope === "profile" || f.scope === "user")).toBe(true);
  });

  it("keeps the spec's per-user list per-user", () => {
    for (const k of ["IsAdministrator", "IsDisabled", "IsHidden", "EnableAllDevices", "EnabledDevices", "AuthenticationProviderId", "PasswordResetProviderId", "InvalidLoginAttemptCount", "LoginAttemptsBeforeLockout"]) {
      expect(PER_USER_FIELDS).toContain(k);
    }
  });

  it("default managed policy covers exactly the managed fields", () => {
    expect(Object.keys(JELLYFIN_DEFAULT_MANAGED_POLICY).sort()).toEqual([...PROFILE_MANAGED_FIELDS].sort());
  });
});

describe("merge", () => {
  it("applyProfilePolicy touches only managed fields and passes unknown fields through", () => {
    const profile = { EnableAllFolders: true, EnabledFolders: [], IsAdministrator: true, IsDisabled: true, EnabledDevices: [], Bogus: 1 };
    const out = applyProfilePolicy(live, profile);
    expect(out.EnableAllFolders).toBe(true);
    expect(out.EnabledFolders).toEqual([]);
    // protected / per-user fields preserved
    expect(out.IsAdministrator).toBe(false);
    expect(out.IsDisabled).toBe(false);
    expect(out.IsHidden).toBe(true);
    expect(out.EnabledDevices).toEqual(["dev-1"]);
    expect(out.InvalidLoginAttemptCount).toBe(2);
    // unknown fields preserved, bogus profile key ignored
    expect(out.SomeFutureField).toEqual({ nested: true });
    expect(out).not.toHaveProperty("Bogus");
    // input not mutated
    expect(live.EnableAllFolders).toBe(false);
  });

  it("extractManagedFields snapshots every managed key, null when absent", () => {
    const snap = extractManagedFields(live);
    expect(Object.keys(snap).sort()).toEqual([...PROFILE_MANAGED_FIELDS].sort());
    expect(snap.EnabledFolders).toEqual(["f1", "f2"]);
    expect(snap.MaxParentalRating).toBeNull();
    expect(snap).not.toHaveProperty("IsAdministrator");
  });

  it("mergeEdit writes known keys, ignores unknown keys, keeps the rest", () => {
    const out = mergeEdit(live, { IsHidden: false, EnableMediaPlayback: false, Injected: "x" });
    expect(out.IsHidden).toBe(false);
    expect(out.EnableMediaPlayback).toBe(false);
    expect(out).not.toHaveProperty("Injected");
    expect(out.SomeFutureField).toEqual({ nested: true });
    expect(unknownEditKeys({ IsHidden: 1, Injected: 2 })).toEqual(["Injected"]);
  });

  it("copyManagedFields copies managed fields only", () => {
    const source = { ...live, IsAdministrator: true, EnabledFolders: ["z"], EnabledDevices: ["other"] };
    const out = copyManagedFields(live, source);
    expect(out.EnabledFolders).toEqual(["z"]);
    expect(out.IsAdministrator).toBe(false);
    expect(out.EnabledDevices).toEqual(["dev-1"]);
  });
});

describe("diff", () => {
  it("compares structurally and treats null/undefined alike", () => {
    expect(policyValueEqual([1, 2], [1, 2])).toBe(true);
    expect(policyValueEqual([1, 2], [2, 1])).toBe(false);
    expect(policyValueEqual({ a: 1, b: [1] }, { b: [1], a: 1 })).toBe(true);
    expect(policyValueEqual(null, undefined)).toBe(true);
    expect(policyValueEqual(0, null)).toBe(false);
  });

  it("lists changed keys with before/after", () => {
    const changes = diffPolicies({ a: 1, b: [1], c: null }, { a: 2, b: [1], d: "x" });
    expect(changes).toEqual([
      { key: "a", before: 1, after: 2 },
      { key: "d", before: null, after: "x" },
    ]);
  });

  it("driftDiff only looks at managed keys the profile defines", () => {
    const profile = { EnableAllFolders: true, IsAdministrator: true };
    expect(driftDiff(live, profile)).toEqual([{ key: "EnableAllFolders", before: false, after: true }]);
    expect(driftDiff({ ...live, EnableAllFolders: true }, profile)).toEqual([]);
  });
});

describe("hash", () => {
  it("is order independent and sensitive to values", () => {
    expect(policyHash({ a: 1, b: [1, { c: 2 }] })).toBe(policyHash({ b: [1, { c: 2 }], a: 1 }));
    expect(policyHash({ a: 1 })).not.toBe(policyHash({ a: 2 }));
    expect(policyHash({ a: undefined })).toBe(policyHash({ a: null }));
  });
});

describe("protection", () => {
  const users = [
    { id: "a1", name: "root", isAdmin: true, isDisabled: false },
    { id: "a2", name: "second", isAdmin: true, isDisabled: true },
    { id: "u1", name: "plain", isAdmin: false, isDisabled: false },
  ];
  it("refuses to act on yourself", () => {
    expect(checkProtection(users, "a1", "a1", "disable")).toMatchObject({ allowed: false });
    expect(checkProtection(users, "u1", "u1", "delete")).toMatchObject({ allowed: false });
  });
  it("protects the last enabled administrator", () => {
    expect(checkProtection(users, "a1", "other", "disable")).toMatchObject({ allowed: false });
    expect(checkProtection(users, "a1", "other", "demote")).toMatchObject({ allowed: false });
    expect(checkProtection(users, "a1", "other", "delete")).toMatchObject({ allowed: false });
    expect(checkProtection(users, "a1", null, "disable")).toMatchObject({ allowed: false });
  });
  it("allows acting on an admin when another enabled admin remains", () => {
    const withTwo = users.map((u) => (u.id === "a2" ? { ...u, isDisabled: false } : u));
    expect(checkProtection(withTwo, "a1", "a2", "disable")).toEqual({ allowed: true });
    expect(checkProtection(withTwo, "a2", "a1", "delete")).toEqual({ allowed: true });
  });
  it("allows acting on plain users and on unknown ids", () => {
    expect(checkProtection(users, "u1", "a1", "disable")).toEqual({ allowed: true });
    expect(checkProtection(users, "nope", "a1", "delete")).toEqual({ allowed: true });
  });
});
