import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkRow } from "@/components/ui/link-row";
import { SortHead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timestamp } from "@/components/ui/timestamp";
import { usersQueryToParams, type SortKey, type UsersQuery } from "@/lib/users/query";
import type { UserRow } from "@/lib/users/types";
import { Avatar } from "./avatar";
import { UserStatusBadge } from "./user-status";

const columns: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "name", label: "User" },
  { key: "status", label: "Status" },
  { key: "profile", label: "Profile" },
  { key: "lastLogin", label: "Last login" },
  { key: "lastActivity", label: "Last activity" },
  { key: "sessions", label: "Sessions", align: "right" },
  { key: "devices", label: "Devices", align: "right" },
  { key: "expiry", label: "Expiry" },
  { key: "labels", label: "Labels" },
];

export function UsersTable({ rows, query, selectable = false }: { rows: UserRow[]; query: UsersQuery; selectable?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable ? (
            <TableHead>
              <span className="sr-only">Select</span>
            </TableHead>
          ) : null}
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
            colSpan={columns.length + (selectable ? 1 : 0)}
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
            {selectable ? (
              <TableCell data-no-row-link className="p-0">
                <label className="flex h-9 cursor-pointer items-center px-3">
                  <input type="checkbox" name="userIds" value={r.id} aria-label={`Select ${r.name}`} className="size-4 accent-primary" />
                </label>
              </TableCell>
            ) : null}
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
              {r.profileName ?? <span className="text-muted-foreground">—</span>}
              {r.drift ? (
                <StatusBadge tone="warning" className="ml-1" title="Live policy differs from the profile">
                  drift
                </StatusBadge>
              ) : null}
            </TableCell>
            <TableCell>
              <Timestamp date={r.lastLogin} />
            </TableCell>
            <TableCell>
              <Timestamp date={r.lastActivity} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">{r.activeSessions}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{r.deviceCount}</TableCell>
            <TableCell>{r.expiresAt ? <Timestamp date={r.expiresAt} /> : <span className="text-muted-foreground">never</span>}</TableCell>
            <TableCell className="whitespace-normal">
              <div className="flex flex-wrap gap-1">
                {r.labels.map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
            </TableCell>
          </LinkRow>
        ))}
      </TableBody>
    </Table>
  );
}
