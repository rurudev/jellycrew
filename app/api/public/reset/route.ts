import { z } from "zod";
import { isMailConfigured } from "@/lib/mail";
import { RateLimitedError, clientIp, enforceLimits, ipLimit } from "@/lib/ratelimit";
import { json, originAllowed, readJson, tooMany } from "@/lib/public/http";
import { RESET_GENERIC_MESSAGE, requestPasswordReset } from "@/lib/services/reset";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const Body = z.object({ identifier: z.string().trim().min(1).max(200) });

/** Forgot password. The response is identical whether or not the identifier matched. */
export async function POST(request: Request): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Cross-site request refused." }, { status: 403 });
  if (!isMailConfigured()) return json({ error: "Password reset by email is not available on this server. Contact the administrator." , code: "no_mail" }, { status: 503 });
  const body = await readJson(request);
  const parsed = Body.safeParse(body ?? {});
  if (!parsed.success) return json({ error: "Enter your username or email address." }, { status: 400 });
  try {
    enforceLimits([
      ...ipLimit(`reset:ip:${clientIp(request)}`, clientIp(request), { max: 5, windowMs: 60_000 }),
      { key: `reset:id:${hashToken(parsed.data.identifier.toLowerCase()).slice(0, 16)}`, max: 5, windowMs: 3_600_000 },
    ]);
  } catch (err) {
    if (err instanceof RateLimitedError) return tooMany(err);
    throw err;
  }
  await requestPasswordReset(parsed.data.identifier, { ip: clientIp(request), requestId: request.headers.get("x-request-id") ?? undefined });
  return json({ ok: true, message: RESET_GENERIC_MESSAGE });
}
