import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { Time } from "@/components/time";
import { absoluteTime } from "@/lib/format";
import { usersQueryToParams, type SortKey, type UsersQuery } from "@/lib/users/query";
import type { UserRow } from "@/lib/users/types";
import { Avatar } from "./avatar";
import { StatusBadge } from "./status-badge";

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

function SortHeader({ col, query }: { col: (typeof columns)[number]; query: UsersQuery }) {
  const active = query.sort === col.key;
  const nextDir = active && query.dir === "asc" ? "desc" : "asc";
  const params = usersQueryToParams({ ...query, sort: col.key, dir: nextDir });
  return (
    <Th className={col.align === "right" ? "text-right" : ""}>
      <Link href={`/users?${params.toString()}`} className="hover:text-zinc-900 dark:hover:text-white">
        {col.label}
        {active ? <span aria-hidden> {query.dir === "asc" ? "▲" : "▼"}</span> : null}
      </Link>
    </Th>
  );
}

export function UsersTable({ rows, query, selectable = false }: { rows: UserRow[]; query: UsersQuery; selectable?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          {selectable ? <Th className="w-8"><span className="sr-only">Select</span></Th> : null}
          {columns.map((c) => (
            <SortHeader key={c.key} col={c} query={query} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyRow colSpan={columns.length + (selectable ? 1 : 0)}>No users match.</EmptyRow> : null}
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
            {selectable ? (
              <Td>
                <input type="checkbox" name="userIds" value={r.id} aria-label={`Select ${r.name}`} />
              </Td>
            ) : null}
            <Td>
              <Link href={`/users/${r.id}`} className="flex items-center gap-2 font-medium">
                <Avatar userId={r.id} name={r.name} imageTag={r.imageTag} />
                <span>{r.name}</span>
                {r.isAdmin ? <Badge tone="purple">admin</Badge> : null}
                {r.isHidden ? <Badge>hidden</Badge> : null}
              </Link>
            </Td>
            <Td>
              <StatusBadge status={r.status} />
            </Td>
            <Td>
              {r.profileName ?? <span className="text-zinc-400">—</span>}
              {r.drift ? (
                <Badge tone="amber" className="ml-1" title="Live policy differs from the profile">
                  drift
                </Badge>
              ) : null}
            </Td>
            <Td>
              <Time date={r.lastLogin} />
            </Td>
            <Td>
              <Time date={r.lastActivity} />
            </Td>
            <Td className="text-right tabular-nums">{r.activeSessions}</Td>
            <Td className="text-right tabular-nums">{r.deviceCount}</Td>
            <Td>{r.expiresAt ? <span title={absoluteTime(r.expiresAt)}><Time date={r.expiresAt} /></span> : <span className="text-zinc-400">never</span>}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {r.labels.map((l) => (
                  <Badge key={l} tone="blue">
                    {l}
                  </Badge>
                ))}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
