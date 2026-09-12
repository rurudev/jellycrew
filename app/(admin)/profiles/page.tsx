import { requireAdmin } from "@/lib/auth/session";
import { listProfilesWithCounts } from "@/lib/services/profiles";
import { listUsers } from "@/lib/services/users";
import { NewProfile, NewProfileButton } from "@/components/profiles/new-profile";
import { ProfilesTable } from "@/components/profiles/profiles-table";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Profiles" };

export default async function ProfilesPage() {
  await requireAdmin();
  const [profiles, users] = await Promise.all([listProfilesWithCounts(), listUsers()]);
  const names = profiles.map((p) => ({ id: p.id, name: p.name }));

  return (
    <NewProfile users={users.map((u) => ({ id: u.id, name: u.name }))} profiles={names}>
      <div className="space-y-4">
        <PageHeader
          title="Profiles"
          count={profiles.length}
          description="Sets of Jellyfin settings you hand to accounts, so a change reaches everyone who follows one."
          actions={<NewProfileButton />}
        />
        <ProfilesTable profiles={profiles} action={<NewProfileButton variant="outline" />} />
      </div>
    </NewProfile>
  );
}
