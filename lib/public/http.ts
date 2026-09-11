import { RateLimitedError } from "@/lib/ratelimit";
import { publicBaseUrl } from "@/lib/urls";

/** JSON helper for public route handlers. */
export function json(body: unknown, init: ResponseInit & { status?: number } = {}): Response {
  return Response.json(body, { ...init, headers: { "cache-control": "no-store", ...(init.headers ?? {}) } });
}

export function tooMany(err: RateLimitedError): Response {
  return json({ error: err.message, retryAfterSeconds: err.retryAfterSeconds }, { status: 429, headers: { "retry-after": String(err.retryAfterSeconds) } });
}

/**
 * Origin check for public POSTs: when an Origin header is present it must match the
 * request host or the configured public base URL. Same-origin form posts from the app
 * always pass; cross-site posts are refused.
 */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = new Set<string>();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) hosts.add(host.split(",")[0]!.trim());
  try {
    hosts.add(new URL(request.url).host);
  } catch {
    // ignore
  }
  try {
    hosts.add(new URL(publicBaseUrl()).host);
  } catch {
    // ignore
  }
  return hosts.has(originHost);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
