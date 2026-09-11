import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the colour tokens in app/globals.css: every text token must clear WCAG AA on every
 * surface it can sit on, in both themes. Tokens are read from the stylesheet itself so the
 * test cannot drift from what ships.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

type Pair = { light: string; dark: string };
const tokens = new Map<string, Pair>();
for (const m of css.matchAll(/--([a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi)) {
  tokens.set(m[1]!, { light: m[2]!.toLowerCase(), dark: m[3]!.toLowerCase() });
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function token(name: string, theme: keyof Pair): string {
  const t = tokens.get(name);
  if (!t) throw new Error(`token --${name} is not defined with light-dark() in globals.css`);
  return t[theme];
}

const BACKGROUNDS = ["canvas", "surface", "surface-2"] as const;
/** Minimum ratio on every background. fg-muted is held above AA so it stays a visible step from fg-subtle. */
const TEXT: Array<[name: string, min: number]> = [
  ["fg", 7],
  ["fg-muted", 5.5],
  ["fg-subtle", 4.5],
  ["accent", 4.5],
  ["ok", 4.5],
  ["warn", 4.5],
  ["danger", 4.5],
];

describe.each(["dark", "light"] as const)("%s theme", (theme) => {
  it.each(TEXT.flatMap(([name, min]) => BACKGROUNDS.map((bg) => [name, bg, min] as const)))("%s on %s ≥ %s:1", (name, bg, min) => {
    expect(contrast(token(name, theme), token(bg, theme))).toBeGreaterThanOrEqual(min);
  });

  it("accent-fg on accent ≥ 4.5:1", () => {
    expect(contrast(token("accent-fg", theme), token("accent", theme))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a visible step between fg, fg-muted and fg-subtle", () => {
    const surface = token("surface", theme);
    const fg = contrast(token("fg", theme), surface);
    const muted = contrast(token("fg-muted", theme), surface);
    const subtle = contrast(token("fg-subtle", theme), surface);
    expect(fg).toBeGreaterThan(muted);
    expect(muted).toBeGreaterThan(subtle);
  });
});

it("defines every token the direction promises", () => {
  for (const name of ["canvas", "surface", "surface-2", "edge", "edge-strong", "fg", "fg-muted", "fg-subtle", "accent", "accent-fg", "ok", "warn", "danger"]) {
    expect(tokens.has(name), `--${name}`).toBe(true);
  }
});
