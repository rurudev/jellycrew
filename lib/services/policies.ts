import { fetchUser, updateUserPolicy } from "@/lib/jellyfin";
import { diffPolicies, type FieldChange } from "@/lib/policy/diff";
import { policyHash } from "@/lib/policy/hash";
import { copyManagedFields, mergeEdit } from "@/lib/policy/merge";
import { recordAudit, type Actor } from "./audit";
import { withUserPolicyLock } from "./policy-writes";
import { assertProtected } from "./protection";
import { markDisabledByApp } from "./users";

export type PolicySaveResult =
  | { status: "no_changes"; liveHash: string }
  | { status: "stale"; live: Record<string, unknown>; liveHash: string; changedSince: FieldChange[] }
  | { status: "preview"; changes: FieldChange[]; liveHash: string }
  | { status: "saved"; changes: FieldChange[]; liveHash: string };

export interface PolicySaveInput {
  userId: string;
  /** Hash of the policy the editor was rendered from. */
  baseHash: string;
  /** The policy the editor was rendered from, to explain what changed on a stale write. */
  base?: Record<string, unknown>;
  /** Field values submitted by the editor (known keys only are applied). */
  edit: Record<string, unknown>;
  /** false = compute and return the diff only; true = write. */
  confirm: boolean;
}

function pick(policy: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, policy[k] ?? null]));
}

/**
 * Read-modify-write of one user's policy with stale-write protection: the live policy is
 * refetched, compared with the hash the editor carried, merged with the edit and diffed.
 */
export async function saveUserPolicy(actor: Actor, input: PolicySaveInput): Promise<PolicySaveResult> {
  const user = await fetchUser(input.userId);
  const live = (user.Policy ?? {}) as Record<string, unknown>;
  const liveHash = policyHash(live);
  if (liveHash !== input.baseHash) {
    return { status: "stale", live, liveHash, changedSince: input.base ? diffPolicies(input.base, live) : [] };
  }
  const merged = mergeEdit(live, input.edit);
  const changes = diffPolicies(live, merged);
  if (changes.length === 0) return { status: "no_changes", liveHash };

  const disabling = changes.some((c) => c.key === "IsDisabled" && c.after === true);
  const demoting = changes.some((c) => c.key === "IsAdministrator" && c.after === false);
  if (disabling) await assertProtected(actor, input.userId, "disable");
  if (demoting) await assertProtected(actor, input.userId, "demote");

  if (!input.confirm) return { status: "preview", changes, liveHash };

  await updateUserPolicy(input.userId, merged);
  const keys = changes.map((c) => c.key);
  recordAudit({
    actor,
    action: "user.policy.update",
    targetUserId: input.userId,
    before: pick(live, keys),
    after: pick(merged, keys),
    detail: { keys, baseHash: input.baseHash },
  });
  if (disabling) markDisabledByApp(input.userId, "manual");
  if (changes.some((c) => c.key === "IsDisabled" && c.after === false)) markDisabledByApp(input.userId, null);
  return { status: "saved", changes, liveHash: policyHash(merged) };
}

/** Copies the profile-managed fields of `sourceId` onto `targetId`. Per-user fields are untouched. */
export async function copyPolicyFromUser(actor: Actor, targetId: string, sourceId: string, confirm: boolean): Promise<FieldChange[]> {
  if (targetId === sourceId) throw new Error("Source and target are the same user.");
  return withUserPolicyLock(targetId, () => copyPolicyFromUserLocked(actor, targetId, sourceId, confirm));
}

async function copyPolicyFromUserLocked(actor: Actor, targetId: string, sourceId: string, confirm: boolean): Promise<FieldChange[]> {
  const [target, source] = await Promise.all([fetchUser(targetId), fetchUser(sourceId)]);
  const live = (target.Policy ?? {}) as Record<string, unknown>;
  const merged = copyManagedFields(live, (source.Policy ?? {}) as Record<string, unknown>);
  const changes = diffPolicies(live, merged);
  if (!confirm || changes.length === 0) return changes;
  await updateUserPolicy(targetId, merged);
  const keys = changes.map((c) => c.key);
  recordAudit({
    actor,
    action: "user.policy.copy",
    targetUserId: targetId,
    before: pick(live, keys),
    after: pick(merged, keys),
    detail: { sourceUserId: sourceId, sourceUserName: source.Name, keys },
  });
  return changes;
}
