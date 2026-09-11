"use client";

import { useOptimistic, useTransition } from "react";
import { setThemeAction } from "@/app/theme-actions";
import { nextTheme, themeLabel, type Theme } from "@/lib/theme";

/**
 * Cycles system → light → dark. The attribute on <html> is switched immediately so the
 * change is instant; the cookie write then makes the server agree on the next render.
 */
export function ThemeToggle({ theme }: { theme: Theme | null }) {
  const [pending, startTransition] = useTransition();
  const [shown, show] = useOptimistic(theme);
  const next = nextTheme(shown);
  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          show(next);
          if (next) document.documentElement.dataset.theme = next;
          else delete document.documentElement.dataset.theme;
          await setThemeAction(next);
        });
      }}
      disabled={pending}
      aria-label={`Theme: ${themeLabel(shown)}. Switch to ${themeLabel(next).toLowerCase()}`}
      title={`Switch to ${themeLabel(next).toLowerCase()} theme`}
      className="inline-flex h-7 items-center rounded-md px-2 text-xs text-fg-muted transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:bg-surface-2 hover:text-fg disabled:opacity-60"
    >
      Theme: {themeLabel(shown)}
    </button>
  );
}
