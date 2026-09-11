import { describe, expect, it } from "vitest";
import { THEMES, nextTheme, parseTheme, themeCookie, themeLabel } from "./theme";

describe("parseTheme", () => {
  it("accepts every known theme", () => {
    for (const t of THEMES) expect(parseTheme(t)).toBe(t);
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

describe("themeCookie", () => {
  it("sets a one-year cookie for a chosen theme", () => {
    expect(themeCookie("dark", false)).toBe("jellycrew_theme=dark; Max-Age=31536000; Path=/; SameSite=Lax");
  });
  it("adds Secure on https", () => {
    expect(themeCookie("light", true)).toBe("jellycrew_theme=light; Max-Age=31536000; Path=/; SameSite=Lax; Secure");
  });
  it("expires the cookie for system", () => {
    expect(themeCookie(null, false)).toBe("jellycrew_theme=; Max-Age=0; Path=/; SameSite=Lax");
  });
});
