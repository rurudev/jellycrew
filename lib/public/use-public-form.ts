"use client";

import { useState } from "react";
import { NETWORK_ERROR, publicErrorMessage } from "./form-errors";

export interface PublicForm<T> {
  /** Posts JSON and returns the parsed body, or null when it failed (the error is set). */
  submit: (payload: Record<string, unknown>) => Promise<T | null>;
  pending: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  result: T | null;
}

/**
 * The one way the guest pages talk to the public API: post JSON, show one message when it
 * fails, keep the result when it works. Every guest form had its own copy of this before.
 */
export function usePublicForm<T>(url: string, fallback: string): PublicForm<T> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const submit = async (payload: Record<string, unknown>): Promise<T | null> => {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(publicErrorMessage(response.status, body, fallback));
        return null;
      }
      const data = (body ?? {}) as T;
      setResult(data);
      return data;
    } catch {
      setError(NETWORK_ERROR);
      return null;
    } finally {
      setPending(false);
    }
  };

  return { submit, pending, error, setError, result };
}
