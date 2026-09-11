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
type Scheme = "light" | "dark";

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

/** Raw declarations of the :root block: either `light-dark(a, b)` pairs or `var(--other)` aliases. */
const declarations = new Map<string, string>();
const rootStart = css.indexOf(":root {");
const rootBlock = css.slice(rootStart, css.indexOf("\n}\n", rootStart));
for (const m of rootBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) declarations.set(m[1]!, m[2]!.trim());

function token(name: string, scheme: Scheme, depth = 0): Rgba {
  const raw = declarations.get(name);
  if (!raw) throw new Error(`token --${name} is not declared in the :root block of globals.css`);
  if (depth > 5) throw new Error(`token --${name} aliases loop`);
  const alias = raw.match(/^var\(--([a-z0-9-]+)\)$/);
  if (alias) return token(alias[1]!, scheme, depth + 1);
  const pair = raw.match(/^light-dark\(\s*([^,]+?)\s*,\s*(.+?)\s*\)$/);
  if (!pair) throw new Error(`token --${name} must be light-dark(...) or var(--...), got: ${raw}`);
  return parseColor(scheme === "light" ? pair[1]! : pair[2]!);
}

/** Source-over compositing, so translucent fills are measured as the eye sees them. */
function over(fg: Rgba, bg: Rgba, alpha = fg.a): Rgba {
  const mix = (f: number, b: number) => Math.round(alpha * f + (1 - alpha) * b);
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

const BACKGROUNDS = ["background", "card", "muted"] as const;
/** Minimum ratio on every background. */
const TEXT: Array<[name: string, min: number]> = [
  ["foreground", 7],
  ["muted-foreground", 5.5],
  ["primary", 4.5],
  ["success", 4.5],
  ["warning", 4.5],
  ["destructive", 4.5],
];
/** Text drawn on a solid token fill. */
const TEXT_ON_FILL: Array<[fg: string, bg: string]> = [["primary-foreground", "primary"]];
const TONES = ["primary", "success", "warning", "destructive"] as const;
/** Soft fills are the tone over the surface at 10 % in light and 15 % in dark (`bg-warning/10 dark:bg-warning/15`). */
const SOFT_ALPHA: Record<Scheme, number> = { light: 0.1, dark: 0.15 };

describe.each(["dark", "light"] as const)("%s theme", (scheme) => {
  it.each(TEXT.flatMap(([name, min]) => BACKGROUNDS.map((bg) => [name, bg, min] as const)))("%s on %s ≥ %s:1", (name, bg, min) => {
    expect(contrast(token(name, scheme), token(bg, scheme))).toBeGreaterThanOrEqual(min);
  });

  it.each(TEXT_ON_FILL)("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(token(fg, scheme), token(bg, scheme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES.flatMap((tone) => BACKGROUNDS.map((bg) => [tone, bg] as const)))("%s and foreground on its soft fill over %s ≥ 4.5:1", (tone, bg) => {
    const fill = over(token(tone, scheme), token(bg, scheme), SOFT_ALPHA[scheme]);
    expect(contrast(token(tone, scheme), fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("foreground", scheme), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["background", "card"])("input (control borders) on %s ≥ 3:1 (WCAG 1.4.11)", (bg) => {
    expect(contrast(token("input", scheme), token(bg, scheme))).toBeGreaterThanOrEqual(3);
  });

  it("keeps a visible step between foreground and muted-foreground", () => {
    const card = token("card", scheme);
    expect(contrast(token("foreground", scheme), card)).toBeGreaterThan(contrast(token("muted-foreground", scheme), card));
  });
});

it("declares every token shadcn components and the direction rely on", () => {
  for (const name of ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "muted", "muted-foreground", "secondary", "secondary-foreground", "accent", "accent-foreground", "border", "input", "primary", "primary-foreground", "ring", "destructive", "success", "warning", "radius"]) {
    expect(declarations.has(name), `--${name}`).toBe(true);
  }
});
