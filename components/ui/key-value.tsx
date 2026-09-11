import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Facts as a two-column definition list with one shared label width. */
export function KeyValue({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-[minmax(7rem,max-content)_1fr] gap-x-6 gap-y-1.5 text-sm", className)}>{children}</dl>;
}

function Item({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </>
  );
}

KeyValue.Item = Item;
