import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/users";
import { applyUsersQuery, parseUsersQuery } from "@/lib/users/query";
import { listProfiles } from "@/lib/services/profiles";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BulkSelection } from "@/components/users/bulk-bar";
import { UsersTable } from "@/components/users/users-table";
import { UsersToolbar } from "@/components/users/users-toolbar";
import { bulkAction } from "./bulk-actions";

export const metadata = { title: "Users" };

export default async function UsersPage(props: PageProps<"/users">) {
  await requireAdmin();
  const params = await props.searchParams;
  const query = parseUsersQuery(params);
  const all = await listUsers();
  const rows = applyUsersQuery(all, query);
  const labels = [...new Set(all.flatMap((r) => r.labels))].sort();
  const profiles = listProfiles().map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        count={rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}
        actions={
          <Link href="/invites?new=1" className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" />
            Invite
          </Link>
        }
      />
      <UsersToolbar query={query} labels={labels} profiles={profiles} />
      <BulkSelection action={bulkAction} profiles={profiles} ids={rows.map((r) => r.id)}>
        <UsersTable rows={rows} query={query} />
      </BulkSelection>
    </div>
  );
}
