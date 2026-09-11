import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { setting } from "@/lib/db/schema";

/** Every persisted setting, with its validation and default. */
export const SettingSchemas = {
  deviceId: z.string().min(8),
  minPasswordLength: z.number().int().min(1).max(128),
  /** Days between "schedule deletion" and the actual delete. */
  graceDays: z.number().int().min(0).max(3650),
  /** Overrides PUBLIC_BASE_URL for links in mails and invites when set. */
  publicBaseUrl: z.url().nullable(),
  /** Jellyfin URL shown to invitees after signup, when it differs from JELLYFIN_URL. */
  jellyfinPublicUrl: z.url().nullable(),
  smtpTestResult: z.object({ at: z.string(), ok: z.boolean(), message: z.string() }).nullable(),
} as const;

export const SETTING_DEFAULTS = {
  minPasswordLength: 8,
  graceDays: 14,
  publicBaseUrl: null as string | null,
  jellyfinPublicUrl: null as string | null,
  smtpTestResult: null as { at: string; ok: boolean; message: string } | null,
} as const;

export function getSettingOrDefault<K extends keyof typeof SETTING_DEFAULTS>(key: K): (typeof SETTING_DEFAULTS)[K] {
  return (getSetting(key) as (typeof SETTING_DEFAULTS)[K] | undefined) ?? SETTING_DEFAULTS[key];
}

export type SettingKey = keyof typeof SettingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SettingSchemas)[K]>;

export function getSetting<K extends SettingKey>(key: K): SettingValue<K> | undefined {
  const row = getDb().select().from(setting).where(eq(setting.key, key)).get();
  if (!row) return undefined;
  const parsed = SettingSchemas[key].safeParse(row.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : undefined;
}

export function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): void {
  const parsed = SettingSchemas[key].parse(value);
  const db = getDb();
  // `null` means "back to the default": the column is NOT NULL, so the row goes away instead.
  if (parsed === null) {
    db.delete(setting).where(eq(setting.key, key)).run();
    return;
  }
  db.insert(setting)
    .values({ key, value: parsed })
    .onConflictDoUpdate({ target: setting.key, set: { value: parsed } })
    .run();
}

/** The stable DeviceId sent in every Jellyfin auth header. Generated once per installation. */
export function ensureDeviceId(): string {
  const existing = getSetting("deviceId");
  if (existing) return existing;
  const id = randomUUID().replace(/-/g, "");
  setSetting("deviceId", id);
  return id;
}
