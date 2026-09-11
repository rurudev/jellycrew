import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** A neutral label the admin attached (user labels). */
export function Chip({ className, ...props }: Omit<ComponentProps<typeof Badge>, "variant">) {
  return <Badge variant="secondary" className={cn("font-normal", className)} {...props} />;
}

/** A fixed attribute of a record ("admin", "hidden"): quiet, mono, never coloured. */
export function Tag({ className, ...props }: Omit<ComponentProps<typeof Badge>, "variant">) {
  return <Badge variant="outline" className={cn("px-1.5 font-mono font-normal text-muted-foreground", className)} {...props} />;
}
