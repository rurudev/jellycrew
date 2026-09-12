"use client";

import { useState, type ComponentProps } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { FormField } from "@/components/ui/form-field";
import { PasswordField } from "@/components/ui/password-field";
import { Spinner } from "@/components/ui/spinner";
import { usePublicForm } from "@/lib/public/use-public-form";

export function ResetForm({ token, minPasswordLength, serverName }: { token: string; minPasswordLength: number; serverName: string }) {
  const { submit, pending, error, setError, result } = usePublicForm<{ userName?: string; serverUrl?: string }>(`/api/public/reset/${encodeURIComponent(token)}`, "Could not change the password.");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && password !== confirm;

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    await submit({ password, passwordConfirm: confirm });
  };

  if (result) {
    return (
      <div className="space-y-5">
        <CircleCheckIcon aria-hidden className="size-8 text-success" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Password changed</h2>
          <p className="text-muted-foreground">
            Sign in as <span className="font-medium text-foreground">{result.userName}</span> with your new password.
          </p>
        </div>
        {result.serverUrl ? (
          <a href={result.serverUrl} className={buttonVariants({ size: "lg" })}>
            Open {serverName}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <Callout tone="error">{error}</Callout> : null}
      <FormField id="password" label="New password" help={`At least ${minPasswordLength} characters.`}>
        <PasswordField name="password" size="lg" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={minPasswordLength} autoComplete="new-password" />
      </FormField>
      <FormField id="passwordConfirm" label="Repeat new password" error={mismatch ? "The two passwords do not match." : undefined}>
        <PasswordField name="passwordConfirm" size="lg" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={minPasswordLength} autoComplete="new-password" />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending || mismatch}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
