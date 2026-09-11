import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listProfilesWithCounts } from "@/lib/services/profiles";
import { listUsers } from "@/lib/services/users";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { createProfileAction } from "./actions";

export const metadata = { title: "Profiles" };

export default async function ProfilesPage(props: PageProps<"/profiles">) {
  await requireAdmin();
  const params = await props.searchParams;
  const [profiles, users] = await Promise.all([listProfilesWithCounts(), listUsers()]);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Profiles</h1>
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
              <Td className="text-zinc-500">{p.description}</Td>
              <Td className="text-right tabular-nums">{p.memberCount}</Td>
              <Td className="text-right tabular-nums">{p.driftCount ? <Badge tone="amber">{p.driftCount}</Badge> : 0}</Td>
              <Td>{p.defaultExpiryDays ? `${p.defaultExpiryDays} days` : <span className="text-zinc-400">none</span>}</Td>
              <Td>{p.inactivityDisableDays ? `disable after ${p.inactivityDisableDays} days` : <span className="text-zinc-400">never</span>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Card>
        <CardTitle>Create a profile</CardTitle>
        <form action={createProfileAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" maxLength={500} className="min-h-16" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="defaultExpiryDays">Default expiry (days)</Label>
                <Input id="defaultExpiryDays" name="defaultExpiryDays" type="number" min={1} max={3650} />
                <Help>Used by invites; blank = never.</Help>
              </div>
              <div>
                <Label htmlFor="inactivityDisableDays">Disable after inactivity (days)</Label>
                <Input id="inactivityDisableDays" name="inactivityDisableDays" type="number" min={1} max={3650} />
                <Help>Members inherit this unless overridden; blank = never.</Help>
              </div>
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
            <Button type="submit">Create profile</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
