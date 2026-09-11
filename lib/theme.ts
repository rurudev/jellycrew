/** Theme preference. Pure module: shared by the root layout, the server action and the toggle. */

export const THEME_COOKIE = "jellycrew_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** `null` means "follow the system". Anything that is not a known theme is treated as that. */
export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The toggle cycles system → light → dark → system. */
export function nextTheme(current: Theme | null): Theme | null {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

export function themeLabel(theme: Theme | null): string {
  return theme === null ? "System" : theme === "light" ? "Light" : "Dark";
}
