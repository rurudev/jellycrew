import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-zinc-800 dark:text-zinc-200", className)} {...props} />;
}

export function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{children}</p>;
}
