"use client";

import { useState, type FormEvent } from "react";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface Done {
  userName: string;
  serverUrl: string;
  expiresAt: string | null;
}

export function SignupForm({ token, requireEmail, minPasswordLength }: { token: string; requireEmail: boolean; minPasswordLength: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

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
      const res = await fetch(`/api/public/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password, passwordConfirm, email: fd.get("email") ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; userName?: string; serverUrl?: string; expiresAt?: string | null };
      if (!res.ok) {
        setError(body.error ?? (res.status === 429 ? "Too many attempts. Try again in a minute." : "Signup failed."));
        return;
      }
      setDone({ userName: body.userName ?? "", serverUrl: body.serverUrl ?? "", expiresAt: body.expiresAt ?? null });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Callout tone="success" title="Your account is ready">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open{" "}
            <a href={done.serverUrl} className="font-medium underline">
              {done.serverUrl}
            </a>{" "}
            or add this server address in a Jellyfin app.
          </li>
          <li>
            Sign in as <span className="font-medium">{done.userName}</span> with the password you just chose.
          </li>
          {done.expiresAt ? <li>Your access is valid until {new Date(done.expiresAt).toLocaleDateString()}.</li> : null}
        </ol>
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Callout tone="error">{error}</Callout> : null}
      <FormField id="username" label="Username">
        <Input name="username" size="lg" required maxLength={64} autoComplete="username" autoFocus />
      </FormField>
      <FormField id="password" label="Password" help={`At least ${minPasswordLength} characters.`}>
        <Input name="password" size="lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
      </FormField>
      <FormField id="passwordConfirm" label="Repeat password">
        <Input name="passwordConfirm" size="lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
      </FormField>
      <FormField id="email" label={requireEmail ? "Email" : "Email (optional)"} help="Used only for password resets after you verify it.">
        <Input name="email" size="lg" type="email" required={requireEmail} autoComplete="email" />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
