import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timestamp } from "@/components/ui/timestamp";
import type { AuditRow } from "@/lib/db/schema";

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return String(value) !== "";
}

/** The three payload columns collapse into one disclosure: nothing is truncated mid-word. */
function Payload({ row }: { row: AuditRow }) {
  const parts = (
    [
      ["Before", row.before],
      ["After", row.after],
      ["Detail", row.detail],
    ] as const
  ).filter(([, value]) => hasContent(value));
  if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <details className="group/payload">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{parts.map(([label]) => label.toLowerCase()).join(", ")}</summary>
      <div className="mt-1.5 space-y-1.5">
        {parts.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Every change jellycrew made, newest first. */
export function AuditTable({ rows, names, filtered }: { rows: AuditRow[]; /** Jellyfin id to name, for actors and targets. */ names: Map<string, string>; filtered: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Did what</TableHead>
          <TableHead>To whom</TableHead>
          <TableHead>What changed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyState.Row
            colSpan={5}
            title={filtered ? "Nothing matches these filters" : "Nothing recorded yet"}
            description={filtered ? "Widen the range or clear the filters." : "Every change made through jellycrew is recorded here, including the ones the scheduler makes."}
          />
        ) : null}
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">
              <Timestamp date={row.ts} />
              <div className="text-xs text-muted-foreground">#{row.id}</div>
            </TableCell>
            <TableCell>
              <div>{row.actorType}</div>
              {row.actorId ? (
                <div className="text-xs text-muted-foreground" title={row.actorId}>
                  {names.get(row.actorId) ?? `${row.actorId.slice(0, 8)}…`}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <code className="text-xs">{row.action}</code>
            </TableCell>
            <TableCell>
              {row.targetUserId ? (
                <Link href={`/users/${row.targetUserId}`} title={row.targetUserId}>
                  {names.get(row.targetUserId) ?? `${row.targetUserId.slice(0, 8)}…`}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-xl">
              <Payload row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
