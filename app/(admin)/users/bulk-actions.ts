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
  date?: string | null;
  days?: number | null;
  label?: string | null;
  preview?: BulkPreviewRow[];
  results?: BulkResultRow[];
  error?: string;
}

const Form = z.object({
  kind: z.enum(BULK_KINDS),
  userIds: z.array(z.string().min(1)).min(1, "Select at least one user."),
  profileId: z.string().optional(),
  date: z.string().optional(),
  days: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().int().positive().optional()),
  label: z.string().trim().max(50).optional(),
  confirm: z.boolean(),
});

export async function bulkAction(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const actor = await adminActor();
  const parsed = Form.safeParse({
    kind: formData.get("kind"),
    userIds: formData.getAll("userIds").map(String),
    profileId: formData.get("profileId") ?? undefined,
    date: formData.get("date") ?? undefined,
    days: formData.get("days") ?? undefined,
    label: formData.get("label") ?? undefined,
    confirm: formData.get("confirm") === "1",
  });
  if (!parsed.success) return { stage: "error", error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { kind, userIds, confirm } = parsed.data;
  const profileId = parsed.data.profileId || null;
  const date = parsed.data.date ? new Date(parsed.data.date).toISOString() : null;
  const days = parsed.data.days ?? null;
  const label = parsed.data.label || null;
  if (kind === "apply_profile" && !profileId) return { stage: "error", error: "Choose a profile." };
  if (kind === "set_expiry" && (!parsed.data.date || Number.isNaN(Date.parse(parsed.data.date)))) return { stage: "error", error: "Choose a date." };
  if (kind === "extend_expiry" && !days) return { stage: "error", error: "Enter a number of days." };
  if ((kind === "add_label" || kind === "remove_label") && !label) return { stage: "error", error: "Enter a label." };
  const params = { profileId, date, days, label };
  try {
    if (!confirm) {
      const preview = await previewBulk(actor, kind, userIds, params);
      return { stage: "preview", kind, userIds, ...params, preview };
    }
    const results = await executeBulk(actor, kind, userIds, params);
    revalidatePath("/users");
    return { stage: "done", kind, userIds, ...params, results };
  } catch (err) {
    return { stage: "error", error: errorMessage(err), kind, userIds, ...params };
  }
}
