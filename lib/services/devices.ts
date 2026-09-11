import { JellyfinError, deleteDevice, fetchDevices } from "@/lib/jellyfin";
import { parseDate } from "@/lib/format";
import { ensureDeviceId } from "@/lib/settings";
import type { ValidatedDevice } from "@/lib/jellyfin/schemas";
import { recordAudit, type Actor } from "./audit";
import { invalidateSessionCache } from "./sessions";

export interface DeviceView {
  id: string;
  name: string;
  appName: string | null;
  appVersion: string | null;
  lastUserId: string | null;
  lastUserName: string | null;
  lastActivity: Date | null;
}

export function toDeviceView(d: ValidatedDevice): DeviceView {
  return {
    id: d.Id ?? "",
    name: d.CustomName || d.Name || d.Id || "Unknown device",
    appName: d.AppName ?? null,
    appVersion: d.AppVersion ?? null,
    lastUserId: d.LastUserId ?? null,
    lastUserName: d.LastUserName ?? null,
    lastActivity: parseDate(d.DateLastActivity),
  };
}

/** All known devices, excluding the app's own. Optionally only those last used by one user. */
export async function listDevices(userId?: string): Promise<DeviceView[]> {
  const own = ensureDeviceId();
  const raw = await fetchDevices(userId);
  return raw
    .map(toDeviceView)
    .filter((d) => d.id && d.id !== own)
    .sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));
}

export class DeviceNotFoundError extends Error {
  constructor(deviceId: string) {
    super(`Device ${deviceId} does not exist.`);
    this.name = "DeviceNotFoundError";
  }
}

/** Deletes the device record; Jellyfin revokes every token issued to it. */
export async function revokeDevice(actor: Actor, deviceId: string): Promise<void> {
  if (deviceId === ensureDeviceId()) throw new Error("Refusing to revoke the app's own device.");
  const device = (await listDevices()).find((d) => d.id === deviceId);
  try {
    await deleteDevice(deviceId);
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 404) throw new DeviceNotFoundError(deviceId);
    throw err;
  }
  recordAudit({
    actor,
    action: "device.revoke",
    targetUserId: device?.lastUserId ?? null,
    detail: { deviceId, name: device?.name, appName: device?.appName, lastUserName: device?.lastUserName },
  });
  invalidateSessionCache();
}
