"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * The guard for destructive actions: a dialog whose submit button stays disabled until the
 * operator types `phrase`. The form posts to a server action, so it works exactly like the
 * inline forms it replaced, but nothing destructive is on the page until asked for.
 * The dialog closes when the action reports back (success or error arrive as `?ok=`/`?error=`
 * on the same route, which would otherwise leave it open in front of the toast).
 * `disabledReason` renders the trigger disabled with the reason beside it.
 */
export function ConfirmDialog({
  label,
  title,
  description,
  phrase,
  action,
  hidden,
  confirmLabel,
  disabledReason,
  variant = "destructive",
  size = "default",
}: {
  /** Trigger text; also the confirm button unless `confirmLabel` is given. */
  label: string;
  title: string;
  description?: ReactNode;
  phrase: string;
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  confirmLabel?: string;
  disabledReason?: ReactNode;
  variant?: "destructive" | "outline";
  size?: "default" | "sm";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const params = useSearchParams();
  const reported = params.has("ok") || params.has("error");
  // Close when the action reports back. State is adjusted during render (React's pattern for
  // reacting to a changed input) rather than in an effect.
  const [lastReported, setLastReported] = useState(reported);
  if (reported !== lastReported) {
    setLastReported(reported);
    if (reported) {
      setOpen(false);
      setTyped("");
    }
  }
  if (disabledReason) {
    return (
      <div className="space-y-1">
        <Button type="button" variant={variant} size={size} disabled title={typeof disabledReason === "string" ? disabledReason : undefined}>
          {label}
        </Button>
        <Hint>{disabledReason}</Hint>
      </div>
    );
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger render={<Button variant={variant} size={size} />}>{label}</AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} className="grid gap-4">
          {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <FormField
            id={id}
            label={
              <>
                Type <span className="font-mono font-medium text-foreground">{phrase}</span> to confirm
              </>
            }
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive" disabled={typed !== phrase} pendingLabel="Working…">
              {confirmLabel ?? label}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
