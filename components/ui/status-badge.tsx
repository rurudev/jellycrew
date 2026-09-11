import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "destructive" | "neutral" | "primary";

const variantFor: Record<StatusTone, ComponentProps<typeof Badge>["variant"]> = {
  success: "success",
  warning: "warning",
  destructive: "destructive",
  neutral: "secondary",
  primary: "outline",
};

const dotFor: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
};

/** The dot alone, for places that carry their own text (the shell's server status). */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotFor[tone], className)} />;
}

/** A state, coloured by meaning: a dot plus a short label. Never use it for labels or tags. */
export function StatusBadge({ tone, dot = true, className, children, ...props }: { tone: StatusTone; dot?: boolean; children: ReactNode } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return (
    <Badge variant={variantFor[tone]} className={cn(tone === "primary" && "border-primary/30 text-primary", className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </Badge>
  );
}
