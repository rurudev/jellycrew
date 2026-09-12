"use client";

import { useActionState } from "react";
import { Callout } from "@/components/ui/callout";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Callout tone="error">{state.error}</Callout> : null}
      <FormField id="username" label="Username">
        <Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </FormField>
      <FormField id="password" label="Password">
        <PasswordField name="password" autoComplete="current-password" required />
      </FormField>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
