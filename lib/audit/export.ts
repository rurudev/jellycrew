import type { AuditRow } from "@/lib/db/schema";

const columns = ["id", "ts", "actor_type", "actor_id", "action", "target_user_id", "before", "after", "detail", "request_id"] as const;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function auditRowToPlain(r: AuditRow) {
  return {
    id: r.id,
    ts: r.ts.toISOString(),
    actor_type: r.actorType,
    actor_id: r.actorId,
    action: r.action,
    target_user_id: r.targetUserId,
    before: r.before,
    after: r.after,
    detail: r.detail,
    request_id: r.requestId,
  };
}

export function auditCsvHeader(): string {
  return columns.join(",") + "\n";
}

export function auditRowToCsv(r: AuditRow): string {
  const p = auditRowToPlain(r);
  return columns.map((c) => csvCell(p[c])).join(",") + "\n";
}
