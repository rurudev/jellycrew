import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type Theme } from "./theme";

/** The chosen theme from the preference cookie; `null` means follow the system. */
export async function getTheme(): Promise<Theme | null> {
  const store = await cookies();
  return parseTheme(store.get(THEME_COOKIE)?.value);
}
