import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

/** Every console page starts here: optional breadcrumb, one h1, an optional count and description, actions on the right. */
export function PageHeader({
  title,
  count,
  description,
  breadcrumb,
  actions,
  className,
}: {
  title: ReactNode;
  count?: number | string;
  description?: ReactNode;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {breadcrumb?.length ? (
        <nav aria-label="Breadcrumb" className="text-xs text-fg-muted">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumb.map((c, i) => (
              <Fragment key={i}>
                {i > 0 ? (
                  <li aria-hidden className="text-fg-subtle">
                    /
                  </li>
                ) : null}
                <li>
                  {c.href ? (
                    <Link href={c.href} className="hover:text-fg hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-fg">
          {title}
          {count !== undefined ? <span className="text-sm font-normal text-fg-muted">{count}</span> : null}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="max-w-prose text-sm text-fg-muted">{description}</p> : null}
    </div>
  );
}
