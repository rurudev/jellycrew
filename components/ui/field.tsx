import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Label, control, help and error in one place. The control receives its `id`,
 * `aria-describedby` and `aria-invalid` from here, so call sites only name the field.
 * Works in server and client components alike (no context, no client boundary).
 */
export function Field({
  id,
  label,
  hideLabel = false,
  help,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  /** Keep the label for assistive tech but do not show it (search boxes, filter rows). */
  hideLabel?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true } : {}),
      })
    : children;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className={cn("block text-sm font-medium text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {help ? (
        <p id={helpId} className="text-xs text-fg-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** Help text that belongs to a group of controls or a button rather than to one field. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs text-fg-muted", className)}>{children}</p>;
}
