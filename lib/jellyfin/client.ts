import createClient, { type Middleware } from "openapi-fetch";
import { APP_NAME, APP_VERSION } from "@/lib/env";
import { logger } from "@/lib/log";
import type { paths } from "./generated/schema";

export type JellyfinClient = ReturnType<typeof createClient<paths>>;

export interface AuthHeaderParts {
  deviceId: string;
  token?: string;
  version?: string;
  client?: string;
  device?: string;
}

/** Builds the `Authorization: MediaBrowser ...` header Jellyfin expects. */
export function buildAuthHeader({ deviceId, token, version = APP_VERSION, client = APP_NAME, device = "server" }: AuthHeaderParts): string {
  const parts = [`Client="${client}"`, `Device="${device}"`, `DeviceId="${deviceId}"`, `Version="${version}"`];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

export interface JellyfinClientOptions extends AuthHeaderParts {
  baseUrl: string;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export class JellyfinError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly operation: string;
  constructor(operation: string, status: number, body: unknown) {
    const text = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
    super(`Jellyfin ${operation} failed with HTTP ${status}${text ? `: ${text.slice(0, 300)}` : ""}`);
    this.name = "JellyfinError";
    this.operation = operation;
    this.status = status;
    this.body = body;
  }
}

export class JellyfinUnreachableError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Jellyfin unreachable during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "JellyfinUnreachableError";
    this.cause = cause;
  }
}

/**
 * Creates a typed client for one Jellyfin server. `token` is either the API key or a
 * user session token; omit it for anonymous calls such as AuthenticateByName.
 */
export function createJellyfinClient(opts: JellyfinClientOptions): JellyfinClient {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const authorization = buildAuthHeader(opts);
  const client = createClient<paths>({
    baseUrl: opts.baseUrl,
    headers: { Authorization: authorization, Accept: "application/json" },
    fetch: (input) => fetch(input, { signal: AbortSignal.timeout(timeoutMs) }),
  });
  const logging: Middleware = {
    onRequest({ request }) {
      (request as Request & { __start?: number }).__start = Date.now();
    },
    onResponse({ request, response }) {
      logger.debug(
        { method: request.method, path: new URL(request.url).pathname, status: response.status },
        "jellyfin request",
      );
    },
  };
  client.use(logging);
  return client;
}

/** Narrows an openapi-fetch result to its data, throwing JellyfinError on any non-2xx status. */
export function unwrap<T>(
  operation: string,
  result: { data?: T; error?: unknown; response: Response },
): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new JellyfinError(operation, result.response.status, result.error);
  }
  return result.data as T;
}

/** Runs a client call, translating network failures into JellyfinUnreachableError. */
export async function call<T>(
  operation: string,
  fn: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await fn();
  } catch (cause) {
    throw new JellyfinUnreachableError(operation, cause);
  }
  return unwrap(operation, result);
}
