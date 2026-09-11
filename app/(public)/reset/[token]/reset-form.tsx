"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetForm({ token, minPasswordLength }: { token: string; minPasswordLength: number }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ userName: string; serverUrl: string } | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/public/reset/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, passwordConfirm }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; userName?: string; serverUrl?: string };
      if (!res.ok) {
        setError(body.error ?? "Reset failed.");
        return;
      }
      setDone({ userName: body.userName ?? "", serverUrl: body.serverUrl ?? "" });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }
  if (done) {
    return (
      <Alert tone="success" title="Password changed">
        Sign in as <span className="font-medium">{done.userName}</span> at{" "}
        <a href={done.serverUrl} className="underline">
          {done.serverUrl}
        </a>{" "}
        with your new password. Other devices may need to sign in again.
      </Alert>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field id="password" label="New password" help={`At least ${minPasswordLength} characters.`}>
        <Input name="password" size="lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" autoFocus />
      </Field>
      <Field id="passwordConfirm" label="Repeat new password">
        <Input name="passwordConfirm" size="lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
