"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A row that opens `href` when clicked anywhere that is not itself interactive, while the
 * first cell keeps a real link for the keyboard, middle-click and screen readers. Nothing is
 * overlaid, so tooltips and buttons inside the row keep working. Mark a cell `data-no-row-link`
 * (the selection checkbox cell) to keep clicks there from navigating.
 */
export function LinkRow({ href, className, onClick, ...props }: ComponentProps<"tr"> & { href: string }) {
  const router = useRouter();
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, summary, [role=button], [data-no-row-link]")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
      {...props}
    />
  );
}
