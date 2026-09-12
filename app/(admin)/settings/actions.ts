"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminActor } from "@/lib/auth/actor";
import { errorMessage, redirectWithNotice } from "@/lib/notice";
import { recordAudit } from "@/lib/services/audit";
import { runLifecycleJob } from "@/lib/services/scheduler";
import { getSettingOrDefault, setSetting } from "@/lib/settings";
import { sendMail, verifySmtp } from "@/lib/mail";
import { env } from "@/lib/env";

const SettingsForm = z.object({
  graceDays: z.coerce.number().int().min(0).max(3650),
  minPasswordLength: z.coerce.number().int().min(1).max(128),
  publicBaseUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : (v as string).trim().replace(/\/+$/, "")), z.url("Enter a full URL, including https://").nullable()),
  jellyfinPublicUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : (v as string).trim().replace(/\/+$/, "")), z.url("Enter a full URL, including https://").nullable()),
});

type SettingKey = keyof z.infer<typeof SettingsForm>;
const SETTING_KEYS: SettingKey[] = ["graceDays", "minPasswordLength", "publicBaseUrl", "jellyfinPublicUrl"];

/**
 * Saves the settings a form actually carries. The page has one form per section, and a form
 * that never showed a field must not blank it.
 */
export async function saveSettingsAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const present = SETTING_KEYS.filter((key) => formData.has(key));
  if (present.length === 0) redirectWithNotice("/settings", { error: "Nothing to save." });
  const parsed = SettingsForm.pick(Object.fromEntries(present.map((key) => [key, true])) as Record<SettingKey, true>).safeParse(
    Object.fromEntries(present.map((key) => [key, formData.get(key)])),
  );
  if (!parsed.success) redirectWithNotice("/settings", { error: parsed.error.issues[0]?.message ?? "Invalid input." });
  const values = parsed.data as Partial<z.infer<typeof SettingsForm>>;
  const before = Object.fromEntries(present.map((key) => [key, getSettingOrDefault(key)]));
  for (const key of present) setSetting(key, values[key] ?? null);
  recordAudit({ actor, action: "settings.update", before, after: values });
  revalidatePath("/settings");
  redirectWithNotice("/settings", { ok: "Settings saved." });
}

export async function runLifecycleNowAction(): Promise<void> {
  const actor = await adminActor();
  let result;
  try {
    result = await runLifecycleJob();
  } catch (err) {
    redirectWithNotice("/settings", { error: errorMessage(err) });
  }
  recordAudit({ actor, action: "lifecycle.run_now", detail: result ?? { skipped: "lock held" } });
  revalidatePath("/settings");
  redirectWithNotice("/settings", result ? { ok: `Lifecycle run finished: ${result.disabled.length} disabled, ${result.deleted.length} deleted, ${result.errors.length} error(s).` } : { error: "A lifecycle run is already in progress." });
}

export async function testSmtpAction(formData: FormData): Promise<void> {
  const actor = await adminActor();
  const to = String(formData.get("to") ?? "").trim();
  let result = await verifySmtp();
  if (result.ok && to) {
    try {
      await sendMail({ to, subject: "jellycrew SMTP test", text: `This is a test message from jellycrew (${env().PUBLIC_BASE_URL}). SMTP works.` });
      result = { ok: true, message: `Connection verified and test mail sent to ${to}` };
    } catch (err) {
      result = { ok: false, message: `Connection verified but sending failed: ${errorMessage(err)}` };
    }
  }
  setSetting("smtpTestResult", { at: new Date().toISOString(), ...result });
  recordAudit({ actor, action: "settings.smtp_test", detail: { ...result, to: to || null } });
  revalidatePath("/settings");
  redirectWithNotice("/settings", result.ok ? { ok: result.message } : { error: result.message });
}
