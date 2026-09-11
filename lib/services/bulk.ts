import { fetchUsers } from "@/lib/jellyfin";
import type { FieldChange } from "@/lib/policy/diff";
import { applyProfilePolicy } from "@/lib/policy/merge";
import { diffPolicies } from "@/lib/policy/diff";
import { checkProtection } from "@/lib/policy/protection";
import { recordAudit, type Actor } from "./audit";
import { applyProfileToUser, assignProfile, getProfile, requireProfile } from "./profiles";
import { toSubject } from "./protection";
import { setUserEnabled } from "./user-actions";
import { ensureMetaRows } from "./users";

import { type BulkKind } from "@/lib/bulk/kinds";

export { BULK_KINDS, BULK_LABELS, type BulkKind } from "@/lib/bulk/kinds";

export interface BulkParams {
  profileId?: string | null;
}

export interface BulkPreviewRow {
  userId: string;
  name: string;
  /** Human summary of what will happen. */
  summary: string;
  changes: FieldChange[];
  /** Set when the user will be skipped, with the reason. */
  skip?: string;
}

export interface BulkResultRow {
  userId: string;
  name: string;
  ok: boolean;
  message: string;
  changes?: FieldChange[];
}

interface Ctx {
  users: Awaited<ReturnType<typeof fetchUsers>>;
  metas: ReturnType<typeof ensureMetaRows>;
  actorId: string | null;
}

async function loadCtx(actorId: string | null): Promise<Ctx> {
  const users = await fetchUsers();
  return { users, metas: ensureMetaRows(users.map((u) => u.Id)), actorId };
}

function previewOne(ctx: Ctx, kind: BulkKind, userId: string, params: BulkParams): BulkPreviewRow {
  const user = ctx.users.find((u) => u.Id === userId);
  if (!user) return { userId, name: userId, summary: "", changes: [], skip: "User no longer exists in Jellyfin." };
  const name = user.Name ?? userId;
  const live = (user.Policy ?? {}) as Record<string, unknown>;
  const meta = ctx.metas.get(userId);
  switch (kind) {
    case "assign_profile": {
      const profile = params.profileId ? getProfile(params.profileId) : null;
      if (params.profileId && !profile) return { userId, name, summary: "", changes: [], skip: "Profile not found." };
      if ((meta?.profileId ?? null) === (profile?.id ?? null)) return { userId, name, summary: "", changes: [], skip: "Already assigned." };
      return { userId, name, summary: profile ? `Assign profile "${profile.name}" (no Jellyfin change)` : "Remove profile assignment", changes: [] };
    }
    case "apply_profile": {
      const profile = params.profileId ? getProfile(params.profileId) : null;
      if (!profile) return { userId, name, summary: "", changes: [], skip: "Profile not found." };
      const changes = diffPolicies(live, applyProfilePolicy(live, profile.policy));
      return { userId, name, summary: changes.length ? `Apply "${profile.name}": ${changes.length} field(s) change` : `Apply "${profile.name}": already matches`, changes };
    }
    case "enable": {
      if (live.IsDisabled !== true) return { userId, name, summary: "", changes: [], skip: "Already enabled." };
      return { userId, name, summary: "Enable account", changes: [{ key: "IsDisabled", before: true, after: false }] };
    }
    case "disable": {
      if (user.Policy?.IsAdministrator) return { userId, name, summary: "", changes: [], skip: "Administrators are excluded from bulk disable." };
      const verdict = checkProtection(ctx.users.map(toSubject), userId, ctx.actorId, "disable");
      if (!verdict.allowed) return { userId, name, summary: "", changes: [], skip: verdict.reason };
      if (live.IsDisabled === true) return { userId, name, summary: "", changes: [], skip: "Already disabled." };
      return { userId, name, summary: "Disable account", changes: [{ key: "IsDisabled", before: false, after: true }] };
    }
  }
}

export async function previewBulk(actor: Actor, kind: BulkKind, userIds: string[], params: BulkParams): Promise<BulkPreviewRow[]> {
  if (kind === "apply_profile" || (kind === "assign_profile" && params.profileId)) requireProfile(params.profileId!);
  const ctx = await loadCtx(actor.type === "admin" ? actor.id : null);
  return userIds.map((id) => previewOne(ctx, kind, id, params));
}

/** Executes sequentially; every user gets a result row, failures never stop the run. */
export async function executeBulk(actor: Actor, kind: BulkKind, userIds: string[], params: BulkParams): Promise<BulkResultRow[]> {
  const preview = await previewBulk(actor, kind, userIds, params);
  const results: BulkResultRow[] = [];
  for (const row of preview) {
    if (row.skip) {
      results.push({ userId: row.userId, name: row.name, ok: true, message: `Skipped: ${row.skip}` });
      continue;
    }
    try {
      switch (kind) {
        case "assign_profile":
          assignProfile(actor, row.userId, params.profileId ?? null);
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "apply_profile": {
          const changes = await applyProfileToUser(actor, row.userId, params.profileId!);
          results.push({ userId: row.userId, name: row.name, ok: true, message: changes.length ? `${changes.length} field(s) updated` : "Already matched; assignment recorded", changes });
          break;
        }
        case "enable":
          await setUserEnabled(actor, row.userId, true);
          results.push({ userId: row.userId, name: row.name, ok: true, message: "Enabled" });
          break;
        case "disable":
          await setUserEnabled(actor, row.userId, false, "manual");
          results.push({ userId: row.userId, name: row.name, ok: true, message: "Disabled" });
          break;
      }
    } catch (err) {
      results.push({ userId: row.userId, name: row.name, ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  }
  recordAudit({
    actor,
    action: `bulk.${kind}`,
    detail: {
      params,
      requested: userIds.length,
      succeeded: results.filter((r) => r.ok && !r.message.startsWith("Skipped")).length,
      skipped: results.filter((r) => r.message.startsWith("Skipped")).length,
      failed: results.filter((r) => !r.ok).length,
      userIds,
    },
  });
  return results;
}
