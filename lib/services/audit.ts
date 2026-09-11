import { getDb } from "@/lib/db";
import { audit, type ActorType, type AuditRow } from "@/lib/db/schema";
import { logger } from "@/lib/log";

export interface Actor {
  type: ActorType;
  /** Jellyfin user id for admin/self, invite id for invite, null for system. */
  id: string | null;
  requestId?: string;
}

export const SYSTEM_ACTOR: Actor = { type: "system", id: null };

export interface AuditInput {
  actor: Actor;
  action: string;
  targetUserId?: string | null;
  before?: unknown;
  after?: unknown;
  detail?: unknown;
}

/** Appends one audit row. Every Jellyfin write and every app-state change goes through here. */
export function recordAudit(input: AuditInput): AuditRow {
  const row = getDb()
    .insert(audit)
    .values({
      ts: new Date(),
      actorType: input.actor.type,
      actorId: input.actor.id,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      detail: input.detail ?? null,
      requestId: input.actor.requestId ?? null,
    })
    .returning()
    .get();
  logger.info(
    { audit: { id: row.id, action: row.action, actor: `${row.actorType}:${row.actorId ?? "-"}`, target: row.targetUserId }, requestId: row.requestId },
    "audit",
  );
  return row;
}
