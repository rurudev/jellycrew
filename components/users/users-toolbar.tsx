import { XIcon } from "lucide-react";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Chip } from "@/components/ui/chip";
import { FilterForm } from "@/components/ui/filter-form";
import { SearchField } from "@/components/ui/search-field";
import { STATUS_FILTERS, usersQueryToParams, type UsersQuery } from "@/lib/users/query";

export const statusLabels: Record<(typeof STATUS_FILTERS)[number], string> = {
  enabled: "Enabled",
  disabled: "Disabled",
  disabled_by_app: "Disabled by app",
  expiring: "Expiring soon",
  expired: "Expired",
  deletion_scheduled: "Deletion scheduled",
  admin: "Administrators",
};

const inactivePresets = [30, 90, 180, 365];

type Profiles = Array<{ id: string; name: string }>;

/** Search plus filters that apply as soon as they change; the URL is the only state. */
export function UsersToolbar({ query, labels, profiles }: { query: UsersQuery; labels: string[]; profiles: Profiles }) {
  // A filter already in the URL stays selectable even when nothing matches it any more, so the
  // next auto-submit cannot silently drop it.
  const inactiveOptions = query.inactive && !inactivePresets.includes(query.inactive) ? [...inactivePresets, query.inactive].sort((a, b) => a - b) : inactivePresets;
  const labelOptions = query.label && !labels.includes(query.label) ? [...labels, query.label].sort() : labels;
  const profileOptions = query.profile && query.profile !== "none" && !profiles.some((p) => p.id === query.profile) ? [...profiles, { id: query.profile, name: "Unknown profile" }] : profiles;
  // Keyed on the query: uncontrolled fields keep their DOM value across client navigations
  // otherwise, so a removed chip or a cleared search would resubmit stale values.
  const key = usersQueryToParams(query).toString();
  return (
    <div className="space-y-2">
      <FilterForm key={key} action="/users" className="flex flex-wrap items-center gap-2">
        {query.sort !== "name" ? <input type="hidden" name="sort" value={query.sort} /> : null}
        {query.dir !== "asc" ? <input type="hidden" name="dir" value={query.dir} /> : null}
        <SearchField name="q" defaultValue={query.q} placeholder="Search name, email, notes, labels" aria-label="Search users" className="min-w-56 flex-1" />
        <AutoSubmitSelect name="status" defaultValue={query.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="profile" defaultValue={query.profile ?? ""} aria-label="Profile">
          <option value="">Any profile</option>
          <option value="none">No profile</option>
          {profileOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </AutoSubmitSelect>
        {labelOptions.length > 0 ? (
          <AutoSubmitSelect name="label" defaultValue={query.label ?? ""} aria-label="Label">
            <option value="">Any label</option>
            {labelOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </AutoSubmitSelect>
        ) : null}
        <AutoSubmitSelect name="drift" defaultValue={query.drift ?? ""} aria-label="Drift">
          <option value="">Any drift</option>
          <option value="yes">Has drift</option>
          <option value="no">No drift</option>
        </AutoSubmitSelect>
        <AutoSubmitSelect name="inactive" defaultValue={query.inactive ? String(query.inactive) : ""} aria-label="Inactivity">
          <option value="">Any activity</option>
          {inactiveOptions.map((d) => (
            <option key={d} value={d}>
              Inactive {d}+ days
            </option>
          ))}
        </AutoSubmitSelect>
        {/* Submit target for browsers without JavaScript; not a tab stop, Enter and the selects already submit. */}
        <button type="submit" tabIndex={-1} className="sr-only">
          Apply filters
        </button>
      </FilterForm>
      <FilterChips query={query} profiles={profiles} />
    </div>
  );
}

type ChipKey = "q" | "status" | "profile" | "label" | "drift" | "inactive";

function chipsFor(query: UsersQuery, profiles: Profiles): Array<{ key: ChipKey; text: string }> {
  const chips: Array<{ key: ChipKey; text: string }> = [];
  if (query.q) chips.push({ key: "q", text: `Search: ${query.q}` });
  if (query.status) chips.push({ key: "status", text: statusLabels[query.status] });
  if (query.profile) chips.push({ key: "profile", text: query.profile === "none" ? "No profile" : (profiles.find((p) => p.id === query.profile)?.name ?? "Unknown profile") });
  if (query.label) chips.push({ key: "label", text: `Label: ${query.label}` });
  if (query.drift) chips.push({ key: "drift", text: query.drift === "yes" ? "Has drift" : "No drift" });
  if (query.inactive) chips.push({ key: "inactive", text: `Inactive ${query.inactive}+ days` });
  return chips;
}

/** The active filters, each removable on its own, plus a way to clear them all. Sort survives. */
function FilterChips({ query, profiles }: { query: UsersQuery; profiles: Profiles }) {
  const chips = chipsFor(query, profiles);
  if (chips.length === 0) return null;
  const without = (key: ChipKey) => `/users?${usersQueryToParams({ ...query, [key]: undefined, ...(key === "q" ? { q: "" } : {}) }).toString()}`;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <Chip render={<Link href={without(c.key)} />} className="gap-1 pr-1 hover:bg-muted/70" aria-label={`Remove filter: ${c.text}`}>
            {c.text}
            <XIcon aria-hidden className="size-3" />
          </Chip>
        </li>
      ))}
      <li>
        <Link href={`/users?${usersQueryToParams({ sort: query.sort, dir: query.dir }).toString()}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Clear all
        </Link>
      </li>
    </ul>
  );
}
