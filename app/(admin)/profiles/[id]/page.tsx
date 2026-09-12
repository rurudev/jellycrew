import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { policyHash } from "@/lib/policy/hash";
import { getProfile, listProfileMembers } from "@/lib/services/profiles";
import { getReferenceData } from "@/lib/services/reference";
import { toEditorRefData } from "@/lib/services/reference-serialize";
import { PolicyEditor } from "@/components/policy/policy-editor";
import { ApplyToMembers, ApplyToMembersButton } from "@/components/profiles/apply-all";
import { MembersTable } from "@/components/profiles/members-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { deleteProfileAction, saveProfilePolicyAction, updateProfileAction } from "../actions";

export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const profile = getProfile(id);
  if (!profile) notFound();
  const [members, ref] = await Promise.all([listProfileMembers(id), getReferenceData()]);
  const drifting = members.filter((m) => m.drift.length > 0);

  return (
    <ApplyToMembers profileId={id} profileName={profile.name}>
      <div className="space-y-4">
        <PageHeader
          breadcrumb={[{ label: "Profiles", href: "/profiles" }, { label: profile.name }]}
          title={profile.name}
          description={
            members.length === 0
              ? "No accounts follow this profile yet."
              : drifting.length === 0
                ? `${members.length === 1 ? "1 account follows" : `${members.length} accounts follow`} this profile and match it.`
                : `${drifting.length} of ${members.length} accounts have drifted from this profile.`
          }
          actions={<ApplyToMembersButton disabled={members.length === 0} />}
        />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <Section title="Settings" description="Only the fields a profile manages. Saving changes the profile; members keep their current settings until it is applied to them.">
              <PolicyEditor action={saveProfilePolicyAction} policy={profile.policy} hash={policyHash(profile.policy)} refData={toEditorRefData(ref)} target={{ kind: "profile", id }} />
            </Section>
          </div>

          <div className="min-w-0 space-y-4">
            <Section title="Details">
              <form action={updateProfileAction} className="space-y-4">
                <input type="hidden" name="profileId" value={id} />
                <FormField id="name" label="Name">
                  <Input name="name" defaultValue={profile.name} required maxLength={80} />
                </FormField>
                <FormField id="description" label="Description" help="For your own list.">
                  <Textarea name="description" defaultValue={profile.description ?? ""} maxLength={500} className="min-h-16" />
                </FormField>
                <FormField id="defaultExpiryDays" label="Default expiry (days)" help="Suggested to invites. Blank means no expiry." controlClassName="max-w-48">
                  <Input name="defaultExpiryDays" type="number" min={1} max={3650} defaultValue={profile.defaultExpiryDays ?? ""} placeholder="None" />
                </FormField>
                <FormField id="inactivityDisableDays" label="Disable after inactivity (days)" help="Members inherit this unless their own setting overrides it." controlClassName="max-w-48">
                  <Input name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={profile.inactivityDisableDays ?? ""} placeholder="Never" />
                </FormField>
                <SubmitButton variant="outline" pendingLabel="Saving…">
                  Save details
                </SubmitButton>
              </form>
            </Section>

            <Section title="Members" description={members.length === 1 ? "1 account" : `${members.length} accounts`}>
              <MembersTable members={members} />
            </Section>

            <Section title="Danger zone" description="Members keep the settings they have; only the link to this profile goes away.">
              <ConfirmDialog
                label="Delete profile"
                title={`Delete the profile ${profile.name}?`}
                description={members.length === 0 ? "Nothing follows it, so nothing else changes." : `${members.length === 1 ? "1 account" : `${members.length} accounts`} will stop following it. Their Jellyfin settings are not changed.`}
                phrase={profile.name}
                action={deleteProfileAction}
                hidden={{ profileId: id }}
              />
            </Section>
          </div>
        </div>
      </div>
    </ApplyToMembers>
  );
}
