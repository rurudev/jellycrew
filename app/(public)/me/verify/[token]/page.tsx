import Link from "next/link";
import { headers } from "next/headers";
import { RateLimitedError, enforceLimits, PUBLIC_LIMITS } from "@/lib/ratelimit";
import { verifyEmailToken } from "@/lib/services/self";
import { hashToken } from "@/lib/tokens";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Verify email" };

const reasons = {
  invalid: "This verification link is not valid.",
  used: "This verification link was already used.",
  expired: "This verification link has expired. Request a new one from your account page.",
  mismatch: "The address in this link is no longer the one on your account. Request a new link.",
} as const;

export default async function VerifyEmailPage(props: PageProps<"/me/verify/[token]">) {
  const { token } = await props.params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  let result: ReturnType<typeof verifyEmailToken> | { ok: false; reason: "ratelimited" };
  try {
    enforceLimits([
      { key: `verify:ip:${ip}`, ...PUBLIC_LIMITS.perIp },
      { key: `verify:token:${hashToken(token).slice(0, 16)}`, max: 10, windowMs: 3_600_000 },
    ]);
    result = verifyEmailToken(token, h.get("x-request-id") ?? undefined);
  } catch (err) {
    if (err instanceof RateLimitedError) result = { ok: false, reason: "ratelimited" };
    else throw err;
  }
  return (
    <div className="space-y-4">
      {result.ok ? (
        <Alert tone="success" title="Email verified">
          {result.email} is now verified and can be used to reset your password.
        </Alert>
      ) : (
        <Alert tone="warning" title="Could not verify">
          {result.reason === "ratelimited" ? "Too many attempts. Try again later." : reasons[result.reason]}
        </Alert>
      )}
      <p className="text-sm">
        <Link href="/me" className="underline">
          Back to my account
        </Link>
      </p>
    </div>
  );
}
