import type { ReactNode } from "react";

/** A keyboard key, for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-block rounded-sm border border-edge-strong bg-surface-2 px-1 font-mono text-xs leading-4 text-fg-muted">{children}</kbd>;
}
