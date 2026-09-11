import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userMeta, type AuditRow, type UserMeta } from "@/lib/db/schema";
import { parseDate } from "@/lib/format";
import { JellyfinError, fetchUser, fetchUserImage, fetchUsers, type ValidatedUser } from "@/lib/jellyfin";
import type { SessionView } from "@/lib/sessions/view";
import { activityBasis, computeUserStatus } from "@/lib/users/status";
import type { UserRow } from "@/lib/users/types";
import { listAuditForUser } from "./audit";
import { listDevices, type DeviceView } from "./devices";
import { listSessions } from "./sessions";

/**
 * Makes sure every listed Jellyfin user has a user_meta row. Rows are created lazily
 * with first_seen_at = now; nothing changes in Jellyfin.
 */
export function ensureMetaRows(userIds: string[]): Map<string, UserMeta> {
  const db = getDb();
  const result = new Map<string, UserMeta>();
  if (userIds.length === 0) return result;
  const existing = db.select().from(userMeta).where(inArray(userMeta.jellyfinUserId, userIds)).all();
  for (const row of existing) result.set(row.jellyfinUserId, row);
  const now = new Date();
  const missing = userIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const inserted = db
      .insert(userMeta)
      .values(missing.map((id) => ({ jellyfinUserId: id, labels: [], firstSeenAt: now, updatedAt: now })))
      .onConflictDoNothing()
      .returning()
      .all();
    for (const row of inserted) result.set(row.jellyfinUserId, row);
  }
  return result;
}

export function getMeta(userId: string): UserMeta {
  const row = ensureMetaRows([userId]).get(userId);
  if (!row) throw new Error(`user_meta row missing for ${userId}`);
  return row;
}

interface Counts {
  sessions: Map<string, number>;
  devices: Map<string, number>;
}

function countBy<T>(items: T[], key: (t: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function toUserRow(user: ValidatedUser, meta: UserMeta, counts: Counts, now: Date): UserRow {
  const lastLogin = parseDate(user.LastLoginDate);
  const lastActivity = parseDate(user.LastActivityDate);
  const isDisabled = user.Policy?.IsDisabled ?? false;
  return {
    id: user.Id,
    name: user.Name ?? user.Id,
    isAdmin: user.Policy?.IsAdministrator ?? false,
    isDisabled,
    isHidden: user.Policy?.IsHidden ?? false,
    imageTag: user.PrimaryImageTag ?? null,
    status: computeUserStatus(isDisabled, meta, now),
    profileId: meta.profileId,
    profileName: null,
    drift: null,
    lastLogin,
    lastActivity,
    activityBasis: activityBasis(lastActivity, lastLogin, meta.firstSeenAt),
    activeSessions: counts.sessions.get(user.Id) ?? 0,
    deviceCount: counts.devices.get(user.Id) ?? 0,
    expiresAt: meta.expiresAt,
    labels: meta.labels ?? [],
    meta,
  };
}

async function liveCounts(): Promise<Counts> {
  const [sessions, devices] = await Promise.all([listSessions(), listDevices()]);
  return {
    sessions: countBy(sessions, (s) => s.userId),
    devices: countBy(devices, (d) => d.lastUserId),
  };
}

/** All Jellyfin users with app metadata and live session/device counts. */
export async function listUsers(now: Date = new Date()): Promise<UserRow[]> {
  const [users, counts] = await Promise.all([fetchUsers(), liveCounts()]);
  const metas = ensureMetaRows(users.map((u) => u.Id));
  return users.map((u) => toUserRow(u, metas.get(u.Id)!, counts, now));
}

export interface UserDetail {
  row: UserRow;
  user: ValidatedUser;
  /** The raw policy object exactly as Jellyfin returned it. */
  policy: Record<string, unknown>;
  sessions: SessionView[];
  devices: DeviceView[];
  history: AuditRow[];
}

/** Everything the detail page shows. Returns null when Jellyfin does not know the user. */
export async function getUserDetail(userId: string, now: Date = new Date()): Promise<UserDetail | null> {
  let user: ValidatedUser;
  try {
    user = await fetchUser(userId);
  } catch (err) {
    if (err instanceof JellyfinError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
  const [sessions, devices] = await Promise.all([listSessions(), listDevices()]);
  const meta = getMeta(user.Id);
  const counts: Counts = { sessions: countBy(sessions, (s) => s.userId), devices: countBy(devices, (d) => d.lastUserId) };
  return {
    row: toUserRow(user, meta, counts, now),
    user,
    policy: (user.Policy ?? {}) as Record<string, unknown>,
    sessions: sessions.filter((s) => s.userId === user.Id),
    devices: devices.filter((d) => d.lastUserId === user.Id),
    history: listAuditForUser(user.Id),
  };
}

export async function getUserImage(userId: string, tag?: string): Promise<Response | null> {
  return fetchUserImage(userId, tag);
}
