"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { optionalInt } from "@/lib/forms/zod";
import type { ActionState } from "@/lib/forms/action-state";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { createInvite, revokeInvite } from "@/lib/services/invites";

const CreateForm = z.object({
  label: z.string().trim().max(100).optional(),
  profileId: z.string().optional(),
  linkExpiryDays: optionalInt({ max: 3650 }),
  maxUses: optionalInt({ max: 100000 }),
  accountExpiryDays: optionalInt({ max: 3650 }),
  requireEmail: z.boolean(),
  noteForInvitee: z.string().trim().max(1000).optional(),
});

/** The link comes back to the dialog that asked for it rather than travelling in the URL. */
export async function createInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminActor();
  const parsed = CreateForm.safeParse({
    label: formData.get("label") ?? "",
    profileId: formData.get("profileId") ?? "",
    linkExpiryDays: formData.get("linkExpiryDays"),
    maxUses: formData.get("maxUses"),
    accountExpiryDays: formData.get("accountExpiryDays"),
    requireEmail: formData.get("requireEmail") === "on",
    noteForInvitee: formData.get("noteForInvitee") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  let created;
  try {
    created = await createInvite(actor, {
      label: parsed.data.label,
      profileId: parsed.data.profileId || null,
      linkExpiryDays: parsed.data.linkExpiryDays,
      maxUses: parsed.data.maxUses === 0 ? null : parsed.data.maxUses,
      accountExpiryDays: parsed.data.accountExpiryDays === 0 ? null : parsed.data.accountExpiryDays,
      requireEmail: parsed.data.requireEmail,
      noteForInvitee: parsed.data.noteForInvitee,
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/invites");
  return { ok: "Invite created.", link: created.url };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const id = String(formData.get("inviteId") ?? "");
  try {
    revokeInvite(actor, id);
  } catch (err) {
    redirectWithNotice("/invites", { error: errorMessage(err) });
  }
  revalidatePath("/invites");
  redirectWithNotice("/invites", { ok: "Invite revoked. The link stops working straight away." });
}
