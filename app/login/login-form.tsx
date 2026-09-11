"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field id="username" label="Jellyfin username">
        <Input name="username" autoComplete="username" required autoFocus />
      </Field>
      <Field id="password" label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton block pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
