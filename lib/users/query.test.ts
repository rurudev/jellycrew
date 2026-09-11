import { describe, expect, it } from "vitest";
import type { UserMeta } from "@/lib/db/schema";
import { computeUserStatus } from "./status";
import type { UserRow } from "./types";
import { applyUsersQuery, parseUsersQuery, usersQueryToParams } from "./query";

const now = new Date("2026-09-11T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000);

function row(over: Partial<UserRow> & { name: string }): UserRow {
  const meta = {
    jellyfinUserId: over.name,
    email: null,
    emailVerifiedAt: null,
    notes: null,
    labels: over.labels ?? [],
    profileId: over.profileId ?? null,
    expiresAt: over.expiresAt ?? null,
    inactivityDisableDays: null,
    disabledByAppAt: null,
    disabledReason: null,
    deleteAfter: null,
    createdViaInviteId: null,
    firstSeenAt: daysAgo(100),
    updatedAt: now,
  } satisfies UserMeta;
  const isDisabled = over.isDisabled ?? false;
  return {
    id: over.name,
    isAdmin: false,
    isDisabled,
    isHidden: false,
    imageTag: null,
    status: computeUserStatus(isDisabled, meta, now),
    profileId: meta.profileId,
    profileName: null,
    drift: null,
    lastLogin: null,
    lastActivity: null,
    activityBasis: over.activityBasis ?? daysAgo(1),
    activeSessions: 0,
    deviceCount: 0,
    expiresAt: meta.expiresAt,
    labels: meta.labels,
    meta,
    ...over,
  };
}

describe("parseUsersQuery", () => {
  it("applies defaults", () => {
    expect(parseUsersQuery({})).toEqual({ q: "", sort: "name", dir: "asc" });
  });
  it("drops invalid values without resetting valid ones", () => {
    const q = parseUsersQuery({ sort: "bogus", dir: "desc", inactive: "abc", status: "disabled" });
    expect(q.sort).toBe("name");
    expect(q.dir).toBe("desc");
    expect(q.inactive).toBeUndefined();
    expect(q.status).toBe("disabled");
  });
  it("round-trips through search params", () => {
    const q = parseUsersQuery({ q: "al", sort: "lastLogin", dir: "desc", label: "family", inactive: "30", profile: "none" });
    const params = usersQueryToParams(q);
    expect(parseUsersQuery(Object.fromEntries(params))).toEqual(q);
  });
});

describe("applyUsersQuery", () => {
  const rows = [
    row({ name: "bob", activeSessions: 2, labels: ["family"], activityBasis: daysAgo(40) }),
    row({ name: "Alice", isAdmin: true, deviceCount: 3 }),
    row({ name: "carol", isDisabled: true, expiresAt: daysAgo(-3) }),
    row({ name: "dave", profileId: "p1", lastLogin: daysAgo(2) }),
  ];

  it("sorts by name case-insensitively with direction", () => {
    expect(applyUsersQuery(rows, parseUsersQuery({}), now).map((r) => r.name)).toEqual(["Alice", "bob", "carol", "dave"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ dir: "desc" }), now).map((r) => r.name)).toEqual(["dave", "carol", "bob", "Alice"]);
  });
  it("sorts numerically and by status rank", () => {
    expect(applyUsersQuery(rows, parseUsersQuery({ sort: "sessions", dir: "desc" }), now)[0].name).toBe("bob");
    expect(applyUsersQuery(rows, parseUsersQuery({ sort: "devices", dir: "desc" }), now)[0].name).toBe("Alice");
    expect(applyUsersQuery(rows, parseUsersQuery({ sort: "status" }), now)[0].name).toBe("carol");
    expect(applyUsersQuery(rows, parseUsersQuery({ sort: "lastLogin", dir: "desc" }), now)[0].name).toBe("dave");
  });
  it("filters by search, status, label, profile and inactivity", () => {
    expect(applyUsersQuery(rows, parseUsersQuery({ q: "AL" }), now).map((r) => r.name)).toEqual(["Alice"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ status: "disabled" }), now).map((r) => r.name)).toEqual(["carol"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ status: "admin" }), now).map((r) => r.name)).toEqual(["Alice"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ label: "family" }), now).map((r) => r.name)).toEqual(["bob"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ profile: "p1" }), now).map((r) => r.name)).toEqual(["dave"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ profile: "none" }), now).map((r) => r.name)).toEqual(["Alice", "bob", "carol"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ inactive: "30" }), now).map((r) => r.name)).toEqual(["bob"]);
    expect(applyUsersQuery(rows, parseUsersQuery({ drift: "no" }), now)).toHaveLength(4);
    expect(applyUsersQuery(rows, parseUsersQuery({ drift: "yes" }), now)).toHaveLength(0);
  });
});
