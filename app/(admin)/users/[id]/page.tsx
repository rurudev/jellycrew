import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { copyPolicyFromUser } from "@/lib/services/policies";
import { listProfiles, previewAdopt, userDrift } from "@/lib/services/profiles";
import { getReferenceData } from "@/lib/services/reference";
import { getUserDetail, listUsers } from "@/lib/services/users";
import { Notice } from "@/components/notice";
import { DiffTable } from "@/components/policy/diff-table";
import { PolicyView } from "@/components/policy/policy-view";
import { DevicesTable } from "@/components/sessions/devices-table";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { Time } from "@/components/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, Td, Th, EmptyRow } from "@/components/ui/table";
import { Avatar } from "@/components/users/avatar";
import { LifecycleCard } from "@/components/users/lifecycle-card";
import { StatusBadge } from "@/components/users/status-badge";
import { getSettingOrDefault } from "@/lib/settings";
import { CopyButton } from "@/components/invites/copy-button";
import { isMailConfigured } from "@/lib/mail";
import { adoptIntoProfileAction, applyProfileAction, assignProfileAction, copyPolicyAction, renameUserAction, setEnabledAction, setPasswordAction } from "./actions";
import { createResetLinkAction, emailResetLinkAction, sendVerificationAction } from "./reset-actions";

export default async function UserDetailPage(props: PageProps<"/users/[id]">) {
  const session = await requireAdmin();
  const { id } = await props.params;
  const params = await props.searchParams;
  const [detail, ref, allUsers] = await Promise.all([getUserDetail(id), getReferenceData(), listUsers()]);
  if (!detail) notFound();
  const { row, sessions, devices, history, policy } = detail;
  const returnTo = `/users/${id}`;
  const profiles = listProfiles();
  const assigned = row.profileId ? profiles.find((p) => p.id === row.profileId) ?? null : null;
  const drift = userDrift(policy, assigned);
  const adopt = assigned ? await previewAdopt(assigned.id, id) : null;
  const copyFrom = typeof params.copyFrom === "string" ? params.copyFrom : null;
  const resetLink = typeof params.resetLink === "string" ? params.resetLink : null;
  const mailConfigured = isMailConfigured();
  const copyPreview = copyFrom ? await copyPolicyFromUser({ type: "admin", id: session.userId }, id, copyFrom, false).catch(() => null) : null;
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
            {row.isAdmin ? <Badge tone="purple">admin</Badge> : null}
            {row.isHidden ? <Badge>hidden</Badge> : null}
            {isSelf ? <Badge tone="blue">you</Badge> : null}
            <StatusBadge status={row.status} />
            <code className="text-xs text-muted-foreground">{row.id}</code>
          </span>
        }
        actions={
          <>
            <Link href={`/users/${id}/policy`} className={buttonVariants({ variant: "outline" })}>
              Edit access
            </Link>
            <form action={setEnabledAction}>
              <input type="hidden" name="userId" value={id} />
              <input type="hidden" name="enabled" value={row.isDisabled ? "1" : "0"} />
              <SubmitButton variant={row.isDisabled ? "default" : "destructive"} disabled={isSelf && !row.isDisabled} title={isSelf ? "You cannot disable yourself" : undefined}>
                {row.isDisabled ? "Enable" : "Disable"}
              </SubmitButton>
            </form>
            {assigned ? (
              <form action={applyProfileAction}>
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="profileId" value={assigned.id} />
                <SubmitButton variant="outline" pendingLabel="Applying…">
                  Apply profile
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />
      <Notice params={params} />
      {resetLink ? (
        <Alert tone="success" title="Reset link created (valid 60 minutes, single use)">
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{resetLink}</code>
            <CopyButton value={resetLink} />
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Profile">
          <form action={assignProfileAction} className="space-y-2">
            <input type="hidden" name="userId" value={id} />
            <div className="flex flex-wrap items-end gap-2">
              <FormField id="profileId" label="Assigned profile" className="min-w-48">
                <NativeSelect name="profileId" defaultValue={assigned?.id ?? ""} className="w-full">
                  <option value="">No profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <SubmitButton variant="outline" pendingLabel="Assigning…">
                Assign
              </SubmitButton>
            </div>
            <Hint>Assigning only records the link. Apply pushes the profile&apos;s managed fields to Jellyfin.</Hint>
          </form>
          {assigned ? (
            <div className="mt-4 space-y-3">
              <div>
                <h3 className="font-medium">
                  Drift from{" "}
                  <Link href={`/profiles/${assigned.id}`} className="underline">
                    {assigned.name}
                  </Link>
                </h3>
                <DiffTable changes={drift ?? []} beforeLabel="User (live)" afterLabel="Profile" empty="No drift: the user matches the profile." />
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={applyProfileAction}>
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <SubmitButton variant="outline" disabled={!drift?.length} pendingLabel="Applying…">
                    Apply profile to user
                  </SubmitButton>
                </form>
                <form action={adoptIntoProfileAction}>
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <SubmitButton
                    variant="outline"
                    disabled={!drift?.length}
                    pendingLabel="Adopting…"
                    title={adopt ? `${adopt.otherMembers.filter((m) => m.willDrift).length} of ${adopt.otherMembers.length} other member(s) would drift` : undefined}
                  >
                    Adopt user into profile
                  </SubmitButton>
                </form>
              </div>
              {adopt && drift?.length ? (
                <Hint>
                  Adopting makes the profile match this user&apos;s live settings. {adopt.otherMembers.filter((m) => m.willDrift).length} of {adopt.otherMembers.length} other member(s) would then drift.
                </Hint>
              ) : null}
            </div>
          ) : null}
        </Section>

        <LifecycleCard row={row} assigned={assigned} graceDays={getSettingOrDefault("graceDays")} isSelf={isSelf} />
      </div>

      <Section
        title="Access"
        actions={
          <Link href={`/users/${id}/policy`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit
          </Link>
        }
      >
        <PolicyView policy={policy} refData={ref} />
      </Section>

      <Section title="Sessions">
        <SessionsTable sessions={sessions} showUser={false} returnTo={returnTo} />
      </Section>

      <Section title="Devices">
        <DevicesTable devices={devices} showUser={false} returnTo={returnTo} />
      </Section>

      <Section title="Actions">
        <div className="mb-6 flex flex-wrap gap-2">
          <form action={createResetLinkAction}>
            <input type="hidden" name="userId" value={id} />
            <SubmitButton variant="outline" title="Works without email; hand the link over yourself" pendingLabel="Generating…">
              Generate reset link
            </SubmitButton>
          </form>
          <form action={emailResetLinkAction}>
            <input type="hidden" name="userId" value={id} />
            <SubmitButton variant="outline" disabled={!mailConfigured || !row.meta.email} title={!mailConfigured ? "SMTP is not configured" : !row.meta.email ? "No email on file" : undefined} pendingLabel="Sending…">
              Email reset link
            </SubmitButton>
          </form>
          {row.meta.email && !row.meta.emailVerifiedAt ? (
            <form action={sendVerificationAction}>
              <input type="hidden" name="userId" value={id} />
              <SubmitButton variant="outline" disabled={!mailConfigured} title={!mailConfigured ? "SMTP is not configured" : undefined} pendingLabel="Sending…">
                Send verification email
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <form action={renameUserAction} className="space-y-2">
            <input type="hidden" name="userId" value={id} />
            <FormField id="name" label="Rename" help="Jellyfin validates the name; existing names are rejected.">
              <Input name="name" defaultValue={row.name} required maxLength={100} />
            </FormField>
            <SubmitButton variant="outline" pendingLabel="Renaming…">
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
            <SubmitButton variant="outline" pendingLabel="Saving…">
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
            <SubmitButton variant="outline" pendingLabel="Previewing…">
              Preview copy
            </SubmitButton>
          </form>
        </div>
        {copyFrom && copyPreview ? (
          <Alert tone="info" title={`Copying from ${allUsers.find((u) => u.id === copyFrom)?.name ?? copyFrom}`} className="mt-4">
            <DiffTable changes={copyPreview} empty="Nothing to copy: the managed fields already match." />
            {copyPreview.length ? (
              <form action={copyPolicyAction} className="mt-2">
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="sourceId" value={copyFrom} />
                <input type="hidden" name="confirm" value="1" />
                <SubmitButton pendingLabel="Copying…">Confirm copy</SubmitButton>
              </form>
            ) : null}
          </Alert>
        ) : null}
      </Section>

      <Section title="History">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? <EmptyRow colSpan={4}>No history yet.</EmptyRow> : null}
            {history.map((h) => (
              <tr key={h.id}>
                <Td>
                  <Time date={h.ts} />
                </Td>
                <Td>
                  {h.actorType}
                  {h.actorId ? <span className="text-muted-foreground"> {h.actorId.slice(0, 8)}</span> : null}
                </Td>
                <Td>
                  <code className="text-xs">{h.action}</code>
                </Td>
                <Td className="max-w-md truncate text-xs text-muted-foreground" title={h.detail ? JSON.stringify(h.detail) : ""}>
                  {h.detail ? JSON.stringify(h.detail) : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
