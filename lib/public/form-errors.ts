/** What the public API handlers put in a failed response. */
export interface PublicErrorBody {
  error?: unknown;
}

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/**
 * One message for the guest, whatever went wrong. The handler's own message wins, because it
 * is the only one that knows what the server said; the rest are fallbacks by status so a guest
 * never sees a bare status code.
 */
export function publicErrorMessage(status: number, body: unknown, fallback: string): string {
  const message = (body as PublicErrorBody | null | undefined)?.error;
  if (typeof message === "string" && message.trim() !== "") return message;
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status === 404) return "That link is no longer valid.";
  if (status >= 500) return "The server had a problem. Try again in a moment.";
  return fallback;
}
