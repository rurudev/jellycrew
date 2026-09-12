import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { listProfiles, previewAdopt, userDrift } from "@/lib/services/profiles";
import { getReferenceData } from "@/lib/services/reference";
import { getUserDetail, listUsers } from "@/lib/services/users";
import { AuditPayload } from "@/components/audit/audit-table";
import { DevicesTable } from "@/components/sessions/devices-table";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { Timestamp } from "@/components/ui/timestamp";
import { Callout } from "@/components/ui/callout";
import { Tag } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessSummary } from "@/components/users/access-summary";
import { Avatar } from "@/components/users/avatar";
import { LifecycleForm } from "@/components/users/lifecycle-form";
import { ProfileCard } from "@/components/users/profile-card";
import { UserActions } from "@/components/users/user-actions";
import { UserFacts } from "@/components/users/user-facts";
import { UserStatusBadge } from "@/components/users/user-status";
import { getSettingOrDefault } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mail";
import { cancelDeletionAction } from "./lifecycle-actions";

export default async function UserDetailPage(props: PageProps<"/users/[id]">) {
  const session = await requireAdmin();
  const { id } = await props.params;
  const [detail, ref, allUsers] = await Promise.all([getUserDetail(id), getReferenceData(), listUsers()]);
  if (!detail) notFound();
  const { row, sessions, devices, history, policy } = detail;
  const returnTo = `/users/${id}`;
  const profiles = listProfiles();
  const assigned = row.profileId ? profiles.find((p) => p.id === row.profileId) ?? null : null;
  const drift = userDrift(policy, assigned);
  const driftKeys = new Set((drift ?? []).map((c) => c.key));
  // Needs the assigned profile, which only the detail knows, so this one waits.
  const adopt = assigned && drift?.length ? await previewAdopt(assigned.id, id) : null;
  const mailConfigured = isMailConfigured();
  const isSelf = session.userId === id;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "Users", href: "/users" }, { label: row.name }]}
        title={
          <>
            <Avatar userId={row.id} name={row.name} imageTag={row.imageTag} size={28} />
            <span>{row.name}</span>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <UserStatusBadge status={row.status} />
            {row.isAdmin ? <Tag>admin</Tag> : null}
            {row.isHidden ? <Tag>hidden</Tag> : null}
            {isSelf ? (
              <StatusBadge tone="primary" dot={false}>
                you
              </StatusBadge>
            ) : null}
            {assigned ? (
              <span className="text-muted-foreground">
                Profile{" "}
                <Link href={`/profiles/${assigned.id}`} className="text-foreground underline">
                  {assigned.name}
                </Link>
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <UserActions
              user={{ id, name: row.name, isAdmin: row.isAdmin, isDisabled: row.isDisabled, email: row.meta.email, emailVerified: Boolean(row.meta.emailVerifiedAt), deletionScheduled: Boolean(row.meta.deleteAfter) }}
              users={allUsers.filter((u) => u.id !== id).map((u) => ({ id: u.id, name: u.name }))}
              mailConfigured={mailConfigured}
              isSelf={isSelf}
              graceDays={getSettingOrDefault("graceDays")}
            />
            <Link href={`/users/${id}/policy`} className={buttonVariants()}>
              Edit access
            </Link>
          </>
        }
      />
      {row.meta.deleteAfter ? (
        <Callout tone="warning" title="Deletion scheduled">
          <p>
            This account is disabled and will be deleted <Timestamp date={row.meta.deleteAfter} absolute />.
          </p>
          <form action={cancelDeletionAction} className="mt-2">
            <input type="hidden" name="userId" value={id} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Cancelling…">
              Cancel deletion and re-enable
            </SubmitButton>
          </form>
        </Callout>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Section
            title="Access"
            actions={
              <Link href={`/users/${id}/policy`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Edit
              </Link>
            }
          >
            <AccessSummary policy={policy} profile={assigned ? { id: assigned.id, name: assigned.name } : null} driftKeys={driftKeys} refData={ref} />
          </Section>

          <Section title="Sessions">
            <SessionsTable sessions={sessions} columns={["client", "device", "nowPlaying", "method", "lastActivity", "actions"]} returnTo={returnTo} variant="plain" />
          </Section>

          <Section title="Devices">
            <DevicesTable devices={devices} columns={["device", "app", "lastUsed", "actions"]} returnTo={returnTo} variant="plain" />
          </Section>

          <Section title="History">
            <Table variant="plain">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>What changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? <EmptyState.Row colSpan={4} title="No history yet." /> : null}
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">
                      <Timestamp date={h.ts} />
                    </TableCell>
                    <TableCell>
                      {h.actorType}
                      {h.actorId ? <span className="text-muted-foreground"> {h.actorId.slice(0, 8)}</span> : null}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{h.action}</code>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <AuditPayload row={h} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          <ProfileCard userId={id} profiles={profiles} assigned={assigned} drift={drift} adopt={adopt} />
          <LifecycleForm row={row} assigned={assigned} />
          <UserFacts row={row} />

        </div>
      </div>
    </div>
  );
}
