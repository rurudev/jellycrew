"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, withNotice } from "@/lib/notice";
import { adminCreateResetLink, adminEmailResetLink } from "@/lib/services/reset";
import { adminSendVerification } from "@/lib/services/self";

function back(userId: string, notice: { ok?: string; error?: string }): never {
  revalidatePath(`/users/${userId}`);
  redirect(withNotice(`/users/${userId}`, notice));
}

export async function createResetLinkAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    const { url } = await adminCreateResetLink(actor, userId);
    revalidatePath(`/users/${userId}`);
    const target = new URL(`/users/${userId}`, "http://x");
    target.searchParams.set("resetLink", url);
    redirect(`${target.pathname}${target.search}`);
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
}

export async function emailResetLinkAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    const { email } = await adminEmailResetLink(actor, userId);
    back(userId, { ok: `Reset link emailed to ${email}.` });
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
}

export async function sendVerificationAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    await adminSendVerification(actor, userId);
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: "Verification email sent." });
}
