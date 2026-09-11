import { requireAdmin } from "@/lib/auth/session";
import { inviteLink, listInvites } from "@/lib/services/invites";
import { listProfiles } from "@/lib/services/profiles";
import { inviteDefaults } from "@/lib/invites/defaults";
import { PageHeader } from "@/components/ui/page-header";
import { InvitesTable } from "@/components/invites/invites-table";
import { NewInviteDialog } from "@/components/invites/new-invite-dialog";

export const metadata = { title: "Invites" };

export default async function InvitesPage() {
  await requireAdmin();
  const [invites, profiles] = await Promise.all([listInvites(), listProfiles()]);
  const active = invites.filter((inv) => inv.status === "active");
  // Each link is a separate unseal; they do not depend on each other.
  const links = new Map((await Promise.all(active.map(async (inv) => [inv.id, await inviteLink(inv)] as const))).filter((entry): entry is [string, string] => entry[1] !== null));
  const profileOptions = profiles.map((p) => ({ id: p.id, name: p.name }));
  const newInvite = <NewInviteDialog profiles={profileOptions} defaults={inviteDefaults(invites[0], profiles.map((p) => p.id))} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Invites" count={invites.length} description="Links that let people create their own account with the profile you choose." actions={newInvite} />
      <InvitesTable invites={invites} profiles={profileOptions} links={links} action={newInvite} />
    </div>
  );
}
