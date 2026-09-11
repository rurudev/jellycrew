"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * The submit button for plain server-action forms: shows a spinner and disables itself while
 * the enclosing form is pending, so no form needs its own pending state.
 */
export function SubmitButton({ pendingLabel, children, disabled, icon, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={disabled || pending} aria-busy={pending || undefined} icon={pending ? <Icon name="spinner" className="animate-spin" /> : icon}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
