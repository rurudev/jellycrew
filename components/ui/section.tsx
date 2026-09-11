import { useId, type ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A titled region of a page: a shadcn Card with one real heading, optional description and actions. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
  level = 2,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Anchor target for in-page navigation. */
  id?: string;
  /** Heading level. Use 3 when the section sits inside another section's region. */
  level?: 2 | 3;
}) {
  const headingId = useId();
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <Card id={id} role="region" aria-labelledby={headingId} className={cn("scroll-mt-4", className)}>
      <CardHeader>
        <CardTitle>
          <Heading id={headingId}>{title}</Heading>
        </CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        {actions ? <CardAction className="flex items-center gap-2">{actions}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
