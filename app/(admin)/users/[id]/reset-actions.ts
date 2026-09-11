"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage } from "@/lib/notice";
import { backToUser } from "./shared";
import { adminCreateResetLink, adminEmailResetLink } from "@/lib/services/reset";
import { adminSendVerification } from "@/lib/services/self";

export async function createResetLinkAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  let url: string;
  try {
    ({ url } = await adminCreateResetLink(actor, userId));
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  revalidatePath(`/users/${userId}`);
  const target = new URL(`/users/${userId}`, "http://x");
  target.searchParams.set("resetLink", url);
  redirect(`${target.pathname}${target.search}`);
}

export async function emailResetLinkAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  let email: string;
  try {
    ({ email } = await adminEmailResetLink(actor, userId));
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: `Reset link emailed to ${email}.` });
}

export async function sendVerificationAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    await adminSendVerification(actor, userId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: "Verification email sent." });
}
