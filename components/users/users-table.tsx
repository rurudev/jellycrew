import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkRow } from "@/components/ui/link-row";
import { StatusDot } from "@/components/ui/status-badge";
import { SortHead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timestamp } from "@/components/ui/timestamp";
import { absoluteTime } from "@/lib/format";
import { usersQueryToParams, type SortKey, type UsersQuery } from "@/lib/users/query";
import type { UserRow } from "@/lib/users/types";
import { Avatar } from "./avatar";
import { RowSelect, SelectAll } from "./bulk-bar";
import { UserStatusBadge } from "./user-status";

/** Seven columns: what the admin acts on. Devices and the separate login column live on the detail page. */
const columns: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "name", label: "User" },
  { key: "status", label: "Status" },
  { key: "profile", label: "Profile" },
  { key: "lastActivity", label: "Last seen" },
  { key: "expiry", label: "Expiry" },
  { key: "labels", label: "Labels" },
  { key: "sessions", label: "Sessions", align: "right" },
];

function lastSeenTitle(r: UserRow): string {
  return `Last activity: ${r.lastActivity ? absoluteTime(r.lastActivity) : "never"} · Last login: ${r.lastLogin ? absoluteTime(r.lastLogin) : "never"}`;
}

export function UsersTable({ rows, query }: { rows: UserRow[]; query: UsersQuery }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <SelectAll />
          </TableHead>
          {columns.map((c) => {
            const active = query.sort === c.key;
            const nextDir = active && query.dir === "asc" ? "desc" : "asc";
            const params = usersQueryToParams({ ...query, sort: c.key, dir: nextDir });
            return <SortHead key={c.key} label={c.label} active={active} dir={query.dir} href={`/users?${params.toString()}`} className={c.align === "right" ? "text-right" : undefined} />;
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyState.Row
            colSpan={columns.length + 1}
            title="No users match"
            description="Nobody matches these filters."
            action={
              <Link href="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Clear filters
              </Link>
            }
          />
        ) : null}
        {rows.map((r) => (
          <LinkRow key={r.id} href={`/users/${r.id}`}>
            <TableCell data-no-row-link className="w-8">
              <RowSelect id={r.id} name={r.name} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar userId={r.id} name={r.name} imageTag={r.imageTag} size={24} />
                <Link href={`/users/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.isAdmin ? <Tag>admin</Tag> : null}
                {r.isHidden ? <Tag>hidden</Tag> : null}
              </div>
            </TableCell>
            <TableCell>
              <UserStatusBadge status={r.status} />
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5">
                {r.profileName ?? <span className="text-muted-foreground">—</span>}
                {r.drift ? (
                  <span title="Live policy differs from the profile" className="inline-flex">
                    <StatusDot tone="warning" />
                    <span className="sr-only">drifts from profile</span>
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Timestamp date={r.lastActivity} title={lastSeenTitle(r)} />
            </TableCell>
            <TableCell className="whitespace-nowrap">{r.expiresAt ? <Timestamp date={r.expiresAt} /> : <span className="text-muted-foreground">never</span>}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {r.labels.map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {r.activeSessions > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot tone="primary" />
                  {r.activeSessions}
                </span>
              ) : null}
            </TableCell>
          </LinkRow>
        ))}
      </TableBody>
    </Table>
  );
}
