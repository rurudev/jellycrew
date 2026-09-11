"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, withNotice } from "@/lib/notice";
import type { PolicyEditorState } from "@/lib/policy/editor-state";
import { parseEditorSubmission } from "@/lib/policy/editor-submit";
import { PolicyFormError } from "@/lib/policy/form";
import { executeBulk } from "@/lib/services/bulk";
import { cloneProfile, createBlankProfile, createProfileFromUser, deleteProfile, listProfileMembers, saveProfilePolicy, updateProfile } from "@/lib/services/profiles";

const optionalDays = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).max(3650).nullable());

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

export async function createProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const parsed = parseProfileForm(formData);
  if (!parsed.success) redirect(withNotice("/profiles", { error: parsed.error.issues[0]?.message ?? "Invalid input." }));
  const source = String(formData.get("source") ?? "blank");
  const userId = String(formData.get("userId") ?? "");
  const sourceId = String(formData.get("sourceProfileId") ?? "");
  if (source === "user" && !userId) redirect(withNotice("/profiles", { error: "Choose a user to snapshot." }));
  if (source === "clone" && !sourceId) redirect(withNotice("/profiles", { error: "Choose a profile to clone." }));
  let id: string;
  try {
    id = source === "user" ? (await createProfileFromUser(actor, userId, parsed.data)).id : source === "clone" ? cloneProfile(actor, sourceId, parsed.data).id : createBlankProfile(actor, parsed.data).id;
  } catch (err) {
    redirect(withNotice("/profiles", { error: errorMessage(err) }));
  }
  revalidatePath("/profiles");
  redirect(withNotice(`/profiles/${id}`, { ok: "Profile created." }));
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  const parsed = parseProfileForm(formData);
  if (!parsed.success) redirect(withNotice(`/profiles/${id}`, { error: parsed.error.issues[0]?.message ?? "Invalid input." }));
  try {
    updateProfile(actor, id, parsed.data);
  } catch (err) {
    redirect(withNotice(`/profiles/${id}`, { error: errorMessage(err) }));
  }
  revalidatePath("/profiles");
  revalidatePath(`/profiles/${id}`);
  redirect(withNotice(`/profiles/${id}`, { ok: "Profile saved." }));
}

export async function deleteProfileAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  let unassigned = 0;
  try {
    unassigned = deleteProfile(actor, id).unassigned;
  } catch (err) {
    redirect(withNotice(`/profiles/${id}`, { error: errorMessage(err) }));
  }
  revalidatePath("/profiles");
  revalidatePath("/users");
  redirect(withNotice("/profiles", { ok: `Profile deleted; ${unassigned} member(s) unassigned. Nothing changed in Jellyfin.` }));
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

/** Apply the profile to every member: preview (redirect with ?applyAll=1) then confirm. */
export async function applyToMembersAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("profileId") ?? "");
  const confirm = formData.get("confirm") === "1";
  if (!confirm) redirect(`/profiles/${id}?applyAll=1`);
  let results;
  try {
    const members = await listProfileMembers(id);
    results = await executeBulk(actor, "apply_profile", members.map((m) => m.id), { profileId: id });
  } catch (err) {
    redirect(withNotice(`/profiles/${id}`, { error: errorMessage(err) }));
  }
  const failed = results.filter((r) => !r.ok);
  revalidatePath(`/profiles/${id}`);
  revalidatePath("/users");
  redirect(
    withNotice(`/profiles/${id}`, failed.length ? { error: `Applied to ${results.length - failed.length} member(s); ${failed.length} failed: ${failed.map((f) => `${f.name}: ${f.message}`).join("; ")}` } : { ok: `Applied to ${results.length} member(s).` }),
  );
}
