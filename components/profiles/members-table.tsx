import Link from "next/link";
import { Tag } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProfileMember } from "@/lib/services/profiles";

/** Who follows this profile, and who has drifted away from it. */
export function MembersTable({ members }: { members: ProfileMember[] }) {
  return (
    <Table variant="plain">
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead className="text-right">Drift</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.length === 0 ? <EmptyState.Row colSpan={2} title="No members yet" description="Assign this profile from a user's page, or to several users at once from the users list." /> : null}
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1.5">
                <Link href={`/users/${m.id}`}>{m.name}</Link>
                {m.isAdmin ? <Tag>admin</Tag> : null}
                {m.isDisabled ? <StatusBadge tone="destructive">disabled</StatusBadge> : null}
              </span>
            </TableCell>
            <TableCell className="text-right">
              {m.drift.length ? <StatusBadge tone="warning">{m.drift.length === 1 ? "1 field" : `${m.drift.length} fields`}</StatusBadge> : <span className="text-muted-foreground">matches</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
