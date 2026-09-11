import { and, desc, eq, gte, like, lt, lte } from "drizzle-orm";
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

export function listAuditForUser(userId: string, limit = 100): AuditRow[] {
  return getDb().select().from(audit).where(eq(audit.targetUserId, userId)).orderBy(desc(audit.id)).limit(limit).all();
}

export interface AuditFilters {
  actorType?: ActorType;
  actorId?: string;
  action?: string;
  targetUserId?: string;
  from?: Date;
  to?: Date;
  /** Only rows with id < beforeId (pagination, newest first). */
  beforeId?: number;
}

function auditWhere(f: AuditFilters) {
  const conds = [];
  if (f.actorType) conds.push(eq(audit.actorType, f.actorType));
  if (f.actorId) conds.push(eq(audit.actorId, f.actorId));
  if (f.action) conds.push(f.action.endsWith("*") ? like(audit.action, `${f.action.slice(0, -1)}%`) : eq(audit.action, f.action));
  if (f.targetUserId) conds.push(eq(audit.targetUserId, f.targetUserId));
  if (f.from) conds.push(gte(audit.ts, f.from));
  if (f.to) conds.push(lte(audit.ts, f.to));
  if (f.beforeId !== undefined) conds.push(lt(audit.id, f.beforeId));
  return conds.length ? and(...conds) : undefined;
}

export function listAudit(filters: AuditFilters, limit = 200): AuditRow[] {
  return getDb().select().from(audit).where(auditWhere(filters)).orderBy(desc(audit.id)).limit(limit).all();
}

/** Streams every matching row (newest first) in pages, for exports. */
export function* iterateAudit(filters: AuditFilters, pageSize = 500): Generator<AuditRow> {
  let beforeId: number | undefined = filters.beforeId;
  for (;;) {
    const page = listAudit({ ...filters, beforeId }, pageSize);
    for (const row of page) yield row;
    if (page.length < pageSize) return;
    beforeId = page[page.length - 1].id;
  }
}

export function distinctAuditActions(): string[] {
  return getDb()
    .selectDistinct({ action: audit.action })
    .from(audit)
    .orderBy(audit.action)
    .all()
    .map((r) => r.action);
}
