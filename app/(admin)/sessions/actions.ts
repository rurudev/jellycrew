"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice, safeReturnTo } from "@/lib/notice";
import { revokeDevice } from "@/lib/services/devices";
import { sendSessionMessage, stopPlayback } from "@/lib/services/sessions";

const StopForm = z.object({ sessionId: z.string().min(1) });
const MessageForm = z.object({ sessionId: z.string().min(1), text: z.string().trim().min(1).max(500), header: z.string().trim().max(100).optional() });
const RevokeForm = z.object({ deviceId: z.string().min(1) });

export async function stopPlaybackAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sessions");
  const parsed = StopForm.safeParse({ sessionId: formData.get("sessionId") });
  if (!parsed.success) redirectWithNotice(returnTo, { error: "Missing session id." });
  try {
    await stopPlayback(actor, parsed.data.sessionId);
  } catch (err) {
    redirectWithNotice(returnTo, { error: errorMessage(err) });
  }
  revalidatePath(returnTo);
  redirectWithNotice(returnTo, { ok: "Playback stopped." });
}

export async function sendMessageAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sessions");
  const parsed = MessageForm.safeParse({
    sessionId: formData.get("sessionId"),
    text: formData.get("text"),
    header: formData.get("header") || undefined,
  });
  if (!parsed.success) redirectWithNotice(returnTo, { error: "A message text is required." });
  try {
    await sendSessionMessage(actor, parsed.data.sessionId, { text: parsed.data.text, header: parsed.data.header ?? "Message from the server", timeoutMs: 10_000 });
  } catch (err) {
    redirectWithNotice(returnTo, { error: errorMessage(err) });
  }
  redirectWithNotice(returnTo, { ok: "Message sent." });
}

export async function revokeDeviceAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/sessions");
  const parsed = RevokeForm.safeParse({ deviceId: formData.get("deviceId") });
  if (!parsed.success) redirectWithNotice(returnTo, { error: "Missing device id." });
  try {
    await revokeDevice(actor, parsed.data.deviceId);
  } catch (err) {
    redirectWithNotice(returnTo, { error: errorMessage(err) });
  }
  revalidatePath(returnTo);
  redirectWithNotice(returnTo, { ok: "Device revoked." });
}
