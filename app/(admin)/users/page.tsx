import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/users";
import { applyUsersQuery, parseUsersQuery } from "@/lib/users/query";
import { Notice } from "@/components/notice";
import { UsersFilters } from "@/components/users/users-filters";
import { UsersTable } from "@/components/users/users-table";

export const metadata = { title: "Users" };

export default async function UsersPage(props: PageProps<"/users">) {
  await requireAdmin();
  const params = await props.searchParams;
  const query = parseUsersQuery(params);
  const all = await listUsers();
  const rows = applyUsersQuery(all, query);
  const labels = [...new Set(all.flatMap((r) => r.labels))].sort();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Users <span className="text-sm font-normal text-zinc-500">{rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}</span>
        </h1>
      </div>
      <Notice params={params} />
      <UsersFilters query={query} labels={labels} profiles={[]} />
      <UsersTable rows={rows} query={query} />
    </div>
  );
}
