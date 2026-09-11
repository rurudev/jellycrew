import { z } from "zod";
import { sealSession, selfCookieHeader, SELF_TTL_SECONDS } from "@/lib/auth/session";
import { PUBLIC_LIMITS, RateLimitedError, clientIp, enforceLimits } from "@/lib/ratelimit";
import { json, originAllowed, readJson, tooMany } from "@/lib/public/http";
import { LoginError } from "@/lib/services/auth";
import { loginSelf } from "@/lib/services/self";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const Body = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) });

/** Self-service login: any Jellyfin account. Sets the 30-day self cookie. */
export async function POST(request: Request): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Cross-site request refused." }, { status: 403 });
  const body = await readJson(request);
  const parsed = Body.safeParse(body ?? {});
  if (!parsed.success) return json({ error: "Username and password are required." }, { status: 400 });
  try {
    enforceLimits([
      { key: `me-login:ip:${clientIp(request)}`, ...PUBLIC_LIMITS.loginPerIp },
      { key: `me-login:user:${hashToken(parsed.data.username.toLowerCase()).slice(0, 16)}`, ...PUBLIC_LIMITS.loginPerIp },
    ]);
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  try {
    const identity = await loginSelf(parsed.data.username, parsed.data.password, request.headers.get("x-request-id") ?? undefined);
    const value = await sealSession({ kind: "self", userId: identity.userId, userName: identity.userName, issuedAt: Date.now() }, SELF_TTL_SECONDS);
    return json({ ok: true, userName: identity.userName }, { headers: { "set-cookie": selfCookieHeader(value) } });
  } catch (err) {
    if (err instanceof LoginError) return json({ error: err.message, code: err.code }, { status: err.code === "unavailable" ? 503 : 401 });
    throw err;
  }
}
