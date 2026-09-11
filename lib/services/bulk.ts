import { fetchUsers } from "@/lib/jellyfin";
import type { FieldChange } from "@/lib/policy/diff";
import { applyProfilePolicy } from "@/lib/policy/merge";
import { diffPolicies } from "@/lib/policy/diff";
import { checkProtection } from "@/lib/policy/protection";
import { recordAudit, type Actor } from "./audit";
import { addLabel, cancelDeletion, extendExpiry, removeLabel, scheduleDeletion, setExpiry } from "./lifecycle";
import { applyProfileToUser, assignProfile, getProfile, requireProfile } from "./profiles";
import { getSettingOrDefault } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mail";
import { adminEmailResetLink } from "./reset";
import { absoluteTime } from "@/lib/format";
import { toSubject } from "./protection";
import { setUserEnabled } from "./user-actions";
import { ensureMetaRows } from "./users";

import { type BulkKind } from "@/lib/bulk/kinds";

export { BULK_KINDS, BULK_LABELS, type BulkKind } from "@/lib/bulk/kinds";

export interface BulkParams {
  profileId?: string | null;
  /** ISO date for set_expiry. */
  date?: string | null;
  /** Days for extend_expiry. */
  days?: number | null;
  label?: string | null;
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
    case "set_expiry": {
      const date = params.date ? new Date(params.date) : null;
      if (!date || Number.isNaN(date.getTime())) return { userId, name, summary: "", changes: [], skip: "Invalid date." };
      if (user.Policy?.IsAdministrator) return { userId, name, summary: "", changes: [], skip: "Administrators are excluded from automation; an expiry would never be enforced." };
      return { userId, name, summary: `Expire ${absoluteTime(date)}`, changes: [{ key: "expiresAt", before: meta?.expiresAt ?? null, after: date }] };
    }
    case "extend_expiry": {
      if (!params.days || params.days <= 0) return { userId, name, summary: "", changes: [], skip: "Invalid number of days." };
      if (user.Policy?.IsAdministrator) return { userId, name, summary: "", changes: [], skip: "Administrators are excluded from automation." };
      const now = new Date();
      const base = meta?.expiresAt && meta.expiresAt > now ? meta.expiresAt : now;
      const after = new Date(base.getTime() + params.days * 86_400_000);
      return { userId, name, summary: `Extend expiry by ${params.days} day(s) to ${absoluteTime(after)}`, changes: [{ key: "expiresAt", before: meta?.expiresAt ?? null, after }] };
    }
    case "clear_expiry": {
      if (!meta?.expiresAt) return { userId, name, summary: "", changes: [], skip: "No expiry set." };
      return { userId, name, summary: "Remove expiry", changes: [{ key: "expiresAt", before: meta.expiresAt, after: null }] };
    }
    case "schedule_deletion": {
      if (user.Policy?.IsAdministrator) return { userId, name, summary: "", changes: [], skip: "Administrators are excluded from bulk delete." };
      const verdict = checkProtection(ctx.users.map(toSubject), userId, ctx.actorId, "delete");
      if (!verdict.allowed) return { userId, name, summary: "", changes: [], skip: verdict.reason };
      if (meta?.deleteAfter) return { userId, name, summary: "", changes: [], skip: "Deletion already scheduled." };
      const grace = getSettingOrDefault("graceDays");
      const deleteAfter = new Date(Date.now() + grace * 86_400_000);
      return {
        userId,
        name,
        summary: `Disable now, delete after ${grace} day(s) (${absoluteTime(deleteAfter)})`,
        changes: [
          { key: "IsDisabled", before: live.IsDisabled === true, after: true },
          { key: "deleteAfter", before: null, after: deleteAfter },
        ],
      };
    }
    case "cancel_deletion": {
      if (!meta?.deleteAfter) return { userId, name, summary: "", changes: [], skip: "No deletion scheduled." };
      return {
        userId,
        name,
        summary: "Cancel deletion and re-enable",
        changes: [
          { key: "deleteAfter", before: meta.deleteAfter, after: null },
          { key: "IsDisabled", before: live.IsDisabled === true, after: false },
        ],
      };
    }
    case "add_label": {
      const label = params.label?.trim();
      if (!label) return { userId, name, summary: "", changes: [], skip: "Empty label." };
      if (meta?.labels.includes(label)) return { userId, name, summary: "", changes: [], skip: "Already has the label." };
      return { userId, name, summary: `Add label "${label}"`, changes: [{ key: "labels", before: meta?.labels ?? [], after: [...(meta?.labels ?? []), label] }] };
    }
    case "remove_label": {
      const label = params.label?.trim();
      if (!label) return { userId, name, summary: "", changes: [], skip: "Empty label." };
      if (!meta?.labels.includes(label)) return { userId, name, summary: "", changes: [], skip: "Does not have the label." };
      return { userId, name, summary: `Remove label "${label}"`, changes: [{ key: "labels", before: meta.labels, after: meta.labels.filter((l) => l !== label) }] };
    }
    case "send_reset_link": {
      if (!isMailConfigured()) return { userId, name, summary: "", changes: [], skip: "SMTP is not configured." };
      if (!meta?.email) return { userId, name, summary: "", changes: [], skip: "No email address on file." };
      return { userId, name, summary: `Email a reset link to ${meta.email}`, changes: [] };
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
        case "set_expiry":
          setExpiry(actor, row.userId, new Date(params.date!));
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "extend_expiry":
          extendExpiry(actor, row.userId, params.days!);
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "clear_expiry":
          setExpiry(actor, row.userId, null);
          results.push({ userId: row.userId, name: row.name, ok: true, message: "Expiry removed" });
          break;
        case "schedule_deletion":
          await scheduleDeletion(actor, row.userId);
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "cancel_deletion":
          await cancelDeletion(actor, row.userId);
          results.push({ userId: row.userId, name: row.name, ok: true, message: "Deletion cancelled, account enabled" });
          break;
        case "add_label":
          addLabel(actor, row.userId, params.label!);
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "remove_label":
          removeLabel(actor, row.userId, params.label!);
          results.push({ userId: row.userId, name: row.name, ok: true, message: row.summary });
          break;
        case "send_reset_link": {
          const { email } = await adminEmailResetLink(actor, row.userId);
          results.push({ userId: row.userId, name: row.name, ok: true, message: `Reset link emailed to ${email}` });
          break;
        }
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
