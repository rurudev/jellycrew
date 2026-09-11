"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * A form whose submit button stays disabled until the operator types `phrase`.
 * Used for destructive single actions (delete, immediate delete, revoke).
 */
export function ConfirmForm({
  action,
  phrase,
  label,
  description,
  children,
  hidden,
}: {
  action: (formData: FormData) => void | Promise<void>;
  phrase: string;
  label: string;
  description?: ReactNode;
  children?: ReactNode;
  hidden?: Record<string, string>;
}) {
  const [typed, setTyped] = useState("");
  const ok = typed === phrase;
  return (
    <form action={action} className="space-y-2">
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      {children}
      <div className="flex items-center gap-2">
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${phrase} to confirm`} className="max-w-xs" aria-label="Confirmation" />
        <SubmitButton variant="destructive" disabled={!ok} pendingLabel="Working…">
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}
