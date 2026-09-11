"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ResetRequestForm() {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/public/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: fd.get("identifier") }) });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setMessage(res.ok ? { tone: "success", text: body.message ?? "Check your email." } : { tone: "error", text: body.error ?? (res.status === 429 ? "Too many attempts. Try again later." : "Request failed.") });
    } catch {
      setMessage({ tone: "error", text: "Network error. Try again." });
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Field id="identifier" label="Username or email address">
        <Input name="identifier" size="lg" required maxLength={200} autoComplete="username" autoFocus />
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
