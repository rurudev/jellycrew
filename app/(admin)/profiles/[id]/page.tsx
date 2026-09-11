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
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
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
      <PageHeader breadcrumb={[{ label: "Profiles", href: "/profiles" }, { label: profile.name }]} title={profile.name} />
      <Notice params={params} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Details">
          <form action={updateProfileAction} className="space-y-3">
            <input type="hidden" name="profileId" value={id} />
            <FormField id="name" label="Name">
              <Input name="name" defaultValue={profile.name} required maxLength={80} />
            </FormField>
            <FormField id="description" label="Description">
              <Textarea name="description" defaultValue={profile.description ?? ""} maxLength={500} className="min-h-16" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="defaultExpiryDays" label="Default expiry (days)">
                <Input name="defaultExpiryDays" type="number" min={1} max={3650} defaultValue={profile.defaultExpiryDays ?? ""} />
              </FormField>
              <FormField id="inactivityDisableDays" label="Disable after inactivity (days)">
                <Input name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={profile.inactivityDisableDays ?? ""} />
              </FormField>
            </div>
            <SubmitButton variant="outline" pendingLabel="Saving…">
              Save details
            </SubmitButton>
          </form>
        </Section>

        <Section
          title={
            <>
              Members <span className="text-sm font-normal text-muted-foreground">{members.length}</span>
            </>
          }
        >
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
                  <Td>{m.drift.length ? <Badge tone="amber">{m.drift.length} field(s)</Badge> : <span className="text-muted-foreground">none</span>}</Td>
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
                <form action={applyToMembersAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="profileId" value={id} />
                  <input type="hidden" name="confirm" value="1" />
                  <SubmitButton pendingLabel="Applying…">Confirm: apply to all members</SubmitButton>
                  <Link href={`/profiles/${id}`} className="text-muted-foreground hover:underline">
                    Cancel
                  </Link>
                </form>
              </Alert>
            ) : (
              <form action={applyToMembersAction} className="space-y-1">
                <input type="hidden" name="profileId" value={id} />
                <SubmitButton variant="outline" disabled={members.length === 0}>
                  Preview apply to all members
                </SubmitButton>
                <Hint>Shows every member&apos;s diff first; execution is sequential with a per-user result.</Hint>
              </form>
            )}
          </div>
        </Section>
      </div>

      <Section title="Policy" description="Only profile-managed fields. Saving changes the profile; members drift until the profile is applied.">
        <PolicyEditor
          action={saveProfilePolicyAction}
          policy={profile.policy}
          hash={policyHash(profile.policy)}
          refData={toEditorRefData(ref)}
          scope="profile"
          hidden={{ profileId: id }}
          cancelHref="/profiles"
        />
      </Section>

      <Section title="Danger zone">
        <ConfirmForm
          action={deleteProfileAction}
          phrase={profile.name}
          label="Delete profile"
          hidden={{ profileId: id }}
          description={<>Deleting unassigns {members.length} member(s). Their Jellyfin settings are not changed.</>}
        />
      </Section>
    </div>
  );
}
