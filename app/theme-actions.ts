"use server";

import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, parseTheme } from "@/lib/theme";

/**
 * Stores the theme preference in a plain cookie so the server renders the right theme
 * without a flash. `null` (follow the system) removes the cookie. Setting a cookie in a
 * server action makes Next re-render the current page and layouts with the new value.
 */
export async function setThemeAction(value: string | null): Promise<void> {
  const store = await cookies();
  const theme = parseTheme(value);
  if (!theme) {
    store.delete(THEME_COOKIE);
    return;
  }
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: env().PUBLIC_BASE_URL.startsWith("https://"),
  });
}
