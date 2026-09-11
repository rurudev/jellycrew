import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/users";
import { applyUsersQuery, parseUsersQuery } from "@/lib/users/query";
import { listProfiles } from "@/lib/services/profiles";
import { PageHeader } from "@/components/ui/page-header";
import { BulkForm } from "@/components/users/bulk-form";
import { UsersFilters } from "@/components/users/users-filters";
import { UsersTable } from "@/components/users/users-table";
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
      <PageHeader title="Users" count={rows.length === all.length ? all.length : `${rows.length} of ${all.length}`} />
      <UsersFilters query={query} labels={labels} profiles={profiles} />
      <BulkForm action={bulkAction} profiles={profiles}>
        <UsersTable rows={rows} query={query} selectable />
      </BulkForm>
    </div>
  );
}
