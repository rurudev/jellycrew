"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";

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
      <Alert tone="success" title="Your account is ready">
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
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" required maxLength={64} autoComplete="username" autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
        <Help>At least {minPasswordLength} characters.</Help>
      </div>
      <div>
        <Label htmlFor="passwordConfirm">Repeat password</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="email">Email {requireEmail ? "" : "(optional)"}</Label>
        <Input id="email" name="email" type="email" required={requireEmail} autoComplete="email" />
        <Help>Used only for password resets after you verify it.</Help>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
