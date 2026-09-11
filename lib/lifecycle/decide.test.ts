import { describe, expect, it } from "vitest";
import { decideLifecycle, effectiveInactivityDays, type LifecycleInput } from "./decide";

const now = new Date("2026-09-11T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

function input(over: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    userId: "u",
    name: "u",
    isAdmin: false,
    isDisabled: false,
    expiresAt: null,
    inactivityDisableDays: null,
    activityBasis: days(-1),
    deleteAfter: null,
    disabledReason: null,
    ...over,
  };
}

describe("decideLifecycle (fixed clock)", () => {
  it("does nothing for a healthy user", () => {
    expect(decideLifecycle(input(), now)).toEqual({ action: "none", why: "nothing due" });
  });

  it("never touches administrators, whatever is due", () => {
    expect(decideLifecycle(input({ isAdmin: true, expiresAt: days(-10), deleteAfter: days(-1), inactivityDisableDays: 1, activityBasis: days(-400) }), now)).toEqual({ action: "none", why: "administrator" });
  });

  it("disables at expiry, inclusive of the exact moment", () => {
    expect(decideLifecycle(input({ expiresAt: days(-1) }), now)).toMatchObject({ action: "disable", reason: "expired" });
    expect(decideLifecycle(input({ expiresAt: now }), now)).toMatchObject({ action: "disable", reason: "expired" });
    expect(decideLifecycle(input({ expiresAt: days(1) }), now)).toMatchObject({ action: "none" });
  });

  it("disables inactive users by the effective rule", () => {
    expect(decideLifecycle(input({ inactivityDisableDays: 30, activityBasis: days(-31) }), now)).toMatchObject({ action: "disable", reason: "inactive" });
    expect(decideLifecycle(input({ inactivityDisableDays: 30, activityBasis: days(-30) }), now)).toMatchObject({ action: "disable", reason: "inactive" });
    expect(decideLifecycle(input({ inactivityDisableDays: 30, activityBasis: days(-29.5) }), now)).toMatchObject({ action: "none" });
    expect(decideLifecycle(input({ inactivityDisableDays: null, activityBasis: days(-1000) }), now)).toMatchObject({ action: "none" });
    expect(decideLifecycle(input({ inactivityDisableDays: 0, activityBasis: days(-1000) }), now)).toMatchObject({ action: "none" });
  });

  it("prefers expiry over inactivity and skips already disabled users", () => {
    expect(decideLifecycle(input({ expiresAt: days(-1), inactivityDisableDays: 1, activityBasis: days(-5) }), now)).toMatchObject({ reason: "expired" });
    expect(decideLifecycle(input({ isDisabled: true, expiresAt: days(-1) }), now)).toEqual({ action: "none", why: "already disabled" });
  });

  it("deletes once the grace period has ended, and waits while it runs", () => {
    expect(decideLifecycle(input({ isDisabled: true, deleteAfter: days(-0.01) }), now)).toMatchObject({ action: "delete" });
    expect(decideLifecycle(input({ isDisabled: true, deleteAfter: now }), now)).toMatchObject({ action: "delete" });
    expect(decideLifecycle(input({ isDisabled: true, deleteAfter: days(3) }), now)).toEqual({ action: "none", why: "deletion scheduled, grace period running" });
    // deletion wins even over an expiry that is also due
    expect(decideLifecycle(input({ deleteAfter: days(-1), expiresAt: days(-2) }), now)).toMatchObject({ action: "delete" });
  });

  it("resolves the effective inactivity rule", () => {
    expect(effectiveInactivityDays(10, 30)).toBe(10);
    expect(effectiveInactivityDays(null, 30)).toBe(30);
    expect(effectiveInactivityDays(undefined, null)).toBeNull();
  });
});
