import { describe, expect, it } from "vitest";
import { RateLimiter, UNKNOWN_IP, clientIp, ipLimit } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows up to max hits per window and then blocks with a retry hint", () => {
    let t = 1_000_000;
    const rl = new RateLimiter(() => t);
    for (let i = 0; i < 3; i++) expect(rl.check("k", 3, 10_000).allowed).toBe(true);
    const blocked = rl.check("k", 3, 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);
    t += 5_000;
    expect(rl.check("k", 3, 10_000)).toMatchObject({ allowed: false, retryAfterSeconds: 5 });
    t += 5_001;
    expect(rl.check("k", 3, 10_000).allowed).toBe(true);
    expect(rl.check("other", 3, 10_000).allowed).toBe(true);
  });
  it("resets", () => {
    const rl = new RateLimiter(() => 5);
    rl.check("k", 1, 1000);
    expect(rl.check("k", 1, 1000).allowed).toBe(false);
    rl.reset("k");
    expect(rl.check("k", 1, 1000).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "8.8.8.8" } }))).toBe("8.8.8.8");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("ipLimit", () => {
  const limit = { max: 10, windowMs: 60_000 };

  it("limits a caller we can identify", () => {
    expect(ipLimit("login:ip:203.0.113.7", "203.0.113.7", limit)).toEqual([{ key: "login:ip:203.0.113.7", max: 10, windowMs: 60_000 }]);
  });

  it("drops the limit when every caller looks the same", () => {
    // Behind a proxy that forwards nothing, one bucket would lock out everyone at once.
    expect(ipLimit("login:ip:unknown", UNKNOWN_IP, limit)).toEqual([]);
  });
});
