"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { createInvite, revokeInvite } from "@/lib/services/invites";

const optionalInt = (max: number) => z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).max(max).nullable());

const CreateForm = z.object({
  label: z.string().trim().max(100).optional(),
  profileId: z.string().optional(),
  linkExpiryDays: optionalInt(3650),
  maxUses: optionalInt(100000),
  accountExpiryDays: optionalInt(3650),
  requireEmail: z.boolean(),
  noteForInvitee: z.string().trim().max(1000).optional(),
});

export async function createInviteAction(formData: FormData): Promise<void> {
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
  if (!parsed.success) redirectWithNotice("/invites", { error: parsed.error.issues[0]?.message ?? "Invalid input." });
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
    redirectWithNotice("/invites", { error: errorMessage(err) });
  }
  revalidatePath("/invites");
  redirect(`/invites?created=${encodeURIComponent(created.invite.id)}`);
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
  redirectWithNotice("/invites", { ok: "Invite revoked." });
}
