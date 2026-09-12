import { describe, expect, it } from "vitest";
import { lifecycleSummary } from "./summary";

describe("lifecycleSummary", () => {
  it("has nothing to say about a job that never ran", () => {
    expect(lifecycleSummary(null)).toBeNull();
    expect(lifecycleSummary(undefined)).toBeNull();
    expect(lifecycleSummary("not a run")).toBeNull();
  });

  it("says so when a run changed nothing", () => {
    const s = lifecycleSummary({ at: "2026-09-12T00:00:00Z", scanned: 12, disabled: [], deleted: [], errors: [], skippedAdmins: 1 })!;
    expect(s.sentence).toBe("checked 12 accounts, nothing needed doing");
    expect(s.tone).toBe("success");
    expect(s.skippedAdmins).toBe(1);
  });

  it("counts what it did, singular and plural", () => {
    const s = lifecycleSummary({ scanned: 1, disabled: [{ userId: "u1", name: "bob", reason: "expired" }], deleted: [], errors: [] })!;
    expect(s.sentence).toBe("checked 1 account: 1 account disabled");
    const many = lifecycleSummary({ scanned: 9, disabled: [{ userId: "u1", name: "a", reason: "expired" }, { userId: "u2", name: "b", reason: "inactive" }], deleted: [{ userId: "u3", name: "c" }], errors: [] })!;
    expect(many.sentence).toBe("checked 9 accounts: 2 accounts disabled, 1 account deleted");
  });

  it("treats errors as something to look at", () => {
    const s = lifecycleSummary({ scanned: 4, disabled: [], deleted: [], errors: [{ userId: "u1", name: "carol", error: "Jellyfin refused" }] })!;
    expect(s.sentence).toBe("checked 4 accounts: 1 error");
    expect(s.tone).toBe("warning");
    expect(s.errors[0]).toEqual({ name: "carol", error: "Jellyfin refused" });
  });

  it("survives a result that is missing fields", () => {
    const s = lifecycleSummary({ scanned: 3 })!;
    expect(s.sentence).toBe("checked 3 accounts, nothing needed doing");
    expect(s.disabled).toEqual([]);
  });
});
