"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, withNotice } from "@/lib/notice";
import { recordAudit } from "@/lib/services/audit";
import { runLifecycleJob } from "@/lib/services/scheduler";
import { getSettingOrDefault, setSetting } from "@/lib/settings";

const SettingsForm = z.object({
  graceDays: z.coerce.number().int().min(0).max(3650),
  minPasswordLength: z.coerce.number().int().min(1).max(128),
  publicBaseUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : (v as string).trim().replace(/\/+$/, "")), z.url().nullable()),
});

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const parsed = SettingsForm.safeParse({
    graceDays: formData.get("graceDays"),
    minPasswordLength: formData.get("minPasswordLength"),
    publicBaseUrl: formData.get("publicBaseUrl"),
  });
  if (!parsed.success) redirect(withNotice("/settings", { error: parsed.error.issues[0]?.message ?? "Invalid input." }));
  const before = { graceDays: getSettingOrDefault("graceDays"), minPasswordLength: getSettingOrDefault("minPasswordLength"), publicBaseUrl: getSettingOrDefault("publicBaseUrl") };
  setSetting("graceDays", parsed.data.graceDays);
  setSetting("minPasswordLength", parsed.data.minPasswordLength);
  setSetting("publicBaseUrl", parsed.data.publicBaseUrl);
  recordAudit({ actor, action: "settings.update", before, after: parsed.data });
  revalidatePath("/settings");
  redirect(withNotice("/settings", { ok: "Settings saved." }));
}

export async function runLifecycleNowAction(): Promise<void> {
  const actor = await adminActor();
  try {
    const result = await runLifecycleJob();
    recordAudit({ actor, action: "lifecycle.run_now", detail: result ?? { skipped: "lock held" } });
    revalidatePath("/settings");
    redirect(
      withNotice("/settings", result ? { ok: `Lifecycle run finished: ${result.disabled.length} disabled, ${result.deleted.length} deleted, ${result.errors.length} error(s).` } : { error: "A lifecycle run is already in progress." }),
    );
  } catch (err) {
    redirect(withNotice("/settings", { error: errorMessage(err) }));
  }
}
