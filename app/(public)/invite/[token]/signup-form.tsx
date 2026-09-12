"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { CircleCheckIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CopyField } from "@/components/ui/copy-field";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { Spinner } from "@/components/ui/spinner";
import { usePublicForm } from "@/lib/public/use-public-form";

interface SignupResult {
  userName?: string;
  serverUrl?: string;
  expiresAt?: string | null;
}

const JELLYFIN_APPS = "https://jellyfin.org/downloads/clients";

export function SignupForm({
  token,
  requireEmail,
  minPasswordLength,
  serverName,
  accountExpiryDays,
  children,
}: {
  token: string;
  requireEmail: boolean;
  minPasswordLength: number;
  serverName: string;
  accountExpiryDays: number | null;
  /** The page's own heading and note, hidden once the account exists. */
  children: ReactNode;
}) {
  const { submit, pending, error, setError, result } = usePublicForm<SignupResult>(`/api/public/invite/${encodeURIComponent(token)}`, "Could not create the account.", {
    isComplete: (data) => typeof data.userName === "string" && data.userName !== "",
  });
  const [mismatch, setMismatch] = useState(false);

  // The fields stay uncontrolled so a password manager filling them in is always what gets
  // submitted; the live hint is computed from the form itself.
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
    await submit({ username: data.get("username"), password, passwordConfirm, email: data.get("email") ?? "" });
  };

  if (result) {
    return (
      <div className="space-y-5">
        <CircleCheckIcon aria-hidden className="size-8 text-success" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Your account is ready</h1>
          <p className="text-muted-foreground">
            Sign in as <span className="font-medium text-foreground">{result.userName}</span> with the password you just chose.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {result.serverUrl ? (
            <a href={result.serverUrl} className={buttonVariants({ size: "lg" })}>
              Open {serverName}
            </a>
          ) : null}
          <a href={JELLYFIN_APPS} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Get the app
          </a>
        </div>
        {result.serverUrl ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">In the app, add this server address:</p>
            <CopyField value={result.serverUrl} label="Copy address" />
          </div>
        ) : null}
        {result.expiresAt ? <p className="text-muted-foreground">Your access runs until {new Date(result.expiresAt).toLocaleDateString()}.</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {children}
      <form onSubmit={onSubmit} onChange={checkMatch} className="space-y-5">
        {error ? <Callout tone="error">{error}</Callout> : null}
        <FormField id="username" label="Username" help="This is what you sign in with. Pick something you will remember.">
          <Input name="username" size="lg" required maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </FormField>
        <FormField id="password" label="Password" help={`At least ${minPasswordLength} characters.`}>
          <PasswordField name="password" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
        </FormField>
        <FormField id="passwordConfirm" label="Repeat password" error={mismatch ? "The two passwords do not match." : undefined}>
          <PasswordField name="passwordConfirm" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
        </FormField>
        <FormField id="email" label={requireEmail ? "Email address" : "Email address (optional)"} help="Only used to reset your password if you forget it.">
          <Input name="email" size="lg" type="email" required={requireEmail} autoComplete="email" />
        </FormField>
        {accountExpiryDays ? <p className="text-muted-foreground">Your access will run for {accountExpiryDays} days.</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending || mismatch}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Creating your account…" : "Create my account"}
        </Button>
      </form>
    </div>
  );
}
