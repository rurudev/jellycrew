"use server";

import { adminActor } from "@/lib/auth/actor";
import { errorMessage } from "@/lib/notice";
import { refreshUser } from "./shared";
import type { ActionState } from "./state";
import { adminCreateResetLink, adminEmailResetLink } from "@/lib/services/reset";
import { adminSendVerification } from "@/lib/services/self";

/** The link is returned to the dialog that asked for it; it never enters the URL. */
export async function createResetLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  let url: string;
  try {
    ({ url } = await adminCreateResetLink(actor, userId));
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: "Reset link created.", link: url };
}

export async function emailResetLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  let email: string;
  try {
    ({ email } = await adminEmailResetLink(actor, userId));
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: `Reset link emailed to ${email}.` };
}

export async function sendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  try {
    await adminSendVerification(actor, userId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: "Verification email sent." };
}
