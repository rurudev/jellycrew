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
  // One chunk per pull, so the client's pace decides how fast rows are read out of SQLite.
  // Producing the whole file in start() would block the event loop and hold it all in memory.
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(encoder.encode(format === "csv" ? auditCsvHeader() : "[\n"));
          return;
        }
        const next = rows.next();
        if (!next.done) {
          const row = next.value;
          controller.enqueue(encoder.encode(format === "csv" ? auditRowToCsv(row) : `${wroteRow ? ",\n" : ""}${JSON.stringify(auditRowToPlain(row))}`));
          wroteRow = true;
          return;
        }
        if (format === "json") controller.enqueue(encoder.encode("\n]\n"));
        controller.close();
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
