"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage } from "@/lib/notice";
import { BULK_KINDS, type BulkKind } from "@/lib/bulk/kinds";
import { executeBulk, previewBulk, type BulkPreviewRow, type BulkResultRow } from "@/lib/services/bulk";

export interface BulkState {
  stage: "idle" | "preview" | "done" | "error";
  kind?: BulkKind;
  userIds?: string[];
  profileId?: string | null;
  preview?: BulkPreviewRow[];
  results?: BulkResultRow[];
  error?: string;
}

const Form = z.object({
  kind: z.enum(BULK_KINDS),
  userIds: z.array(z.string().min(1)).min(1, "Select at least one user."),
  profileId: z.string().optional(),
  confirm: z.boolean(),
});

export async function bulkAction(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const actor = await adminActor();
  const parsed = Form.safeParse({
    kind: formData.get("kind"),
    userIds: formData.getAll("userIds").map(String),
    profileId: formData.get("profileId") ?? undefined,
    confirm: formData.get("confirm") === "1",
  });
  if (!parsed.success) return { stage: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { kind, userIds, confirm } = parsed.data;
  const profileId = parsed.data.profileId || null;
  if ((kind === "apply_profile" || kind === "assign_profile") && !profileId && kind === "apply_profile") {
    return { stage: "error", error: "Choose a profile." };
  }
  try {
    if (!confirm) {
      const preview = await previewBulk(actor, kind, userIds, { profileId });
      return { stage: "preview", kind, userIds, profileId, preview };
    }
    const results = await executeBulk(actor, kind, userIds, { profileId });
    revalidatePath("/users");
    return { stage: "done", kind, userIds, profileId, results };
  } catch (err) {
    return { stage: "error", error: errorMessage(err), kind, userIds, profileId };
  }
}
