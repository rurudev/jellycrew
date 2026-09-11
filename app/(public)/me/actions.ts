"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSelfSession, getSelfSession } from "@/lib/auth/session";
import { errorMessage, withNotice } from "@/lib/notice";
import { PUBLIC_LIMITS, RateLimitedError, enforceLimits } from "@/lib/ratelimit";
import { currentRequestId } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";
import { changeOwnPassword, resendOwnVerification, revokeOwnDevice, setOwnEmail } from "@/lib/services/self";

function back(notice: { ok?: string; error?: string }): never {
  revalidatePath("/me");
  redirect(withNotice("/me", notice));
}

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
  if (!current || !next) back({ error: "Fill in all password fields." });
  if (next !== confirm) back({ error: "The new passwords do not match." });
  try {
    enforceLimits([{ key: `me-password:${session.userId}`, ...PUBLIC_LIMITS.loginPerIp }]);
    await changeOwnPassword(session.userId, current, next, await currentRequestId());
  } catch (err) {
    back({ error: err instanceof RateLimitedError ? "Too many attempts. Try again in a minute." : errorMessage(err) });
  }
  back({ ok: "Password changed." });
}

export async function setEmailAction(formData: FormData): Promise<void> {
  const session = await requireSelf();
  const parsed = z.email("Enter a valid email address.").safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) back({ error: parsed.error.issues[0]?.message ?? "Invalid email." });
  try {
    enforceLimits([{ key: `me-email:${session.userId}`, max: 5, windowMs: 3_600_000 }]);
    await setOwnEmail(session.userId, parsed.data, await currentRequestId());
  } catch (err) {
    back({ error: err instanceof RateLimitedError ? "Too many attempts. Try again later." : errorMessage(err) });
  }
  back({ ok: "Verification email sent. Open the link in it to confirm the address." });
}

export async function resendVerificationAction(): Promise<void> {
  const session = await requireSelf();
  try {
    enforceLimits([{ key: `me-email:${session.userId}`, max: 5, windowMs: 3_600_000 }]);
    await resendOwnVerification(session.userId, await currentRequestId());
  } catch (err) {
    back({ error: err instanceof RateLimitedError ? "Too many attempts. Try again later." : errorMessage(err) });
  }
  back({ ok: "Verification email sent again." });
}

export async function revokeOwnDeviceAction(formData: FormData): Promise<void> {
  const session = await requireSelf();
  const deviceId = String(formData.get("deviceId") ?? "");
  try {
    await revokeOwnDevice(session.userId, deviceId, await currentRequestId());
  } catch (err) {
    back({ error: errorMessage(err) });
  }
  back({ ok: "Device signed out." });
}
