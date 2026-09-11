"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function SelfLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/public/me/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? (res.status === 429 ? "Too many attempts. Try again in a minute." : "Sign-in failed."));
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Callout tone="error">{error}</Callout> : null}
      <FormField id="username" label="Jellyfin username">
        <Input name="username" size="lg" required autoComplete="username" autoFocus />
      </FormField>
      <FormField id="password" label="Password">
        <Input name="password" size="lg" type="password" required autoComplete="current-password" />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link href="/reset" className="underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
