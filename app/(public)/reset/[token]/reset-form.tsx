"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";

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
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={minPasswordLength} autoComplete="new-password" autoFocus />
        <Help>At least {minPasswordLength} characters.</Help>
      </div>
      <div>
        <Label htmlFor="passwordConfirm">Repeat new password</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
