"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { backToUser } from "./shared";
import { copyPolicyFromUser } from "@/lib/services/policies";
import { adoptPolicyFromUser, applyProfileToUser, assignProfile } from "@/lib/services/profiles";
import { renameUser, setUserEnabled, setUserPassword } from "@/lib/services/user-actions";

function userIdFrom(formData: FormData): string {
  const id = String(formData.get("userId") ?? "");
  if (!id) redirectWithNotice("/users", { error: "Missing user id." });
  return id;
}

export async function setEnabledAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const enabled = formData.get("enabled") === "1";
  try {
    await setUserEnabled(actor, userId, enabled, "manual");
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: enabled ? "User enabled." : "User disabled." });
}

export async function assignProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "") || null;
  try {
    assignProfile(actor, userId, profileId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: profileId ? "Profile assigned. Use Apply to push its settings to Jellyfin." : "Profile assignment removed." });
}

export async function applyProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) backToUser(userId, { error: "No profile assigned." });
  let changed = 0;
  try {
    changed = (await applyProfileToUser(actor, userId, profileId)).length;
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: changed ? `Profile applied: ${changed} field(s) updated.` : "Profile applied: nothing needed to change." });
}

export async function adoptIntoProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) backToUser(userId, { error: "No profile assigned." });
  let result;
  try {
    result = await adoptPolicyFromUser(actor, profileId, userId);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  const drifting = result.otherMembers.filter((m) => m.willDrift).length;
  backToUser(userId, { ok: `Profile updated from this user (${result.changes.length} field(s)). ${drifting} other member(s) now drift.` });
}

export async function renameUserAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const parsed = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!parsed.success) backToUser(userId, { error: "A name is required." });
  try {
    await renameUser(actor, userId, parsed.data);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: "User renamed." });
}

export async function setPasswordAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) backToUser(userId, { error: "Passwords do not match." });
  try {
    await setUserPassword(actor, userId, password);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  backToUser(userId, { ok: "Password updated." });
}

export async function copyPolicyAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const userId = userIdFrom(formData);
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) backToUser(userId, { error: "Choose a user to copy from." });
  const confirm = formData.get("confirm") === "1";
  let changes;
  try {
    changes = await copyPolicyFromUser(actor, userId, sourceId, confirm);
  } catch (err) {
    backToUser(userId, { error: errorMessage(err) });
  }
  if (!confirm) {
    const url = new URL(`/users/${userId}`, "http://x");
    url.searchParams.set("copyFrom", sourceId);
    revalidatePath(`/users/${userId}`);
    redirect(`${url.pathname}${url.search}`);
  }
  backToUser(userId, { ok: changes.length ? `Copied ${changes.length} field(s).` : "Nothing to copy: policies already match." });
}
