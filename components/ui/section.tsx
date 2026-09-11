import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled region of a page: one bordered surface, one heading, optional description and actions. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Anchor target for in-page navigation. */
  id?: string;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-4 rounded-lg border border-edge bg-surface p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-fg">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
