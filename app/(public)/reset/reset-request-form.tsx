"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { usePublicForm } from "@/lib/public/use-public-form";

export function ResetRequestForm() {
  const { submit, pending, error, result } = usePublicForm<{ message?: string }>("/api/public/reset", "Could not send the link.");

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit({ identifier: data.get("identifier") });
  };

  if (result) {
    return <Callout tone="success" title="Check your inbox">{result.message ?? "If that account has a verified email address, a reset link is on its way. The link works once and lasts an hour."}</Callout>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <Callout tone="error">{error}</Callout> : null}
      <FormField id="identifier" label="Username or email address">
        <Input name="identifier" size="lg" required maxLength={200} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? "Sending…" : "Send me a reset link"}
      </Button>
    </form>
  );
}
