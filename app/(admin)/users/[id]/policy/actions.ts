"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage } from "@/lib/notice";
import type { PolicyEditorState } from "@/lib/policy/editor-state";
import { parseEditorSubmission } from "@/lib/policy/editor-submit";
import { PolicyFormError } from "@/lib/policy/form";
import { ProtectionError } from "@/lib/policy/protection";
import { saveUserPolicy } from "@/lib/services/policies";

export async function saveUserPolicyAction(_prev: PolicyEditorState, formData: FormData): Promise<PolicyEditorState> {
  const actor = await adminActor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { status: "error", error: "Missing user id." };
  let submission;
  try {
    submission = parseEditorSubmission(formData, "all");
  } catch (err) {
    unstable_rethrow(err);
    return { status: "error", error: err instanceof PolicyFormError ? err.message : errorMessage(err) };
  }
  try {
    const result = await saveUserPolicy(actor, { userId, baseHash: submission.baseHash, base: submission.base, edit: submission.edit, confirm: submission.confirm });
    switch (result.status) {
      case "no_changes":
        return { status: "no_changes", liveHash: result.liveHash, mode: submission.mode };
      case "stale":
        return { status: "stale", edit: submission.edit, live: result.live, liveHash: result.liveHash, changedSince: result.changedSince, mode: submission.mode };
      case "preview":
        return { status: "preview", edit: submission.edit, changes: result.changes, liveHash: result.liveHash, mode: submission.mode };
      case "saved":
        revalidatePath(`/users/${userId}`);
        revalidatePath("/users");
        return { status: "saved", changes: result.changes, liveHash: result.liveHash, mode: submission.mode };
    }
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ProtectionError) return { status: "error", error: err.message, edit: submission.edit, mode: submission.mode };
    return { status: "error", error: errorMessage(err), edit: submission.edit, mode: submission.mode };
  }
}
