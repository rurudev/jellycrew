import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listProfilesWithCounts } from "@/lib/services/profiles";
import { listUsers } from "@/lib/services/users";
import { Notice } from "@/components/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
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
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Drifting</TableHead>
            <TableHead>Default expiry</TableHead>
            <TableHead>Inactivity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.length === 0 ? <EmptyState.Row colSpan={6} title="No profiles yet" description="A profile is a reusable set of library, playback and parental settings. Create one below." /> : null}
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/profiles/${p.id}`} className="font-medium">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.description}</TableCell>
              <TableCell className="text-right tabular-nums">{p.memberCount}</TableCell>
              <TableCell className="text-right tabular-nums">{p.driftCount ? <StatusBadge tone="warning">{p.driftCount}</StatusBadge> : 0}</TableCell>
              <TableCell>{p.defaultExpiryDays ? `${p.defaultExpiryDays} days` : <span className="text-muted-foreground">none</span>}</TableCell>
              <TableCell>{p.inactivityDisableDays ? `disable after ${p.inactivityDisableDays} days` : <span className="text-muted-foreground">never</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Section title="Create a profile">
        <form action={createProfileAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <FormField id="name" label="Name">
              <Input name="name" required maxLength={80} />
            </FormField>
            <FormField id="description" label="Description">
              <Textarea name="description" maxLength={500} className="min-h-16" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="defaultExpiryDays" label="Default expiry (days)" help="Used by invites; blank = never.">
                <Input name="defaultExpiryDays" type="number" min={1} max={3650} />
              </FormField>
              <FormField id="inactivityDisableDays" label="Disable after inactivity (days)" help="Members inherit this unless overridden; blank = never.">
                <Input name="inactivityDisableDays" type="number" min={1} max={3650} />
              </FormField>
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
              <NativeSelect name="userId" defaultValue="" aria-label="User to snapshot" className="w-full">
                <option value="">Choose a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2">
                <input type="radio" name="source" value="clone" /> Clone of an existing profile
              </label>
              <NativeSelect name="sourceProfileId" defaultValue="" aria-label="Profile to clone" className="w-full">
                <option value="">Choose a profile…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </fieldset>
            <SubmitButton pendingLabel="Creating…">Create profile</SubmitButton>
          </div>
        </form>
      </Section>
    </div>
  );
}
