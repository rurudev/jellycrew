"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { optionalInt } from "@/lib/forms/zod";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import type { ProfileActionState } from "./state";
import type { PolicyEditorState } from "@/lib/policy/editor-state";
import { parseEditorSubmission } from "@/lib/policy/editor-submit";
import { PolicyFormError } from "@/lib/policy/form";
import { executeBulk } from "@/lib/services/bulk";
import { cloneProfile, createBlankProfile, createProfileFromUser, deleteProfile, listProfileMembers, saveProfilePolicy, updateProfile } from "@/lib/services/profiles";

const optionalDays = optionalInt({ min: 1, max: 3650 });

const ProfileForm = z.object({
  name: z.string().trim().min(1, "A name is required.").max(80),
  description: z.string().trim().max(500).optional(),
  defaultExpiryDays: optionalDays,
  inactivityDisableDays: optionalDays,
});

function parseProfileForm(formData: FormData) {
  return ProfileForm.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    defaultExpiryDays: formData.get("defaultExpiryDays"),
    inactivityDisableDays: formData.get("inactivityDisableDays"),
  });
}

/** Reports back to the dialog, which then sends the operator to the new profile. */
export async function createProfileAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const actor = await adminActor();
  const parsed = parseProfileForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const source = String(formData.get("source") ?? "blank");
  const userId = String(formData.get("userId") ?? "");
  const sourceId = String(formData.get("sourceProfileId") ?? "");
  if (source === "user" && !userId) return { error: "Choose the user to copy settings from." };
  if (source === "clone" && !sourceId) return { error: "Choose the profile to copy." };
  let id: string;
  try {
    id = source === "user" ? (await createProfileFromUser(actor, userId, parsed.data)).id : source === "clone" ? cloneProfile(actor, sourceId, parsed.data).id : createBlankProfile(actor, parsed.data).id;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/profiles");
  return { ok: `Profile ${parsed.data.name} created.`, href: `/profiles/${id}` };
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  const parsed = parseProfileForm(formData);
  if (!parsed.success) redirectWithNotice(`/profiles/${id}`, { error: parsed.error.issues[0]?.message ?? "Invalid input." });
  try {
    updateProfile(actor, id, parsed.data);
  } catch (err) {
    redirectWithNotice(`/profiles/${id}`, { error: errorMessage(err) });
  }
  revalidatePath("/profiles");
  revalidatePath(`/profiles/${id}`);
  redirectWithNotice(`/profiles/${id}`, { ok: "Profile saved." });
}

export async function deleteProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  let unassigned = 0;
  try {
    unassigned = deleteProfile(actor, id).unassigned;
  } catch (err) {
    redirectWithNotice(`/profiles/${id}`, { error: errorMessage(err) });
  }
  revalidatePath("/profiles");
  revalidatePath("/users");
  redirectWithNotice("/profiles", { ok: `Profile deleted; ${unassigned} member(s) unassigned. Nothing changed in Jellyfin.` });
}

export async function saveProfilePolicyAction(_prev: PolicyEditorState, formData: FormData): Promise<PolicyEditorState> {
  const actor = await adminActor();
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) return { status: "error", error: "Missing profile id." };
  let submission;
  try {
    submission = parseEditorSubmission(formData, "profile");
  } catch (err) {
    return { status: "error", error: err instanceof PolicyFormError ? err.message : errorMessage(err) };
  }
  try {
    const result = saveProfilePolicy(actor, { profileId, baseHash: submission.baseHash, base: submission.base, edit: submission.edit, confirm: submission.confirm });
    switch (result.status) {
      case "no_changes":
        return { status: "no_changes", liveHash: result.liveHash, mode: submission.mode };
      case "stale":
        return { status: "stale", edit: submission.edit, live: result.live, liveHash: result.liveHash, changedSince: result.changedSince, mode: submission.mode };
      case "preview":
        return { status: "preview", edit: submission.edit, changes: result.changes, liveHash: result.liveHash, mode: submission.mode };
      case "saved":
        revalidatePath(`/profiles/${profileId}`);
        revalidatePath("/profiles");
        revalidatePath("/users");
        return { status: "saved", changes: result.changes, liveHash: result.liveHash, mode: submission.mode };
    }
  } catch (err) {
    return { status: "error", error: errorMessage(err), edit: submission.edit, mode: submission.mode };
  }
}

/** Two steps in one action: without `confirm` it returns what would change, with it it writes. */
export async function applyToMembersAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  if (!id) return { error: "Missing profile id." };
  if (formData.get("confirm") !== "1") {
    try {
      const members = await listProfileMembers(id);
      return { preview: members.map((m) => ({ id: m.id, name: m.name, changes: m.drift })) };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }
  // Only the members the preview listed, so the count in the result is the count that was shown.
  const chosen = formData.getAll("memberId").map(String).filter(Boolean);
  let results;
  try {
    const members = await listProfileMembers(id);
    const ids = chosen.length ? members.filter((m) => chosen.includes(m.id)).map((m) => m.id) : members.map((m) => m.id);
    if (ids.length === 0) return { error: chosen.length ? "Those members are no longer in this profile. Preview again." : "This profile has no members." };
    if (chosen.length && ids.length < chosen.length) return { error: `Only ${ids.length} of the ${chosen.length} members you saw are still in this profile. Preview again.` };
    results = await executeBulk(actor, "apply_profile", ids, { profileId: id });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  const failed = results.filter((r) => !r.ok);
  revalidatePath(`/profiles/${id}`);
  revalidatePath("/users");
  if (failed.length) return { error: `Applied to ${results.length - failed.length} of ${results.length}. Failed: ${failed.map((f) => `${f.name} (${f.message})`).join(", ")}.` };
  return { ok: results.length === 1 ? "Applied to 1 member." : `Applied to ${results.length} members.` };
}
