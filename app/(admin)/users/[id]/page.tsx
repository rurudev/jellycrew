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
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
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
      <div className="text-xs text-zinc-500">
        <Link href="/users" className="hover:underline">
          Users
        </Link>{" "}
        / {row.name}
      </div>
      <header className="flex flex-wrap items-center gap-3">
        <Avatar userId={row.id} name={row.name} imageTag={row.imageTag} size={40} />
        <h1 className="text-xl font-semibold">{row.name}</h1>
        {row.isAdmin ? <Badge tone="purple">admin</Badge> : null}
        {row.isHidden ? <Badge>hidden</Badge> : null}
        {isSelf ? <Badge tone="blue">you</Badge> : null}
        <StatusBadge status={row.status} />
        <span className="text-xs text-zinc-400">
          <code>{row.id}</code>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/users/${id}/policy`}>
            <Button type="button" variant="secondary">
              Edit access
            </Button>
          </Link>
          <form action={setEnabledAction}>
            <input type="hidden" name="userId" value={id} />
            <input type="hidden" name="enabled" value={row.isDisabled ? "1" : "0"} />
            <Button type="submit" variant={row.isDisabled ? "primary" : "danger"} disabled={isSelf && !row.isDisabled} title={isSelf ? "You cannot disable yourself" : undefined}>
              {row.isDisabled ? "Enable" : "Disable"}
            </Button>
          </form>
          {assigned ? (
            <form action={applyProfileAction}>
              <input type="hidden" name="userId" value={id} />
              <input type="hidden" name="profileId" value={assigned.id} />
              <Button type="submit" variant="secondary">
                Apply profile
              </Button>
            </form>
          ) : null}
        </div>
      </header>
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
        <Card>
          <CardTitle>Profile</CardTitle>
          <form action={assignProfileAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={id} />
            <div className="min-w-48">
              <Label htmlFor="profileId">Assigned profile</Label>
              <Select id="profileId" name="profileId" defaultValue={assigned?.id ?? ""}>
                <option value="">No profile</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Assign
            </Button>
            <Help>Assigning only records the link. Apply pushes the profile&apos;s managed fields to Jellyfin.</Help>
          </form>
          {assigned ? (
            <div className="mt-4 space-y-3">
              <div>
                <h3 className="font-medium">
                  Drift from <Link href={`/profiles/${assigned.id}`} className="underline">{assigned.name}</Link>
                </h3>
                <DiffTable changes={drift ?? []} beforeLabel="User (live)" afterLabel="Profile" empty="No drift: the user matches the profile." />
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={applyProfileAction}>
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <Button type="submit" variant="secondary" disabled={!drift?.length}>
                    Apply profile to user
                  </Button>
                </form>
                <form action={adoptIntoProfileAction}>
                  <input type="hidden" name="userId" value={id} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={!drift?.length}
                    title={adopt ? `${adopt.otherMembers.filter((m) => m.willDrift).length} of ${adopt.otherMembers.length} other member(s) would drift` : undefined}
                  >
                    Adopt user into profile
                  </Button>
                </form>
              </div>
              {adopt && drift?.length ? (
                <Help>
                  Adopting makes the profile match this user&apos;s live settings. {adopt.otherMembers.filter((m) => m.willDrift).length} of {adopt.otherMembers.length} other member(s) would then drift.
                </Help>
              ) : null}
            </div>
          ) : null}
        </Card>

        <LifecycleCard row={row} assigned={assigned} graceDays={getSettingOrDefault("graceDays")} isSelf={isSelf} />
      </div>

      <Card>
        <CardTitle
          actions={
            <Link href={`/users/${id}/policy`} className="text-sm underline">
              Edit
            </Link>
          }
        >
          Access
        </CardTitle>
        <PolicyView policy={policy} refData={ref} />
      </Card>

      <Card>
        <CardTitle>Sessions</CardTitle>
        <SessionsTable sessions={sessions} showUser={false} returnTo={returnTo} />
      </Card>

      <Card>
        <CardTitle>Devices</CardTitle>
        <DevicesTable devices={devices} showUser={false} returnTo={returnTo} />
      </Card>

      <Card>
        <CardTitle>Actions</CardTitle>
        <div className="mb-6 flex flex-wrap gap-2">
          <form action={createResetLinkAction}>
            <input type="hidden" name="userId" value={id} />
            <Button type="submit" variant="secondary" title="Works without email; hand the link over yourself">
              Generate reset link
            </Button>
          </form>
          <form action={emailResetLinkAction}>
            <input type="hidden" name="userId" value={id} />
            <Button type="submit" variant="secondary" disabled={!mailConfigured || !row.meta.email} title={!mailConfigured ? "SMTP is not configured" : !row.meta.email ? "No email on file" : undefined}>
              Email reset link
            </Button>
          </form>
          {row.meta.email && !row.meta.emailVerifiedAt ? (
            <form action={sendVerificationAction}>
              <input type="hidden" name="userId" value={id} />
              <Button type="submit" variant="secondary" disabled={!mailConfigured} title={!mailConfigured ? "SMTP is not configured" : undefined}>
                Send verification email
              </Button>
            </form>
          ) : null}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <form action={renameUserAction} className="space-y-2">
            <input type="hidden" name="userId" value={id} />
            <Label htmlFor="name">Rename</Label>
            <Input id="name" name="name" defaultValue={row.name} required maxLength={100} />
            <Help>Jellyfin validates the name; existing names are rejected.</Help>
            <Button type="submit" variant="secondary">
              Rename
            </Button>
          </form>
          <form action={setPasswordAction} className="space-y-2">
            <input type="hidden" name="userId" value={id} />
            <Label htmlFor="password">Set password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
            <Input name="confirm" type="password" autoComplete="new-password" placeholder="Repeat" required />
            <Help>Sets the password directly; the user is not asked for the current one.</Help>
            <Button type="submit" variant="secondary">
              Set password
            </Button>
          </form>
          <form action={copyPolicyAction} className="space-y-2">
            <input type="hidden" name="userId" value={id} />
            <Label htmlFor="sourceId">Copy policy from user</Label>
            <Select id="sourceId" name="sourceId" defaultValue={copyFrom ?? ""} required>
              <option value="">Choose a user…</option>
              {allUsers
                .filter((u) => u.id !== id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </Select>
            <Help>Copies profile-managed fields only. Administrator, device and login settings stay as they are.</Help>
            <Button type="submit" variant="secondary">
              Preview copy
            </Button>
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
                <Button type="submit">Confirm copy</Button>
              </form>
            ) : null}
          </Alert>
        ) : null}
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
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
                  {h.actorId ? <span className="text-zinc-400"> {h.actorId.slice(0, 8)}</span> : null}
                </Td>
                <Td>
                  <code className="text-xs">{h.action}</code>
                </Td>
                <Td className="max-w-md truncate text-xs text-zinc-500" title={h.detail ? JSON.stringify(h.detail) : ""}>
                  {h.detail ? JSON.stringify(h.detail) : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
