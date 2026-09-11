import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listProfilesWithCounts } from "@/lib/services/profiles";
import { listUsers } from "@/lib/services/users";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { createProfileAction } from "./actions";

export const metadata = { title: "Profiles" };

export default async function ProfilesPage(props: PageProps<"/profiles">) {
  await requireAdmin();
  const params = await props.searchParams;
  const [profiles, users] = await Promise.all([listProfilesWithCounts(), listUsers()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Profiles" count={profiles.length} />
      <Notice params={params} />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th className="text-right">Members</Th>
            <Th className="text-right">Drifting</Th>
            <Th>Default expiry</Th>
            <Th>Inactivity</Th>
          </tr>
        </thead>
        <tbody>
          {profiles.length === 0 ? <EmptyRow colSpan={6}>No profiles yet. Create one below.</EmptyRow> : null}
          {profiles.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/profiles/${p.id}`} className="font-medium">
                  {p.name}
                </Link>
              </Td>
              <Td className="text-fg-muted">{p.description}</Td>
              <Td className="text-right tabular-nums">{p.memberCount}</Td>
              <Td className="text-right tabular-nums">{p.driftCount ? <Badge tone="amber">{p.driftCount}</Badge> : 0}</Td>
              <Td>{p.defaultExpiryDays ? `${p.defaultExpiryDays} days` : <span className="text-fg-subtle">none</span>}</Td>
              <Td>{p.inactivityDisableDays ? `disable after ${p.inactivityDisableDays} days` : <span className="text-fg-subtle">never</span>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Section title="Create a profile">
        <form action={createProfileAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field id="name" label="Name">
              <Input name="name" required maxLength={80} />
            </Field>
            <Field id="description" label="Description">
              <Textarea name="description" maxLength={500} className="min-h-16" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="defaultExpiryDays" label="Default expiry (days)" help="Used by invites; blank = never.">
                <Input name="defaultExpiryDays" type="number" min={1} max={3650} />
              </Field>
              <Field id="inactivityDisableDays" label="Disable after inactivity (days)" help="Members inherit this unless overridden; blank = never.">
                <Input name="inactivityDisableDays" type="number" min={1} max={3650} />
              </Field>
            </div>
          </div>
          <div className="space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Start from</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="source" value="blank" defaultChecked /> Blank (Jellyfin defaults for a new user)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="source" value="user" /> Snapshot of a user&apos;s current settings
              </label>
              <Select name="userId" defaultValue="" aria-label="User to snapshot">
                <option value="">Choose a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2">
                <input type="radio" name="source" value="clone" /> Clone of an existing profile
              </label>
              <Select name="sourceProfileId" defaultValue="" aria-label="Profile to clone">
                <option value="">Choose a profile…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </fieldset>
            <SubmitButton pendingLabel="Creating…">Create profile</SubmitButton>
          </div>
        </form>
      </Section>
    </div>
  );
}
