/** Theme preference. Pure module: shared by the root layout, the toggle and their tests. */

export const THEME_COOKIE = "jellycrew_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark" };

/** `null` means "follow the system". Anything that is not a known theme is treated as that. */
export function parseTheme(value: string | null | undefined): Theme | null {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : null;
}

/** The toggle cycles system → light → dark → system. */
export function nextTheme(current: Theme | null): Theme | null {
  const cycle: Array<Theme | null> = [null, ...THEMES];
  return cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? null;
}

export function themeLabel(theme: Theme | null): string {
  return theme === null ? "System" : LABELS[theme];
}

/**
 * The `document.cookie` string the toggle writes; `null` clears the cookie. Deliberately not
 * HttpOnly: it holds only a display preference and the browser is the one setting it, which
 * keeps the switch instant and free of any server round trip.
 */
export function themeCookie(theme: Theme | null, secure: boolean): string {
  const attrs = `Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  return theme ? `${THEME_COOKIE}=${theme}; Max-Age=${THEME_COOKIE_MAX_AGE}; ${attrs}` : `${THEME_COOKIE}=; Max-Age=0; ${attrs}`;
}
