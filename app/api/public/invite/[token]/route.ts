import { z } from "zod";
import { PUBLIC_LIMITS, RateLimitedError, clientIp, enforceLimits } from "@/lib/ratelimit";
import { json, originAllowed, readJson, tooMany } from "@/lib/public/http";
import { InviteError, publicInviteInfo, redeemInvite } from "@/lib/services/invites";
import { getServerStatus } from "@/lib/services/system";
import { hashToken } from "@/lib/tokens";
import { jellyfinPublicUrl } from "@/lib/urls";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

function limits(request: Request, token: string) {
  const ip = clientIp(request);
  return [
    { key: `invite:ip:${ip}`, ...PUBLIC_LIMITS.perIp },
    { key: `invite:token:${hashToken(token).slice(0, 16)}`, ...PUBLIC_LIMITS.perToken },
  ];
}

/** Public: what the invitee sees before signing up. Never reveals anything about other invites. */
export async function GET(request: Request, ctx: RouteContext<"/api/public/invite/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  try {
    enforceLimits(limits(request, token));
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  const info = publicInviteInfo(token);
  if (!info) return json({ error: "This invite link is not valid." }, { status: 404 });
  const server = await getServerStatus();
  return json({ ...info, serverName: server.serverName ?? "Jellyfin" });
}

const SignupBody = z.object({
  username: z.string().trim().min(1, "A username is required.").max(64),
  password: z.string().min(1, "A password is required.").max(256),
  passwordConfirm: z.string().max(256).optional(),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.email("Enter a valid email address.").nullable().optional()),
});

/** Public: create the account. Rate-limited per IP and per token. */
export async function POST(request: Request, ctx: RouteContext<"/api/public/invite/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  if (!originAllowed(request)) return json({ error: "Cross-site request refused." }, { status: 403 });
  try {
    enforceLimits(limits(request, token));
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  const body = await readJson(request);
  const parsed = SignupBody.safeParse(body ?? {});
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  if (parsed.data.passwordConfirm !== undefined && parsed.data.passwordConfirm !== parsed.data.password) {
    return json({ error: "Passwords do not match." }, { status: 400 });
  }
  try {
    const result = await redeemInvite({
      token,
      username: parsed.data.username,
      password: parsed.data.password,
      email: parsed.data.email ?? null,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return json({ ok: true, userName: result.userName, serverUrl: jellyfinPublicUrl(), expiresAt: result.expiresAt });
  } catch (err) {
    if (err instanceof InviteError) {
      const status = err.code === "invalid" ? 404 : err.code === "expired" || err.code === "revoked" || err.code === "exhausted" ? 410 : err.code === "jellyfin" || err.code === "profile_failed" ? 502 : 400;
      return json({ error: err.message, code: err.code }, { status });
    }
    logger.error({ err }, "invite signup failed");
    return json({ error: "Signup failed. Try again later." }, { status: 500 });
  }
}
