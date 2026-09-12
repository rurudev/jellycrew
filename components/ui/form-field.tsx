import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * One labelled control, composed from shadcn's Field parts. The control receives its `id`,
 * `aria-describedby` and `aria-invalid` from here, so call sites only name the field.
 * Works in server and client components alike.
 */
export function FormField({
  id,
  label,
  hideLabel = false,
  help,
  error,
  children,
  className,
  controlClassName,
}: {
  id: string;
  label: ReactNode;
  /** Keep the label for assistive tech but do not show it (search boxes, filter rows). */
  hideLabel?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Width for the control alone, so a short input does not narrow its own help text. */
  controlClassName?: string;
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
    <Field data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </FieldLabel>
      {controlClassName ? <div className={controlClassName}>{control}</div> : control}
      {error ? (
        <FieldError id={errorId} className="text-xs">
          {error}
        </FieldError>
      ) : null}
      {help ? (
        <FieldDescription id={helpId} className="text-xs">
          {help}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

/** Help text that belongs to a group of controls or a button rather than to one field. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <FieldDescription className={cn("text-xs", className)}>{children}</FieldDescription>;
}
