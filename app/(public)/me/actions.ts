"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSelfSession, getSelfSession } from "@/lib/auth/session";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { PUBLIC_LIMITS, RateLimitedError, enforceLimits } from "@/lib/ratelimit";
import { currentRequestId } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";
import { changeOwnPassword, resendOwnVerification, revokeOwnDevice, setOwnEmail } from "@/lib/services/self";

async function requireSelf() {
  const session = await getSelfSession();
  if (!session) redirect("/me");
  return session;
}

export async function logoutSelfAction(): Promise<void> {
  const session = await getSelfSession();
  if (session) recordAudit({ actor: { type: "self", id: session.userId, requestId: await currentRequestId() }, action: "self.logout", targetUserId: session.userId });
  await clearSelfSession();
  redirect("/me");
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const session = await requireSelf();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!current || !next) redirectWithNotice("/me", { error: "Fill in all password fields." }, { revalidate: ["/me"] });
  if (next !== confirm) redirectWithNotice("/me", { error: "The new passwords do not match." }, { revalidate: ["/me"] });
  try {
    enforceLimits([{ key: `me-password:${session.userId}`, ...PUBLIC_LIMITS.loginPerIp }]);
    await changeOwnPassword(session.userId, current, next, await currentRequestId());
  } catch (err) {
    redirectWithNotice("/me", { error: err instanceof RateLimitedError ? "Too many attempts. Try again in a minute." : errorMessage(err) }, { revalidate: ["/me"] });
  }
  redirectWithNotice("/me", { ok: "Password changed." }, { revalidate: ["/me"] });
}

export async function setEmailAction(formData: FormData): Promise<void> {
  const session = await requireSelf();
  const parsed = z.email("Enter a valid email address.").safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) redirectWithNotice("/me", { error: parsed.error.issues[0]?.message ?? "Invalid email." }, { revalidate: ["/me"] });
  try {
    enforceLimits([{ key: `me-email:${session.userId}`, max: 5, windowMs: 3_600_000 }]);
    await setOwnEmail(session.userId, parsed.data, await currentRequestId());
  } catch (err) {
    redirectWithNotice("/me", { error: err instanceof RateLimitedError ? "Too many attempts. Try again later." : errorMessage(err) }, { revalidate: ["/me"] });
  }
  redirectWithNotice("/me", { ok: "Verification email sent. Open the link in it to confirm the address." }, { revalidate: ["/me"] });
}

export async function resendVerificationAction(): Promise<void> {
  const session = await requireSelf();
  try {
    enforceLimits([{ key: `me-email:${session.userId}`, max: 5, windowMs: 3_600_000 }]);
    await resendOwnVerification(session.userId, await currentRequestId());
  } catch (err) {
    redirectWithNotice("/me", { error: err instanceof RateLimitedError ? "Too many attempts. Try again later." : errorMessage(err) }, { revalidate: ["/me"] });
  }
  redirectWithNotice("/me", { ok: "Verification email sent again." }, { revalidate: ["/me"] });
}

export async function revokeOwnDeviceAction(formData: FormData): Promise<void> {
  const session = await requireSelf();
  const deviceId = String(formData.get("deviceId") ?? "");
  try {
    await revokeOwnDevice(session.userId, deviceId, await currentRequestId());
  } catch (err) {
    redirectWithNotice("/me", { error: errorMessage(err) }, { revalidate: ["/me"] });
  }
  redirectWithNotice("/me", { ok: "Device signed out." }, { revalidate: ["/me"] });
}
