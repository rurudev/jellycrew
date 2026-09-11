import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { copyPolicyFromUser } from "@/lib/services/policies";
import { listProfiles, previewAdopt, userDrift } from "@/lib/services/profiles";
import { getReferenceData } from "@/lib/services/reference";
import { getUserDetail, listUsers } from "@/lib/services/users";
import { DiffTable } from "@/components/policy/diff-table";
import { DevicesTable } from "@/components/sessions/devices-table";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { Timestamp } from "@/components/ui/timestamp";
import { Callout } from "@/components/ui/callout";
import { Tag } from "@/components/ui/chip";
import { CopyField } from "@/components/ui/copy-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessSummary } from "@/components/users/access-summary";
import { Avatar } from "@/components/users/avatar";
import { DangerZone } from "@/components/users/danger-zone";
import { LifecycleForm } from "@/components/users/lifecycle-form";
import { ProfileCard } from "@/components/users/profile-card";
import { UserFacts } from "@/components/users/user-facts";
import { UserStatusBadge } from "@/components/users/user-status";
import { getSettingOrDefault } from "@/lib/settings";
import { isMailConfigured } from "@/lib/mail";
import { copyPolicyAction, renameUserAction, setEnabledAction, setPasswordAction } from "./actions";
import { createResetLinkAction, emailResetLinkAction, sendVerificationAction } from "./reset-actions";

export default async function UserDetailPage(props: PageProps<"/users/[id]">) {
  const session = await requireAdmin();
  const { id } = await props.params;
  const params = await props.searchParams;
  const copyFrom = typeof params.copyFrom === "string" ? params.copyFrom : null;
  const resetLink = typeof params.resetLink === "string" ? params.resetLink : null;
  const [detail, ref, allUsers, copyPreview] = await Promise.all([
    getUserDetail(id),
    getReferenceData(),
    listUsers(),
    copyFrom ? copyPolicyFromUser({ type: "admin", id: session.userId }, id, copyFrom, false).catch(() => null) : null,
  ]);
  if (!detail) notFound();
  const { row, sessions, devices, history, policy } = detail;
  const returnTo = `/users/${id}`;
  const profiles = listProfiles();
  const assigned = row.profileId ? profiles.find((p) => p.id === row.profileId) ?? null : null;
  const drift = userDrift(policy, assigned);
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
            <form action={setEnabledAction}>
              <input type="hidden" name="userId" value={id} />
              <input type="hidden" name="enabled" value={row.isDisabled ? "1" : "0"} />
              <SubmitButton variant="outline" disabled={isSelf && !row.isDisabled} title={isSelf ? "You cannot disable yourself" : undefined}>
                {row.isDisabled ? "Enable" : "Disable"}
              </SubmitButton>
            </form>
            <Link href={`/users/${id}/policy`} className={buttonVariants()}>
              Edit access
            </Link>
          </>
        }
      />
      {resetLink ? (
        <Callout tone="success" title="Reset link created (valid 60 minutes, single use)">
          <CopyField value={resetLink} label="Copy link" className="mt-1" />
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
            <AccessSummary policy={policy} profile={assigned} refData={ref} />
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
                  <TableHead>Detail</TableHead>
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
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={h.detail ? JSON.stringify(h.detail) : ""}>
                      {h.detail ? JSON.stringify(h.detail) : ""}
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

          {/* Interim: these become a menu with dialogs in the next package. */}
          <Section title="Actions">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <form action={createResetLinkAction}>
                  <input type="hidden" name="userId" value={id} />
                  <SubmitButton variant="outline" size="sm" title="Works without email; hand the link over yourself" pendingLabel="Generating…">
                    Generate reset link
                  </SubmitButton>
                </form>
                <form action={emailResetLinkAction}>
                  <input type="hidden" name="userId" value={id} />
                  <SubmitButton variant="outline" size="sm" disabled={!mailConfigured || !row.meta.email} title={!mailConfigured ? "SMTP is not configured" : !row.meta.email ? "No email on file" : undefined} pendingLabel="Sending…">
                    Email reset link
                  </SubmitButton>
                </form>
                {row.meta.email && !row.meta.emailVerifiedAt ? (
                  <form action={sendVerificationAction}>
                    <input type="hidden" name="userId" value={id} />
                    <SubmitButton variant="outline" size="sm" disabled={!mailConfigured} title={!mailConfigured ? "SMTP is not configured" : undefined} pendingLabel="Sending…">
                      Send verification email
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
              <form action={renameUserAction} className="space-y-2">
                <input type="hidden" name="userId" value={id} />
                <FormField id="name" label="Rename" help="Jellyfin validates the name; existing names are rejected.">
                  <Input name="name" defaultValue={row.name} required maxLength={100} />
                </FormField>
                <SubmitButton variant="outline" size="sm" pendingLabel="Renaming…">
                  Rename
                </SubmitButton>
              </form>
              <form action={setPasswordAction} className="space-y-2">
                <input type="hidden" name="userId" value={id} />
                <FormField id="password" label="Set password">
                  <Input name="password" type="password" autoComplete="new-password" required />
                </FormField>
                <FormField id="confirm" label="Repeat password" hideLabel help="Sets the password directly; the user is not asked for the current one.">
                  <Input name="confirm" type="password" autoComplete="new-password" placeholder="Repeat" required />
                </FormField>
                <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                  Set password
                </SubmitButton>
              </form>
              <form action={copyPolicyAction} className="space-y-2">
                <input type="hidden" name="userId" value={id} />
                <FormField id="sourceId" label="Copy policy from user" help="Copies profile-managed fields only. Administrator, device and login settings stay as they are.">
                  <NativeSelect name="sourceId" defaultValue={copyFrom ?? ""} required className="w-full">
                    <option value="">Choose a user…</option>
                    {allUsers
                      .filter((u) => u.id !== id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </NativeSelect>
                </FormField>
                <SubmitButton variant="outline" size="sm" pendingLabel="Previewing…">
                  Preview copy
                </SubmitButton>
              </form>
              {copyFrom && copyPreview ? (
                <Callout tone="info" title={`Copying from ${allUsers.find((u) => u.id === copyFrom)?.name ?? copyFrom}`}>
                  <div className="overflow-x-auto">
                    <DiffTable changes={copyPreview} empty="Nothing to copy: the managed fields already match." />
                  </div>
                  {copyPreview.length ? (
                    <form action={copyPolicyAction} className="mt-2">
                      <input type="hidden" name="userId" value={id} />
                      <input type="hidden" name="sourceId" value={copyFrom} />
                      <input type="hidden" name="confirm" value="1" />
                      <SubmitButton size="sm" pendingLabel="Copying…">
                        Confirm copy
                      </SubmitButton>
                    </form>
                  ) : null}
                </Callout>
              ) : null}
            </div>
          </Section>

          <DangerZone row={row} graceDays={getSettingOrDefault("graceDays")} isSelf={isSelf} />
        </div>
      </div>
    </div>
  );
}
