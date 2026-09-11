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
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        if (format === "csv") {
          controller.enqueue(encoder.encode(auditCsvHeader()));
          for (const row of iterateAudit(filters)) controller.enqueue(encoder.encode(auditRowToCsv(row)));
        } else {
          controller.enqueue(encoder.encode("[\n"));
          let first = true;
          for (const row of iterateAudit(filters)) {
            controller.enqueue(encoder.encode(`${first ? "" : ",\n"}${JSON.stringify(auditRowToPlain(row))}`));
            first = false;
          }
          controller.enqueue(encoder.encode("\n]\n"));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
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
