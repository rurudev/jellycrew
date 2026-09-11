"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { backToUser } from "./shared";
import { cancelDeletion, deleteUserNow, scheduleDeletion, updateUserMeta } from "@/lib/services/lifecycle";

const MetaForm = z.object({
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.email("Enter a valid email address.").nullable()),
  notes: z.string().max(5000),
  labels: z.string().max(1000),
  expiresAt: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().nullable()),
  inactivityDisableDays: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : Number(v)), z.number().int().min(1).max(3650).nullable()),
});

export async function updateMetaAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  const parsed = MetaForm.safeParse({
    email: formData.get("email"),
    notes: formData.get("notes") ?? "",
    labels: formData.get("labels") ?? "",
    expiresAt: formData.get("expiresAt"),
    inactivityDisableDays: formData.get("inactivityDisableDays"),
  });
  if (!parsed.success) backToUser(userId, { error: parsed.error.issues[0]?.message ?? "Invalid input." });
  let expiresAt: Date | null = null;
  if (parsed.data.expiresAt) {
    expiresAt = new Date(parsed.data.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) backToUser(userId, { error: "Invalid expiry date." });
  }
  try {
    updateUserMeta(actor, userId, {
      email: parsed.data.email,
      notes: parsed.data.notes,
      labels: parsed.data.labels.split(","),
      expiresAt,
      inactivityDisableDays: parsed.data.inactivityDisableDays,
    });
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: "Lifecycle settings saved." });
}

export async function scheduleDeletionAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  let m;
  try {
    m = await scheduleDeletion(actor, userId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: `Disabled now; will be deleted after ${m.deleteAfter?.toISOString().slice(0, 10)}.` });
}

export async function cancelDeletionAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    await cancelDeletion(actor, userId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: "Deletion cancelled and account enabled." });
}

export async function deleteNowAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    await deleteUserNow(actor, userId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  revalidatePath("/users");
  redirectWithNotice("/users", { ok: "User deleted." });
}
