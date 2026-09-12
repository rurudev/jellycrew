import { z } from "zod";
import { PUBLIC_LIMITS, RateLimitedError, clientIp, enforceLimits, ipLimit } from "@/lib/ratelimit";
import { json, originAllowed, readJson, tooMany } from "@/lib/public/http";
import { ResetError, consumePasswordReset, resetTokenStatus } from "@/lib/services/reset";
import { hashToken } from "@/lib/tokens";
import { jellyfinPublicUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

function limits(request: Request, token: string) {
  return [
    ...ipLimit(`reset-consume:ip:${clientIp(request)}`, clientIp(request), PUBLIC_LIMITS.perIp),
    { key: `reset-consume:token:${hashToken(token).slice(0, 16)}`, max: 10, windowMs: 3_600_000 },
  ];
}

export async function GET(request: Request, ctx: RouteContext<"/api/public/reset/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  try {
    enforceLimits(limits(request, token));
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  const status = resetTokenStatus(token);
  return json(status, { status: status.ok ? 200 : 410 });
}

const Body = z.object({ password: z.string().min(1).max(256), passwordConfirm: z.string().max(256).optional() });

/** Consumes the reset token and sets the password. */
export async function POST(request: Request, ctx: RouteContext<"/api/public/reset/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  if (!originAllowed(request)) return json({ error: "Cross-site request refused." }, { status: 403 });
  try {
    enforceLimits(limits(request, token));
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  const body = await readJson(request);
  const parsed = Body.safeParse(body ?? {});
  if (!parsed.success) return json({ error: "A new password is required." }, { status: 400 });
  if (parsed.data.passwordConfirm !== undefined && parsed.data.passwordConfirm !== parsed.data.password) return json({ error: "Passwords do not match." }, { status: 400 });
  try {
    const result = await consumePasswordReset(token, parsed.data.password, { ip: clientIp(request), requestId: request.headers.get("x-request-id") ?? undefined });
    return json({ ok: true, userName: result.userName, serverUrl: jellyfinPublicUrl() });
  } catch (err) {
    if (err instanceof ResetError) return json({ error: err.message, code: err.code }, { status: err.code === "password" ? 400 : err.code === "invalid" ? 404 : 410 });
    throw err;
  }
}
