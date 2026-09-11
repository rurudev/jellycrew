"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]") !== null;
}

/** True while a modal owns the page: focus is inside a dialog, or the field itself is behind one. */
function isBehindDialog(input: HTMLInputElement | null): boolean {
  return document.activeElement?.closest("[role=dialog], [role=alertdialog]") !== null || input?.closest('[aria-hidden="true"]') !== null;
}

/** Escape clears a filled search and resubmits so the filter is removed; on an empty one it just blurs. */
function onEscape(input: HTMLInputElement) {
  if (input.value) {
    input.value = "";
    input.form?.requestSubmit();
  } else {
    input.blur();
  }
}

/**
 * A search box with the `/` shortcut. Enter submits the enclosing form (the filter form
 * navigates); Escape clears or blurs. The shortcut hint hides while typing.
 */
export function SearchField({ className, onKeyDown, ...props }: ComponentProps<typeof Input>) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || isBehindDialog(ref.current)) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={cn("relative", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        className="pl-8 pr-9"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          onKeyDown?.(e);
          if (e.key === "Escape") onEscape(e.currentTarget);
        }}
        {...props}
      />
      {focused ? null : (
        <Kbd aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
          /
        </Kbd>
      )}
    </div>
  );
}
