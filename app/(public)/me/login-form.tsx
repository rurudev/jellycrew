"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { Spinner } from "@/components/ui/spinner";
import { usePublicForm } from "@/lib/public/use-public-form";

export function SelfLoginForm() {
  const router = useRouter();
  const { submit, pending, error } = usePublicForm<Record<string, never>>("/api/public/me/login", "Could not sign you in.");

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await submit({ username: data.get("username"), password: data.get("password") });
    if (ok) router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <Callout tone="error">{error}</Callout> : null}
      <FormField id="username" label="Jellyfin username">
        <Input name="username" size="lg" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </FormField>
      <FormField id="password" label="Password">
        <PasswordField name="password" size="lg" required autoComplete="current-password" />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-muted-foreground">
        <Link href="/reset" className="underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
