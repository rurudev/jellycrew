import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Facts as a two-column definition list with one shared label width. */
export function KeyValue({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(7rem,max-content)_1fr]", className)}>{children}</dl>;
}

function Item({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </>
  );
}

KeyValue.Item = Item;
