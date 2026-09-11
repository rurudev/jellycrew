"use server";

import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { backToUser, refreshUser } from "./shared";
import type { ActionState } from "./state";
import { copyPolicyFromUser } from "@/lib/services/policies";
import { adoptPolicyFromUser, applyProfileToUser, assignProfile } from "@/lib/services/profiles";
import { renameUser, setUserEnabled, setUserPassword } from "@/lib/services/user-actions";

function userIdFrom(formData: FormData): string {
  const id = String(formData.get("userId") ?? "");
  if (!id) redirectWithNotice("/users", { error: "Missing user id." });
  return id;
}

export async function setEnabledAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  const enabled = formData.get("enabled") === "1";
  try {
    await setUserEnabled(actor, userId, enabled, "manual");
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: enabled ? "User enabled." : "User disabled." };
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

export async function renameUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  const parsed = z.string().trim().min(1).max(100).safeParse(formData.get("name"));
  if (!parsed.success) return { error: "A name is required." };
  try {
    await renameUser(actor, userId, parsed.data);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: `Renamed to ${parsed.data}.` };
}

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords do not match." };
  try {
    await setUserPassword(actor, userId, password);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  refreshUser(userId);
  return { ok: "Password updated." };
}

export async function copyPolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id." };
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return { error: "Choose a user to copy from." };
  const confirm = formData.get("confirm") === "1";
  let changes;
  try {
    changes = await copyPolicyFromUser(actor, userId, sourceId, confirm);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  if (!confirm) return { preview: { sourceId, changes } };
  refreshUser(userId);
  return { ok: changes.length === 0 ? "Nothing to copy: the policies already match." : `Copied ${changes.length} ${changes.length === 1 ? "field" : "fields"}.` };
}
