import Link from "next/link";
import { Tag } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-field";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timestamp } from "@/components/ui/timestamp";
import type { InviteStatus, InviteWithUses } from "@/lib/services/invites";
import { revokeInviteAction } from "@/app/(admin)/invites/actions";

const tone: Record<InviteStatus, StatusTone> = { active: "success", expired: "neutral", exhausted: "neutral", revoked: "destructive" };

export function InvitesTable({ invites, profiles, links, action }: { invites: InviteWithUses[]; profiles: Array<{ id: string; name: string }>; /** Live link per active invite. */ links: Map<string, string>; /** The New invite button, for the empty state. */ action: React.ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Profile</TableHead>
          <TableHead>Uses</TableHead>
          <TableHead>Link expires</TableHead>
          <TableHead>Signed up</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.length === 0 ? (
          <EmptyState.Row
            colSpan={7}
            title="No invites yet"
            description="An invite is a link that lets someone create their own Jellyfin account with the profile you choose."
            action={action}
          />
        ) : null}
        {invites.map((inv) => {
          const link = links.get(inv.id);
          const profile = inv.profileId ? profiles.find((p) => p.id === inv.profileId) : undefined;
          return (
            <TableRow key={inv.id}>
              <TableCell>
                <div>{inv.label ?? <span className="text-muted-foreground">Untitled</span>}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>
                    created <Timestamp date={inv.createdAt} />
                  </span>
                  {inv.requireEmail ? <Tag>email required</Tag> : null}
                  {inv.accountExpiryDays ? <Tag>accounts expire in {inv.accountExpiryDays} days</Tag> : null}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge tone={tone[inv.status]}>{inv.status}</StatusBadge>
              </TableCell>
              <TableCell>
                {inv.profileId ? (
                  profile ? (
                    <Link href={`/profiles/${profile.id}`}>{profile.name}</Link>
                  ) : (
                    <span className="text-muted-foreground">deleted</span>
                  )
                ) : (
                  <span className="text-muted-foreground">none</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {inv.uses} / {inv.maxUses ?? "∞"}
              </TableCell>
              <TableCell>{inv.expiresAt ? <Timestamp date={inv.expiresAt} /> : <span className="text-muted-foreground">never</span>}</TableCell>
              <TableCell>
                {inv.usedBy.length === 0 ? (
                  <span className="text-muted-foreground">nobody yet</span>
                ) : (
                  <ul>
                    {inv.usedBy.map((u) => (
                      <li key={u.id}>
                        <Link href={`/users/${u.jellyfinUserId}`}>{u.userName ?? u.jellyfinUserId.slice(0, 8)}</Link>{" "}
                        <span className="text-xs text-muted-foreground">
                          <Timestamp date={u.createdAt} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {link ? <CopyButton value={link} label="Copy link" /> : null}
                  {inv.status === "active" ? (
                    <ConfirmDialog
                      label="Revoke"
                      size="sm"
                      variant="outline"
                      title={`Revoke ${inv.label ?? "this invite"}?`}
                      description="The link stops working immediately. Accounts already created from it are not touched."
                      confirmLabel="Revoke invite"
                      action={revokeInviteAction}
                      hidden={{ inviteId: inv.id }}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
