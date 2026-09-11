import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the colour tokens in app/globals.css. Text tokens must clear WCAG AA on every
 * surface they can sit on, semantic tones must stay readable on their own soft fills, and
 * control borders must reach the 3:1 non-text minimum. Tokens are read from the stylesheet
 * itself so the test cannot drift from what ships.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

type Rgba = { r: number; g: number; b: number; a: number };
type Pair = { light: Rgba; dark: Rgba };
type Scheme = keyof Pair;

function parseColor(raw: string): Rgba {
  const hex = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = raw.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) };
  throw new Error(`unsupported colour syntax in globals.css: ${raw}`);
}

const tokens = new Map<string, Pair>();
for (const m of css.matchAll(/--([a-z0-9-]+):\s*light-dark\(\s*([^,]+?)\s*,\s*(.+?)\s*\);/g)) {
  tokens.set(m[1]!, { light: parseColor(m[2]!), dark: parseColor(m[3]!) });
}

function token(name: string, scheme: Scheme): Rgba {
  const t = tokens.get(name);
  if (!t) throw new Error(`token --${name} is not defined with light-dark() in globals.css`);
  return t[scheme];
}

/** Source-over compositing, so translucent fills are measured as the eye sees them. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const mix = (f: number, b: number) => Math.round(fg.a * f + (1 - fg.a) * b);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

function luminance(c: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
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
/** Text drawn on a solid token fill. */
const TEXT_ON_FILL: Array<[fg: string, bg: string]> = [["accent-fg", "accent"]];
const TONES = ["accent", "ok", "warn", "danger"] as const;

describe.each(["dark", "light"] as const)("%s theme", (scheme) => {
  it.each(TEXT.flatMap(([name, min]) => BACKGROUNDS.map((bg) => [name, bg, min] as const)))("%s on %s ≥ %s:1", (name, bg, min) => {
    expect(contrast(token(name, scheme), token(bg, scheme))).toBeGreaterThanOrEqual(min);
  });

  it.each(TEXT_ON_FILL)("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(token(fg, scheme), token(bg, scheme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES.flatMap((tone) => BACKGROUNDS.map((bg) => [tone, bg] as const)))("%s and fg on %s-soft over %s ≥ 4.5:1", (tone, bg) => {
    const fill = over(token(`${tone}-soft`, scheme), token(bg, scheme));
    expect(contrast(token(tone, scheme), fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("fg", scheme), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["canvas", "surface"])("edge-strong on %s ≥ 3:1 (control borders, WCAG 1.4.11)", (bg) => {
    expect(contrast(token("edge-strong", scheme), token(bg, scheme))).toBeGreaterThanOrEqual(3);
  });

  it("keeps a visible step between fg, fg-muted and fg-subtle", () => {
    const surface = token("surface", scheme);
    const fg = contrast(token("fg", scheme), surface);
    const muted = contrast(token("fg-muted", scheme), surface);
    const subtle = contrast(token("fg-subtle", scheme), surface);
    expect(fg).toBeGreaterThan(muted);
    expect(muted).toBeGreaterThan(subtle);
  });
});

it("defines every token the direction promises", () => {
  for (const name of ["canvas", "surface", "surface-2", "edge", "edge-strong", "fg", "fg-muted", "fg-subtle", "accent", "accent-fg", "accent-soft", "ok", "ok-soft", "warn", "warn-soft", "danger", "danger-soft"]) {
    expect(tokens.has(name), `--${name}`).toBe(true);
  }
});
