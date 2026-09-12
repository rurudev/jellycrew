import { getAdminSession } from "@/lib/auth/session";
import { auditCsvHeader, auditRowToCsv, auditRowToPlain } from "@/lib/audit/export";
import { iterateAudit } from "@/lib/services/audit";
import { parseAuditFilters } from "../page";

export const dynamic = "force-dynamic";

/** Streams the filtered audit log as CSV or JSON. Same filters as the page. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getAdminSession())) return new Response("unauthorized", { status: 401 });
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const format = params.format === "csv" ? "csv" : "json";
  const filters = parseAuditFilters(params);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const encoder = new TextEncoder();
  const rows = iterateAudit(filters);
  let started = false;
  let wroteRow = false;
  // A chunk per pull, batched: the client's pace decides how fast rows leave SQLite, without
  // paying a socket write per row. Producing the whole file in start() would block the event
  // loop and hold the result in memory.
  const ROWS_PER_CHUNK = 200;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        const parts: string[] = [];
        if (!started) {
          started = true;
          parts.push(format === "csv" ? auditCsvHeader() : "[\n");
        }
        let done = false;
        for (let i = 0; i < ROWS_PER_CHUNK; i++) {
          const next = rows.next();
          if (next.done) {
            done = true;
            break;
          }
          if (format === "csv") {
            parts.push(auditRowToCsv(next.value));
          } else {
            parts.push(`${wroteRow ? ",\n" : ""}${JSON.stringify(auditRowToPlain(next.value))}`);
          }
          wroteRow = true;
        }
        if (done && format === "json") parts.push("\n]\n");
        if (parts.length > 0) controller.enqueue(encoder.encode(parts.join("")));
        if (done) controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      rows.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="jellycrew-audit-${stamp}.${format}"`,
      "cache-control": "no-store",
    },
  });
}
