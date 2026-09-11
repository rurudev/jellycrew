import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { policyHash } from "@/lib/policy/hash";
import { getProfile, listProfileMembers } from "@/lib/services/profiles";
import { getReferenceData } from "@/lib/services/reference";
import { toEditorRefData } from "@/lib/services/reference-serialize";
import { ConfirmForm } from "@/components/confirm-form";
import { Notice } from "@/components/notice";
import { DiffTable } from "@/components/policy/diff-table";
import { PolicyEditor } from "@/components/policy/policy-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { applyToMembersAction, deleteProfileAction, saveProfilePolicyAction, updateProfileAction } from "../actions";

export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const params = await props.searchParams;
  const profile = getProfile(id);
  if (!profile) notFound();
  const [members, ref] = await Promise.all([listProfileMembers(id), getReferenceData()]);
  const drifting = members.filter((m) => m.drift.length > 0);
  const applyAll = params.applyAll === "1";
  return (
    <div className="space-y-4">
      <div className="text-xs text-zinc-500">
        <Link href="/profiles" className="hover:underline">
          Profiles
        </Link>{" "}
        / {profile.name}
      </div>
      <h1 className="text-xl font-semibold">{profile.name}</h1>
      <Notice params={params} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Details</CardTitle>
          <form action={updateProfileAction} className="space-y-3">
            <input type="hidden" name="profileId" value={id} />
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={profile.name} required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={profile.description ?? ""} maxLength={500} className="min-h-16" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="defaultExpiryDays">Default expiry (days)</Label>
                <Input id="defaultExpiryDays" name="defaultExpiryDays" type="number" min={1} max={3650} defaultValue={profile.defaultExpiryDays ?? ""} />
              </div>
              <div>
                <Label htmlFor="inactivityDisableDays">Disable after inactivity (days)</Label>
                <Input id="inactivityDisableDays" name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={profile.inactivityDisableDays ?? ""} />
              </div>
            </div>
            <Button type="submit" variant="secondary">
              Save details
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>
            Members <span className="text-sm font-normal text-zinc-500">{members.length}</span>
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Drift</Th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? <EmptyRow colSpan={2}>No members. Assign users from their detail page or with a bulk action.</EmptyRow> : null}
              {members.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <Link href={`/users/${m.id}`}>{m.name}</Link> {m.isAdmin ? <Badge tone="purple">admin</Badge> : null} {m.isDisabled ? <Badge tone="red">disabled</Badge> : null}
                  </Td>
                  <Td>{m.drift.length ? <Badge tone="amber">{m.drift.length} field(s)</Badge> : <span className="text-zinc-400">none</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-3 space-y-2">
            {applyAll ? (
              <Alert tone="info" title={`Apply "${profile.name}" to ${members.length} member(s)`}>
                {drifting.length === 0 ? <p>Every member already matches. Applying only records the assignment.</p> : null}
                {drifting.map((m) => (
                  <div key={m.id} className="mt-2">
                    <div className="font-medium">{m.name}</div>
                    <DiffTable changes={m.drift} beforeLabel="User (live)" afterLabel="Profile" />
                  </div>
                ))}
                <form action={applyToMembersAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="profileId" value={id} />
                  <input type="hidden" name="confirm" value="1" />
                  <Button type="submit">Confirm: apply to all members</Button>
                  <Link href={`/profiles/${id}`} className="self-center text-zinc-500 hover:underline">
                    Cancel
                  </Link>
                </form>
              </Alert>
            ) : (
              <form action={applyToMembersAction}>
                <input type="hidden" name="profileId" value={id} />
                <Button type="submit" variant="secondary" disabled={members.length === 0}>
                  Preview apply to all members
                </Button>
                <Help>Shows every member&apos;s diff first; execution is sequential with a per-user result.</Help>
              </form>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Policy</CardTitle>
        <p className="mb-3 text-zinc-500">Only profile-managed fields. Saving changes the profile; members drift until the profile is applied.</p>
        <PolicyEditor
          action={saveProfilePolicyAction}
          policy={profile.policy}
          hash={policyHash(profile.policy)}
          refData={toEditorRefData(ref)}
          scope="profile"
          hidden={{ profileId: id }}
          cancelHref="/profiles"
        />
      </Card>

      <Card>
        <CardTitle>Danger zone</CardTitle>
        <ConfirmForm
          action={deleteProfileAction}
          phrase={profile.name}
          label="Delete profile"
          hidden={{ profileId: id }}
          description={<>Deleting unassigns {members.length} member(s). Their Jellyfin settings are not changed.</>}
        />
      </Card>
    </div>
  );
}
