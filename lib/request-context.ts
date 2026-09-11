import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Returns the request id assigned by proxy.ts for the current request, or a fresh
 * one outside of a request scope (scheduler, tests, scripts).
 */
export async function currentRequestId(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get(REQUEST_ID_HEADER) ?? randomUUID();
  } catch {
    return randomUUID();
  }
}

export function newRequestId(): string {
  return randomUUID();
}
