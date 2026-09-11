import { describe, expect, it } from "vitest";
import { inviteDefaults, linkExpiryDays, type InviteLike } from "./defaults";

const base: InviteLike = {
  createdAt: new Date("2026-09-01T10:00:00Z"),
  expiresAt: new Date("2026-09-08T10:00:00Z"),
  maxUses: 1,
  accountExpiryDays: null,
  requireEmail: false,
  profileId: null,
};

describe("linkExpiryDays", () => {
  it("counts whole days to the expiry", () => {
    expect(linkExpiryDays(base)).toBe(7);
  });

  it("reads a missing expiry as never", () => {
    expect(linkExpiryDays({ ...base, expiresAt: null })).toBe(0);
  });

  it("never reports a negative span for an invite that already expired", () => {
    expect(linkExpiryDays({ ...base, expiresAt: new Date("2026-08-30T10:00:00Z") })).toBe(0);
  });
});

describe("inviteDefaults", () => {
  it("falls back to seven days and a single use with no invites yet", () => {
    const d = inviteDefaults(undefined, []);
    expect(d).toMatchObject({ profileId: "", linkExpiryDays: 7, maxUses: 1, accountExpiryDays: "", requireEmail: false });
    expect(d.linkExpiryChoices).toEqual([7, 30, 0]);
    expect(d.usesChoices).toEqual([1, 5, 0]);
  });

  it("repeats the newest invite's terms", () => {
    const d = inviteDefaults({ ...base, maxUses: null, accountExpiryDays: 30, requireEmail: true, profileId: "p1" }, ["p1"]);
    expect(d).toMatchObject({ profileId: "p1", linkExpiryDays: 7, maxUses: 0, accountExpiryDays: "30", requireEmail: true });
  });

  it("drops a profile that no longer exists", () => {
    expect(inviteDefaults({ ...base, profileId: "gone" }, ["p1"]).profileId).toBe("");
  });

  it("keeps an unusual span selectable instead of rounding it", () => {
    const d = inviteDefaults({ ...base, expiresAt: new Date("2026-09-15T10:00:00Z"), maxUses: 3 }, []);
    expect(d.linkExpiryDays).toBe(14);
    expect(d.linkExpiryChoices).toEqual([14, 7, 30, 0]);
    expect(d.usesChoices).toEqual([3, 1, 5, 0]);
  });
});
