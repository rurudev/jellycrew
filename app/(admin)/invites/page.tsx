import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { inviteLink, listInvites, INVITE_DEFAULT_EXPIRY_DAYS } from "@/lib/services/invites";
import { listProfiles } from "@/lib/services/profiles";
import { CopyButton } from "@/components/invites/copy-button";
import { Notice } from "@/components/notice";
import { Time } from "@/components/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { createInviteAction, revokeInviteAction } from "./actions";

export const metadata = { title: "Invites" };

const tone = { active: "green", expired: "neutral", exhausted: "neutral", revoked: "red" } as const;

export default async function InvitesPage(props: PageProps<"/invites">) {
  await requireAdmin();
  const params = await props.searchParams;
  const [invites, profiles] = await Promise.all([listInvites(), listProfiles()]);
  const createdId = typeof params.created === "string" ? params.created : null;
  const created = createdId ? invites.find((i) => i.id === createdId) : undefined;
  const createdLink = created ? await inviteLink(created) : null;
  const links = new Map<string, string | null>();
  for (const inv of invites) if (inv.status === "active") links.set(inv.id, await inviteLink(inv));
  return (
    <div className="space-y-4">
      <PageHeader title="Invites" count={invites.length} />
      <Notice params={params} />
      {created && createdLink ? (
        <Alert tone="success" title="Invite created">
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{createdLink}</code>
            <CopyButton value={createdLink} />
          </div>
        </Alert>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>Label</Th>
            <Th>Status</Th>
            <Th>Profile</Th>
            <Th>Uses</Th>
            <Th>Link expires</Th>
            <Th>Account expiry</Th>
            <Th>Signed up</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {invites.length === 0 ? <EmptyRow colSpan={8}>No invites yet.</EmptyRow> : null}
          {invites.map((inv) => (
            <tr key={inv.id}>
              <Td>
                {inv.label ?? <span className="text-muted-foreground">untitled</span>}
                <div className="text-xs text-muted-foreground">
                  created <Time date={inv.createdAt} />
                  {inv.requireEmail ? " · email required" : ""}
                </div>
              </Td>
              <Td>
                <Badge tone={tone[inv.status]}>{inv.status}</Badge>
              </Td>
              <Td>{inv.profileId ? <Link href={`/profiles/${inv.profileId}`}>{profiles.find((p) => p.id === inv.profileId)?.name ?? "deleted"}</Link> : <span className="text-muted-foreground">none</span>}</Td>
              <Td className="tabular-nums">
                {inv.uses}
                {inv.maxUses !== null ? ` / ${inv.maxUses}` : " / ∞"}
              </Td>
              <Td>{inv.expiresAt ? <Time date={inv.expiresAt} /> : <span className="text-muted-foreground">never</span>}</Td>
              <Td>{inv.accountExpiryDays ? `${inv.accountExpiryDays} days` : <span className="text-muted-foreground">profile default</span>}</Td>
              <Td>
                {inv.usedBy.length === 0 ? (
                  <span className="text-muted-foreground">nobody yet</span>
                ) : (
                  <ul className="text-xs">
                    {inv.usedBy.map((u) => (
                      <li key={u.id}>
                        <Link href={`/users/${u.jellyfinUserId}`}>{u.userName ?? u.jellyfinUserId.slice(0, 8)}</Link>{" "}
                        <span className="text-muted-foreground">
                          <Time date={u.createdAt} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  {inv.status === "active" && links.get(inv.id) ? <CopyButton value={links.get(inv.id)!} /> : null}
                  {inv.status === "active" ? (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={inv.id} />
                      <SubmitButton size="sm" variant="destructive">
                        Revoke
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Section title="Create an invite">
        <form action={createInviteAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <FormField id="label" label="Label">
              <Input name="label" maxLength={100} placeholder="Family, Friends of Alex…" />
            </FormField>
            <FormField id="profileId" label="Profile" help="Applied right after the account is created; if that fails the account is removed again.">
              <NativeSelect name="profileId" defaultValue="" className="w-full">
                <option value="">None (Jellyfin defaults)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="noteForInvitee" label="Note for the invitee">
              <Textarea name="noteForInvitee" maxLength={1000} className="min-h-16" placeholder="Shown on the signup page." />
            </FormField>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <FormField id="linkExpiryDays" label="Link expires (days)" help="0 = never">
                <Input name="linkExpiryDays" type="number" min={0} max={3650} defaultValue={INVITE_DEFAULT_EXPIRY_DAYS} />
              </FormField>
              <FormField id="maxUses" label="Max uses" help="0 = unlimited">
                <Input name="maxUses" type="number" min={0} max={100000} defaultValue={1} />
              </FormField>
              <FormField id="accountExpiryDays" label="Account expiry (days)" help="blank = profile default">
                <Input name="accountExpiryDays" type="number" min={0} max={3650} />
              </FormField>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="requireEmail" /> Require an email address
            </label>
            <SubmitButton pendingLabel="Creating…">Create invite</SubmitButton>
          </div>
        </form>
      </Section>
    </div>
  );
}
