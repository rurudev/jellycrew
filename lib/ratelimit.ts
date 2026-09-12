/**
 * In-memory sliding-window rate limiter. One process, one map; enough for a single
 * container in front of public endpoints. Keys should include a purpose prefix.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();
  private lastPrune = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  check(key: string, max: number, windowMs: number): RateLimitResult {
    const t = this.now();
    this.prune(t, windowMs);
    const stamps = (this.hits.get(key) ?? []).filter((s) => t - s < windowMs);
    if (stamps.length >= max) {
      const retryAfterMs = windowMs - (t - stamps[0]);
      this.hits.set(key, stamps);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }
    stamps.push(t);
    this.hits.set(key, stamps);
    return { allowed: true, remaining: max - stamps.length, retryAfterSeconds: 0 };
  }

  reset(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }

  private prune(t: number, windowMs: number): void {
    if (t - this.lastPrune < 60_000) return;
    this.lastPrune = t;
    for (const [k, stamps] of this.hits) {
      const kept = stamps.filter((s) => t - s < Math.max(windowMs, 3_600_000));
      if (kept.length === 0) this.hits.delete(k);
      else this.hits.set(k, kept);
    }
  }
}

declare global {
  var __jellycrewRateLimiter: RateLimiter | undefined;
}

export const rateLimiter: RateLimiter = globalThis.__jellycrewRateLimiter ?? (globalThis.__jellycrewRateLimiter = new RateLimiter());

/** Limits for public endpoints. */
export const PUBLIC_LIMITS = {
  perIp: { max: 20, windowMs: 60_000 },
  perToken: { max: 30, windowMs: 3_600_000 },
  loginPerIp: { max: 10, windowMs: 60_000 },
} as const;

/** The address of a caller we cannot identify. */
export const UNKNOWN_IP = "unknown";

/**
 * A limit keyed on the caller's address, which applies only when the address is actually known.
 * Behind a proxy that forwards nothing, every caller looks like the same one, and a per-address
 * limit would then be a switch that locks everybody out at once. Limits keyed on a username or
 * a token still apply in that case.
 */
export function ipLimit(key: string, ip: string, limit: { max: number; windowMs: number }): Array<{ key: string; max: number; windowMs: number }> {
  return ip === UNKNOWN_IP ? [] : [{ key, ...limit }];
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || UNKNOWN_IP;
  return request.headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests. Try again later.");
    this.name = "RateLimitedError";
  }
}

/** Throws RateLimitedError when any of the given (key, limit) pairs is exhausted. */
export function enforceLimits(pairs: Array<{ key: string; max: number; windowMs: number }>): void {
  let worst = 0;
  for (const p of pairs) {
    const r = rateLimiter.check(p.key, p.max, p.windowMs);
    if (!r.allowed) worst = Math.max(worst, r.retryAfterSeconds);
  }
  if (worst > 0) throw new RateLimitedError(worst);
}
