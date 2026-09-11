"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { nextTheme, themeCookie, themeLabel, type Theme } from "@/lib/theme";

/** Writes the preference cookie and switches the document in place. Module level so the component stays pure. */
function applyTheme(theme: Theme | null) {
  document.cookie = themeCookie(theme, location.protocol === "https:");
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

const icons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

/**
 * Cycles system → light → dark. The browser writes the preference cookie itself, so the
 * switch is instant and needs no server round trip; the root layout reads the cookie on the
 * next request and renders the same theme server-side.
 */
export function ThemeToggle({ theme }: { theme: Theme | null }) {
  const [shown, setShown] = useState(theme);
  const next = nextTheme(shown);
  const Icon = icons[shown ?? "system"];
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        applyTheme(next);
        setShown(next);
      }}
      aria-label={`Theme: ${themeLabel(shown)}. Switch to ${themeLabel(next).toLowerCase()}`}
      title={`Switch to ${themeLabel(next).toLowerCase()} theme`}
    >
      <Icon data-icon="inline-start" />
      {themeLabel(shown)}
    </Button>
  );
}
