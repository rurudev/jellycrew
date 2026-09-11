import { describe, expect, it } from "vitest";
import { POLICY_FIELDS } from "./fields";
import { parseGroupedPolicyForm, parseRawPolicyJson } from "./form";

function form(entries: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return fd;
}

describe("policy form parsing", () => {
  it("reads every field kind and treats absent checkboxes as false", () => {
    const edit = parseGroupedPolicyForm(
      form({
        EnableMediaPlayback: "on",
        RemoteClientBitrateLimit: "2000000",
        BlockedTags: "horror, gore\nviolence",
        EnabledFolders: ["f1", "f2"],
        MaxParentalRating: "10",
        SyncPlayAccess: "None",
        BlockUnratedItems: ["Movie"],
        AccessSchedules: '[{"DayOfWeek":"Weekend","StartHour":8,"EndHour":20.5}]',
        AuthenticationProviderId: "prov",
      }),
      "all",
    );
    expect(Object.keys(edit).sort()).toEqual(POLICY_FIELDS.map((f) => f.key).sort());
    expect(edit.EnableMediaPlayback).toBe(true);
    expect(edit.EnableRemoteAccess).toBe(false);
    expect(edit.RemoteClientBitrateLimit).toBe(2_000_000);
    expect(edit.MaxActiveSessions).toBe(0);
    expect(edit.BlockedTags).toEqual(["horror", "gore", "violence"]);
    expect(edit.EnabledFolders).toEqual(["f1", "f2"]);
    expect(edit.EnabledDevices).toEqual([]);
    expect(edit.MaxParentalRating).toBe(10);
    expect(edit.MaxParentalSubRating).toBeNull();
    expect(edit.SyncPlayAccess).toBe("None");
    expect(edit.BlockUnratedItems).toEqual(["Movie"]);
    expect(edit.AccessSchedules).toEqual([{ DayOfWeek: "Weekend", StartHour: 8, EndHour: 20.5 }]);
    expect(edit.AuthenticationProviderId).toBe("prov");
  });

  it("limits profile scope to managed fields", () => {
    const edit = parseGroupedPolicyForm(form({ SyncPlayAccess: "JoinGroups" }), "profile");
    expect(edit).not.toHaveProperty("IsAdministrator");
    expect(edit).toHaveProperty("EnableMediaPlayback");
  });

  it("rejects bad numbers, schedules and sync play values", () => {
    expect(() => parseGroupedPolicyForm(form({ RemoteClientBitrateLimit: "abc", SyncPlayAccess: "None" }), "all")).toThrow(/whole number/);
    expect(() => parseGroupedPolicyForm(form({ AccessSchedules: "nope", SyncPlayAccess: "None" }), "all")).toThrow(/JSON array/);
    expect(() => parseGroupedPolicyForm(form({ AccessSchedules: '[{"DayOfWeek":"Funday","StartHour":1,"EndHour":2}]', SyncPlayAccess: "None" }), "all")).toThrow(/Access schedules/);
    expect(() => parseGroupedPolicyForm(form({ SyncPlayAccess: "Whatever" }), "all")).toThrow(/SyncPlay/);
  });

  it("validates raw JSON against the catalog and keeps unknown keys", () => {
    const obj = parseRawPolicyJson('{"EnableMediaPlayback": false, "Future": 1, "EnabledFolders": ["a"]}');
    expect(obj).toEqual({ EnableMediaPlayback: false, Future: 1, EnabledFolders: ["a"] });
    expect(() => parseRawPolicyJson("[]")).toThrow(/object/);
    expect(() => parseRawPolicyJson("{")).toThrow(/valid JSON/);
    expect(() => parseRawPolicyJson('{"EnableMediaPlayback": "yes"}')).toThrow(/true or false/);
    expect(() => parseRawPolicyJson('{"EnabledFolders": "f1"}')).toThrow(/array of strings/);
    expect(() => parseRawPolicyJson('{"SyncPlayAccess": "Nope"}')).toThrow(/expected one of/);
  });
});
