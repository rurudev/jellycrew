import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profile as profileTable, userMeta, type Profile } from "@/lib/db/schema";
import { fetchUser, fetchUsers, updateUserPolicy, type ValidatedUser } from "@/lib/jellyfin";
import { JELLYFIN_DEFAULT_MANAGED_POLICY } from "@/lib/policy/defaults";
import { diffPolicies, driftDiff, type FieldChange } from "@/lib/policy/diff";
import { policyHash } from "@/lib/policy/hash";
import { applyProfilePolicy, extractManagedFields, mergeEdit } from "@/lib/policy/merge";
import { PROFILE_MANAGED_FIELDS } from "@/lib/policy/fields";
import { recordAudit, type Actor } from "./audit";
import { withUserPolicyLock } from "./policy-writes";
import { ensureMetaRows, getMeta } from "./users";

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileError";
  }
}

export interface ProfileInput {
  name: string;
  description?: string | null;
  defaultExpiryDays?: number | null;
  inactivityDisableDays?: number | null;
}

export interface ProfileSummary extends Profile {
  memberCount: number;
  driftCount: number;
}

export interface ProfileMember {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  drift: FieldChange[];
}

const managedOnly = (policy: Record<string, unknown>) => Object.fromEntries(PROFILE_MANAGED_FIELDS.filter((k) => k in policy).map((k) => [k, policy[k]]));

export function listProfiles(): Profile[] {
  return getDb().select().from(profileTable).orderBy(asc(profileTable.name)).all();
}

export function getProfile(id: string): Profile | undefined {
  return getDb().select().from(profileTable).where(eq(profileTable.id, id)).get();
}

export function requireProfile(id: string): Profile {
  const p = getProfile(id);
  if (!p) throw new ProfileError("Profile not found.");
  return p;
}

function assertNameFree(name: string, exceptId?: string): void {
  const clash = listProfiles().find((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== exceptId);
  if (clash) throw new ProfileError(`A profile named "${name}" already exists.`);
}

function insertProfile(actor: Actor, input: ProfileInput, policy: Record<string, unknown>, detail: unknown): Profile {
  const name = input.name.trim();
  if (!name) throw new ProfileError("A profile name is required.");
  assertNameFree(name);
  const now = new Date();
  const row = getDb()
    .insert(profileTable)
    .values({
      id: randomUUID(),
      name,
      description: input.description?.trim() || null,
      policy: managedOnly(policy),
      defaultExpiryDays: input.defaultExpiryDays ?? null,
      inactivityDisableDays: input.inactivityDisableDays ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  recordAudit({ actor, action: "profile.create", after: { id: row.id, name: row.name }, detail });
  return row;
}

/** Blank profile: Jellyfin's defaults for a new user. */
export function createBlankProfile(actor: Actor, input: ProfileInput): Profile {
  return insertProfile(actor, input, JELLYFIN_DEFAULT_MANAGED_POLICY, { source: "blank" });
}

/** Snapshot of a user's current profile-managed fields. */
export async function createProfileFromUser(actor: Actor, userId: string, input: ProfileInput): Promise<Profile> {
  const user = await fetchUser(userId);
  const snapshot = extractManagedFields((user.Policy ?? {}) as Record<string, unknown>);
  return insertProfile(actor, input, snapshot, { source: "user", userId, userName: user.Name });
}

export function cloneProfile(actor: Actor, sourceId: string, input: ProfileInput): Profile {
  const source = requireProfile(sourceId);
  return insertProfile(
    actor,
    { ...input, description: input.description ?? source.description, defaultExpiryDays: input.defaultExpiryDays ?? source.defaultExpiryDays, inactivityDisableDays: input.inactivityDisableDays ?? source.inactivityDisableDays },
    source.policy,
    { source: "clone", sourceProfileId: source.id, sourceProfileName: source.name },
  );
}

export function updateProfile(actor: Actor, id: string, patch: Partial<ProfileInput>): Profile {
  const before = requireProfile(id);
  const name = patch.name !== undefined ? patch.name.trim() : before.name;
  if (!name) throw new ProfileError("A profile name is required.");
  assertNameFree(name, id);
  const row = getDb()
    .update(profileTable)
    .set({
      name,
      description: patch.description !== undefined ? patch.description?.trim() || null : before.description,
      defaultExpiryDays: patch.defaultExpiryDays !== undefined ? patch.defaultExpiryDays : before.defaultExpiryDays,
      inactivityDisableDays: patch.inactivityDisableDays !== undefined ? patch.inactivityDisableDays : before.inactivityDisableDays,
      updatedAt: new Date(),
    })
    .where(eq(profileTable.id, id))
    .returning()
    .get();
  recordAudit({
    actor,
    action: "profile.update",
    before: { name: before.name, description: before.description, defaultExpiryDays: before.defaultExpiryDays, inactivityDisableDays: before.inactivityDisableDays },
    after: { name: row.name, description: row.description, defaultExpiryDays: row.defaultExpiryDays, inactivityDisableDays: row.inactivityDisableDays },
    detail: { profileId: id },
  });
  return row;
}

export type ProfilePolicySaveResult =
  | { status: "no_changes"; liveHash: string }
  | { status: "stale"; live: Record<string, unknown>; liveHash: string; changedSince: FieldChange[] }
  | { status: "preview"; changes: FieldChange[]; liveHash: string }
  | { status: "saved"; changes: FieldChange[]; liveHash: string };

/** Same stale-write protected flow as user policies, against the stored profile policy. */
export function saveProfilePolicy(
  actor: Actor,
  input: { profileId: string; baseHash: string; base?: Record<string, unknown>; edit: Record<string, unknown>; confirm: boolean },
): ProfilePolicySaveResult {
  const profile = requireProfile(input.profileId);
  const live = profile.policy;
  const liveHash = policyHash(live);
  if (liveHash !== input.baseHash) {
    return { status: "stale", live, liveHash, changedSince: input.base ? diffPolicies(input.base, live) : [] };
  }
  const merged = managedOnly(mergeEdit(live, input.edit));
  const changes = diffPolicies(live, merged);
  if (changes.length === 0) return { status: "no_changes", liveHash };
  if (!input.confirm) return { status: "preview", changes, liveHash };
  getDb().update(profileTable).set({ policy: merged, updatedAt: new Date() }).where(eq(profileTable.id, profile.id)).run();
  const keys = changes.map((c) => c.key);
  recordAudit({
    actor,
    action: "profile.policy.update",
    before: Object.fromEntries(keys.map((k) => [k, live[k] ?? null])),
    after: Object.fromEntries(keys.map((k) => [k, merged[k] ?? null])),
    detail: { profileId: profile.id, name: profile.name, keys },
  });
  return { status: "saved", changes, liveHash: policyHash(merged) };
}

/** Deleting a profile unassigns members; nothing changes in Jellyfin. */
export function deleteProfile(actor: Actor, id: string): { unassigned: number } {
  const profile = requireProfile(id);
  const db = getDb();
  const members = db.select({ id: userMeta.jellyfinUserId }).from(userMeta).where(eq(userMeta.profileId, id)).all();
  db.update(userMeta).set({ profileId: null, updatedAt: new Date() }).where(eq(userMeta.profileId, id)).run();
  db.delete(profileTable).where(eq(profileTable.id, id)).run();
  recordAudit({ actor, action: "profile.delete", before: { id, name: profile.name }, detail: { unassignedUserIds: members.map((m) => m.id) } });
  return { unassigned: members.length };
}

/** Links a user to a profile (or none). Changes nothing in Jellyfin; drift may appear. */
export function assignProfile(actor: Actor, userId: string, profileId: string | null): void {
  const meta = getMeta(userId);
  const target = profileId ? requireProfile(profileId) : null;
  if (meta.profileId === (target?.id ?? null)) return;
  getDb().update(userMeta).set({ profileId: target?.id ?? null, updatedAt: new Date() }).where(eq(userMeta.jellyfinUserId, userId)).run();
  const beforeName = meta.profileId ? (getProfile(meta.profileId)?.name ?? meta.profileId) : null;
  recordAudit({
    actor,
    action: "user.profile.assign",
    targetUserId: userId,
    before: { profileId: meta.profileId, profileName: beforeName },
    after: { profileId: target?.id ?? null, profileName: target?.name ?? null },
  });
}

export async function previewApplyProfile(userId: string, profileId: string): Promise<FieldChange[]> {
  const [user, profile] = [await fetchUser(userId), requireProfile(profileId)];
  const live = (user.Policy ?? {}) as Record<string, unknown>;
  return diffPolicies(live, applyProfilePolicy(live, profile.policy));
}

/**
 * Pushes the profile's managed fields onto the user (read-modify-write) and records the
 * assignment. Per-user and unknown fields are preserved.
 */
export async function applyProfileToUser(actor: Actor, userId: string, profileId: string): Promise<FieldChange[]> {
  return withUserPolicyLock(userId, () => applyProfileToUserLocked(actor, userId, profileId));
}

async function applyProfileToUserLocked(actor: Actor, userId: string, profileId: string): Promise<FieldChange[]> {
  const profile = requireProfile(profileId);
  const user = await fetchUser(userId);
  const live = (user.Policy ?? {}) as Record<string, unknown>;
  const merged = applyProfilePolicy(live, profile.policy);
  const changes = diffPolicies(live, merged);
  if (changes.length > 0) await updateUserPolicy(userId, merged);
  const keys = changes.map((c) => c.key);
  recordAudit({
    actor,
    action: "profile.apply",
    targetUserId: userId,
    before: Object.fromEntries(keys.map((k) => [k, live[k] ?? null])),
    after: Object.fromEntries(keys.map((k) => [k, merged[k] ?? null])),
    detail: { profileId: profile.id, profileName: profile.name, keys },
  });
  const meta = getMeta(userId);
  if (meta.profileId !== profile.id) assignProfile(actor, userId, profile.id);
  return changes;
}

export interface AdoptPreview {
  changes: FieldChange[];
  otherMembers: Array<{ id: string; name: string; willDrift: boolean }>;
}

/** What adopting `userId`'s live managed fields into the profile would change, and who drifts as a result. */
export async function previewAdopt(profileId: string, userId: string): Promise<AdoptPreview> {
  const profile = requireProfile(profileId);
  const users = await fetchUsers();
  const user = users.find((u) => u.Id === userId);
  if (!user) throw new ProfileError("User not found.");
  const snapshot = extractManagedFields((user.Policy ?? {}) as Record<string, unknown>);
  const changes = diffPolicies(profile.policy, snapshot);
  const members = membersOf(profile, users).filter((m) => m.id !== userId);
  return {
    changes,
    otherMembers: members.map((m) => ({ id: m.id, name: m.name, willDrift: driftDiff(m.live, snapshot).length > 0 })),
  };
}

export async function adoptPolicyFromUser(actor: Actor, profileId: string, userId: string): Promise<AdoptPreview> {
  const preview = await previewAdopt(profileId, userId);
  const profile = requireProfile(profileId);
  const user = await fetchUser(userId);
  const snapshot = extractManagedFields((user.Policy ?? {}) as Record<string, unknown>);
  getDb().update(profileTable).set({ policy: snapshot, updatedAt: new Date() }).where(eq(profileTable.id, profileId)).run();
  const keys = preview.changes.map((c) => c.key);
  recordAudit({
    actor,
    action: "profile.adopt",
    targetUserId: userId,
    before: Object.fromEntries(keys.map((k) => [k, profile.policy[k] ?? null])),
    after: Object.fromEntries(keys.map((k) => [k, snapshot[k] ?? null])),
    detail: { profileId, profileName: profile.name, keys, membersNowDrifting: preview.otherMembers.filter((m) => m.willDrift).length },
  });
  return preview;
}

interface MemberLive {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  live: Record<string, unknown>;
}

function membersOf(profile: Profile, users: ValidatedUser[]): MemberLive[] {
  const metas = ensureMetaRows(users.map((u) => u.Id));
  return users
    .filter((u) => metas.get(u.Id)?.profileId === profile.id)
    .map((u) => ({
      id: u.Id,
      name: u.Name ?? u.Id,
      isAdmin: u.Policy?.IsAdministrator ?? false,
      isDisabled: u.Policy?.IsDisabled ?? false,
      live: (u.Policy ?? {}) as Record<string, unknown>,
    }));
}

export async function listProfileMembers(profileId: string): Promise<ProfileMember[]> {
  const profile = requireProfile(profileId);
  const users = await fetchUsers();
  return membersOf(profile, users).map((m) => ({ id: m.id, name: m.name, isAdmin: m.isAdmin, isDisabled: m.isDisabled, drift: driftDiff(m.live, profile.policy) }));
}

/** Profiles with member and drift counts (one GET /Users for all). */
export async function listProfilesWithCounts(): Promise<ProfileSummary[]> {
  const profiles = listProfiles();
  if (profiles.length === 0) return [];
  const users = await fetchUsers();
  const metas = ensureMetaRows(users.map((u) => u.Id));
  return profiles.map((p) => {
    const members = users.filter((u) => metas.get(u.Id)?.profileId === p.id);
    const driftCount = members.filter((u) => driftDiff((u.Policy ?? {}) as Record<string, unknown>, p.policy).length > 0).length;
    return { ...p, memberCount: members.length, driftCount };
  });
}

/** Drift of one user against their assigned profile, or null when unassigned. */
export function userDrift(live: Record<string, unknown>, profile: Profile | null | undefined): FieldChange[] | null {
  return profile ? driftDiff(live, profile.policy) : null;
}
