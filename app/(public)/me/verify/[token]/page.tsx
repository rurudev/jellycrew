import Link from "next/link";
import { headers } from "next/headers";
import { RateLimitedError, enforceLimits, PUBLIC_LIMITS } from "@/lib/ratelimit";
import { verifyEmailToken } from "@/lib/services/self";
import { hashToken } from "@/lib/tokens";
import { GuestMessage } from "@/components/public/guest-message";

export const metadata = { title: "Verify email" };

const reasons = {
  invalid: "Check that you copied the whole link, including the part after the last slash.",
  used: "This link has already been used, so your address is most likely verified already.",
  expired: "Verification links do not last forever. Ask for a new one from your account page.",
  mismatch: "The address in this link is no longer the one on your account. Ask for a new link.",
  ratelimited: "Too many attempts. Wait a minute and try again.",
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
  const back = (
    <p>
      <Link href="/me" className="underline">
        Back to my account
      </Link>
    </p>
  );
  return result.ok ? (
    <GuestMessage tone="success" title="Email verified" body={`${result.email} can now be used to reset your password.`}>
      {back}
    </GuestMessage>
  ) : (
    <GuestMessage tone="warning" title="That did not verify" body={reasons[result.reason]}>
      {back}
    </GuestMessage>
  );
}
