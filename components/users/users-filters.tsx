import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { STATUS_FILTERS, type UsersQuery } from "@/lib/users/query";

const statusLabels: Record<(typeof STATUS_FILTERS)[number], string> = {
  enabled: "Enabled",
  disabled: "Disabled",
  disabled_by_app: "Disabled by app",
  expiring: "Expiring soon",
  expired: "Expired",
  deletion_scheduled: "Deletion scheduled",
  admin: "Administrators",
};

export function UsersFilters({
  query,
  labels,
  profiles,
}: {
  query: UsersQuery;
  labels: string[];
  profiles: Array<{ id: string; name: string }>;
}) {
  return (
    <form method="get" action="/users" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="dir" value={query.dir} />
      <div className="min-w-48 flex-1">
        <Input name="q" placeholder="Search name, email, notes, labels" defaultValue={query.q} aria-label="Search" />
      </div>
      <Select name="status" defaultValue={query.status ?? ""} aria-label="Status" width="auto">
        <option value="">Any status</option>
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </Select>
      <Select name="profile" defaultValue={query.profile ?? ""} aria-label="Profile" width="auto">
        <option value="">Any profile</option>
        <option value="none">No profile</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select name="label" defaultValue={query.label ?? ""} aria-label="Label" width="auto">
        <option value="">Any label</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </Select>
      <Select name="drift" defaultValue={query.drift ?? ""} aria-label="Drift" width="auto">
        <option value="">Drift: any</option>
        <option value="yes">Has drift</option>
        <option value="no">No drift</option>
      </Select>
      <div className="flex items-center gap-1">
        <span className="text-fg-muted">Inactive ≥</span>
        <Input name="inactive" type="number" min={1} defaultValue={query.inactive ?? ""} width="auto" className="w-20" aria-label="Inactive for days" />
        <span className="text-fg-muted">days</span>
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
      <Link href="/users" className="px-2 text-fg-muted hover:underline">
        Reset
      </Link>
    </form>
  );
}
