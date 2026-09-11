import { describe, expect, it } from "vitest";
import { generateToken, hashToken, hashesEqual, isTokenShaped } from "./tokens";

describe("tokens", () => {
  it("generates 128-bit base64url tokens that hash deterministically", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(isTokenShaped(t)).toBe(true);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toBe(hashToken(t + "x"));
  });
  it("compares hashes in constant time and rejects malformed input", () => {
    const h = hashToken("a");
    expect(hashesEqual(h, h)).toBe(true);
    expect(hashesEqual(h, hashToken("b"))).toBe(false);
    expect(hashesEqual(h, "")).toBe(false);
    expect(hashesEqual(h, h.slice(2))).toBe(false);
    expect(isTokenShaped("../etc")).toBe(false);
  });
});
