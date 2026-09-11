import { describe, expect, it } from "vitest";
import { JELLYFIN_TARGET_VERSION, isCompatibleVersion, majorMinor } from "./version";
import spec from "./openapi.json";

describe("jellyfin version", () => {
  it("extracts major.minor", () => {
    expect(majorMinor("10.11.11")).toBe("10.11");
    expect(majorMinor("10.12.0-rc1")).toBe("10.12");
    expect(majorMinor(null)).toBeNull();
    expect(majorMinor("garbage")).toBeNull();
  });

  it("accepts same minor, rejects others", () => {
    expect(isCompatibleVersion(JELLYFIN_TARGET_VERSION)).toBe(true);
    expect(isCompatibleVersion("10.11.0")).toBe(true);
    expect(isCompatibleVersion("10.10.7")).toBe(false);
    expect(isCompatibleVersion("11.0.0")).toBe(false);
    expect(isCompatibleVersion(undefined)).toBe(false);
  });

  it("pins the same version as the committed OpenAPI snapshot", () => {
    expect(spec.info.version).toBe(JELLYFIN_TARGET_VERSION);
  });
});
