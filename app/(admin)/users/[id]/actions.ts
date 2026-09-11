"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, withNotice } from "@/lib/notice";
import { copyPolicyFromUser } from "@/lib/services/policies";
import { adoptPolicyFromUser, applyProfileToUser, assignProfile } from "@/lib/services/profiles";
import { renameUser, setUserEnabled, setUserPassword } from "@/lib/services/user-actions";

function back(userId: string, notice: { ok?: string; error?: string }): never {
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  redirect(withNotice(`/users/${userId}`, notice));
}

function userIdFrom(formData: FormData): string {
  const id = String(formData.get("userId") ?? "");
  if (!id) redirect(withNotice("/users", { error: "Missing user id." }));
  return id;
}

export async function setEnabledAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const enabled = formData.get("enabled") === "1";
  try {
    await setUserEnabled(actor, userId, enabled, "manual");
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: enabled ? "User enabled." : "User disabled." });
}

export async function assignProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "") || null;
  try {
    assignProfile(actor, userId, profileId);
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: profileId ? "Profile assigned. Use Apply to push its settings to Jellyfin." : "Profile assignment removed." });
}

export async function applyProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) back(userId, { error: "No profile assigned." });
  let changed = 0;
  try {
    changed = (await applyProfileToUser(actor, userId, profileId)).length;
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: changed ? `Profile applied: ${changed} field(s) updated.` : "Profile applied: nothing needed to change." });
}

export async function adoptIntoProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) back(userId, { error: "No profile assigned." });
  try {
    const result = await adoptPolicyFromUser(actor, profileId, userId);
    const drifting = result.otherMembers.filter((m) => m.willDrift).length;
    back(userId, { ok: `Profile updated from this user (${result.changes.length} field(s)). ${drifting} other member(s) now drift.` });
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
}

export async function renameUserAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const parsed = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!parsed.success) back(userId, { error: "A name is required." });
  try {
    await renameUser(actor, userId, parsed.data);
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: "User renamed." });
}

export async function setPasswordAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) back(userId, { error: "Passwords do not match." });
  try {
    await setUserPassword(actor, userId, password);
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
  back(userId, { ok: "Password updated." });
}

export async function copyPolicyAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) back(userId, { error: "Choose a user to copy from." });
  const confirm = formData.get("confirm") === "1";
  try {
    const changes = await copyPolicyFromUser(actor, userId, sourceId, confirm);
    if (!confirm) {
      const url = new URL(`/users/${userId}`, "http://x");
      url.searchParams.set("copyFrom", sourceId);
      revalidatePath(`/users/${userId}`);
      redirect(`${url.pathname}${url.search}`);
    }
    back(userId, { ok: changes.length ? `Copied ${changes.length} field(s).` : "Nothing to copy: policies already match." });
  } catch (err) {
    back(userId, { error: errorMessage(err) });
  }
}
