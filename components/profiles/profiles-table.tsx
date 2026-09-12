import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkRow } from "@/components/ui/link-row";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProfileSummary } from "@/lib/services/profiles";

/** Every profile with what it holds: how many accounts follow it, and how many have drifted. */
export function ProfilesTable({ profiles, action }: { profiles: ProfileSummary[]; /** The New profile button, for the empty state. */ action: ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Profile</TableHead>
          <TableHead className="text-right">Members</TableHead>
          <TableHead className="text-right">Drifting</TableHead>
          <TableHead>Default expiry</TableHead>
          <TableHead>Inactivity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.length === 0 ? (
          <EmptyState.Row
            colSpan={5}
            title="No profiles yet"
            description="A profile is a reusable set of library, playback and parental settings. Assign it to accounts and apply it whenever it changes."
            action={action}
          />
        ) : null}
        {profiles.map((p) => (
          <LinkRow key={p.id} href={`/profiles/${p.id}`}>
            <TableCell>
              <div className="font-medium">
                <Link href={`/profiles/${p.id}`}>{p.name}</Link>
              </div>
              {p.description ? <div className="text-xs text-muted-foreground">{p.description}</div> : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{p.memberCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {p.driftCount ? <StatusBadge tone="warning">{p.driftCount}</StatusBadge> : <span className="text-muted-foreground">none</span>}
            </TableCell>
            <TableCell>{p.defaultExpiryDays ? `${p.defaultExpiryDays} days` : <span className="text-muted-foreground">none</span>}</TableCell>
            <TableCell>{p.inactivityDisableDays ? `${p.inactivityDisableDays} days` : <span className="text-muted-foreground">never</span>}</TableCell>
          </LinkRow>
        ))}
      </TableBody>
    </Table>
  );
}
