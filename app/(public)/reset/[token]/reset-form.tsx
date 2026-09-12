"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { FormField } from "@/components/ui/form-field";
import { PasswordField } from "@/components/ui/password-field";
import { Spinner } from "@/components/ui/spinner";
import { usePublicForm } from "@/lib/public/use-public-form";

export function ResetForm({ token, minPasswordLength, serverName, children }: { token: string; minPasswordLength: number; serverName: string; /** The page's own heading, hidden once the password is changed. */ children: ReactNode }) {
  const { submit, pending, error, setError, result } = usePublicForm<{ userName?: string; serverUrl?: string }>(`/api/public/reset/${encodeURIComponent(token)}`, "Could not change the password.", {
    isComplete: (data) => typeof data.userName === "string" && data.userName !== "",
  });
  const [mismatch, setMismatch] = useState(false);

  const checkMatch: NonNullable<ComponentProps<"form">["onChange"]> = (event) => {
    const data = new FormData(event.currentTarget);
    const repeated = String(data.get("passwordConfirm") ?? "");
    setMismatch(repeated !== "" && repeated !== String(data.get("password") ?? ""));
  };

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const passwordConfirm = String(data.get("passwordConfirm") ?? "");
    if (password !== passwordConfirm) {
      setError("The two passwords do not match.");
      return;
    }
    await submit({ password, passwordConfirm });
  };

  if (result) {
    return (
      <div className="space-y-5">
        <CircleCheckIcon aria-hidden className="size-8 text-success" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Password changed</h1>
          <p className="text-muted-foreground">
            Sign in as <span className="font-medium text-foreground">{result.userName}</span> with your new password. Other devices will ask you to sign in again.
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
    <div className="space-y-6">
      {children}
      <form onSubmit={onSubmit} onChange={checkMatch} className="space-y-5">
        {error ? <Callout tone="error">{error}</Callout> : null}
        <FormField id="password" label="New password" help={`At least ${minPasswordLength} characters.`}>
          <PasswordField name="password" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
        </FormField>
        <FormField id="passwordConfirm" label="Repeat new password" error={mismatch ? "The two passwords do not match." : undefined}>
          <PasswordField name="passwordConfirm" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={pending || mismatch}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </div>
  );
}
