import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme, themeLabel } from "./theme";

describe("parseTheme", () => {
  it("accepts the two known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
  it("treats anything else as system", () => {
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme("auto")).toBeNull();
    expect(parseTheme("DARK")).toBeNull();
  });
});

describe("nextTheme", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextTheme(null)).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBeNull();
  });
});

describe("themeLabel", () => {
  it("names every state", () => {
    expect(themeLabel(null)).toBe("System");
    expect(themeLabel("light")).toBe("Light");
    expect(themeLabel("dark")).toBe("Dark");
  });
});
