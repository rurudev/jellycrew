import { describe, expect, it } from "vitest";
import { activityBasis, computeUserStatus } from "./status";

const now = new Date("2026-09-11T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000);
const base = { disabledByAppAt: null, disabledReason: null, expiresAt: null, deleteAfter: null };

describe("computeUserStatus", () => {
  it("is enabled by default", () => {
    expect(computeUserStatus(false, base, now).kind).toBe("enabled");
    expect(computeUserStatus(false, null, now).kind).toBe("enabled");
  });
  it("reports manual disable", () => {
    expect(computeUserStatus(true, base, now)).toMatchObject({ kind: "disabled", tone: "destructive" });
  });
  it("reports app-disabled with reason", () => {
    const s = computeUserStatus(true, { ...base, disabledByAppAt: days(-1), disabledReason: "inactive" }, now);
    expect(s).toMatchObject({ kind: "disabled_by_app", reason: "inactive" });
    expect(s.label).toContain("inactive");
  });
  it("ignores a stale disabled_by_app marker when the user is enabled again", () => {
    const s = computeUserStatus(false, { ...base, disabledByAppAt: days(-1), disabledReason: "expired" }, now);
    expect(s.kind).toBe("enabled");
  });
  it("flags expiry within 7 days and past expiry", () => {
    expect(computeUserStatus(false, { ...base, expiresAt: days(3) }, now).kind).toBe("expiring");
    expect(computeUserStatus(false, { ...base, expiresAt: days(7) }, now).kind).toBe("expiring");
    expect(computeUserStatus(false, { ...base, expiresAt: days(8) }, now).kind).toBe("enabled");
    expect(computeUserStatus(false, { ...base, expiresAt: days(-1) }, now).kind).toBe("expired");
  });
  it("puts scheduled deletion above everything else", () => {
    const s = computeUserStatus(true, { ...base, deleteAfter: days(10), disabledByAppAt: days(-1), disabledReason: "manual" }, now);
    expect(s.kind).toBe("deletion_scheduled");
    expect(s.at).toEqual(days(10));
  });
});

describe("activityBasis", () => {
  it("prefers activity, then login, then first seen", () => {
    expect(activityBasis(days(-1), days(-2), days(-3))).toEqual(days(-1));
    expect(activityBasis(null, days(-2), days(-3))).toEqual(days(-2));
    expect(activityBasis(null, null, days(-3))).toEqual(days(-3));
  });
});
