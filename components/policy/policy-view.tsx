import { Badge } from "@/components/ui/badge";
import { POLICY_GROUPS, fieldsInGroup, type PolicyFieldDef } from "@/lib/policy/fields";
import type { ReferenceData } from "@/lib/services/reference";

function Bool({ value }: { value: unknown }) {
  return value === true ? <Badge tone="green">yes</Badge> : <Badge>no</Badge>;
}

function IdList({ ids, resolve }: { ids: unknown; resolve: (id: string) => string | undefined }) {
  if (!Array.isArray(ids) || ids.length === 0) return <span className="text-zinc-400">none</span>;
  return (
    <ul className="space-y-0.5">
      {ids.map((id) => {
        const name = resolve(String(id));
        return (
          <li key={String(id)}>
            {name ?? <code className="text-xs">{String(id)}</code>}
            {name ? null : (
              <Badge tone="amber" className="ml-1" title="This id no longer exists on the server">
                missing
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ratingName(value: unknown, ref: ReferenceData): string {
  if (value === null || value === undefined) return "No limit";
  const matches = ref.ratings.filter((r) => r.value === value).map((r) => r.name);
  return matches.length ? `${matches.join(" / ")} (${String(value)})` : String(value);
}

function scheduleText(s: unknown): string {
  if (!s || typeof s !== "object") return JSON.stringify(s);
  const o = s as { DayOfWeek?: string; StartHour?: number; EndHour?: number };
  const fmt = (h: number | undefined) => {
    if (h === undefined) return "?";
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  return `${o.DayOfWeek ?? "?"} ${fmt(o.StartHour)}–${fmt(o.EndHour)}`;
}

export function PolicyValue({ field, value, refData }: { field: PolicyFieldDef; value: unknown; refData: ReferenceData }) {
  switch (field.kind) {
    case "boolean":
      return <Bool value={value} />;
    case "folderIds":
      return <IdList ids={value} resolve={(id) => refData.folderById.get(id)?.name} />;
    case "deviceIds":
      return <IdList ids={value} resolve={(id) => refData.deviceById.get(id)?.name} />;
    case "channelIds":
    case "stringList":
    case "unratedItems":
      return Array.isArray(value) && value.length ? <span>{value.map(String).join(", ")}</span> : <span className="text-zinc-400">none</span>;
    case "rating":
      return <span>{ratingName(value, refData)}</span>;
    case "schedules":
      return Array.isArray(value) && value.length ? (
        <ul>
          {value.map((s, i) => (
            <li key={i}>{scheduleText(s)}</li>
          ))}
        </ul>
      ) : (
        <span className="text-zinc-400">always</span>
      );
    default:
      return value === null || value === undefined || value === "" ? <span className="text-zinc-400">—</span> : <span>{String(value)}</span>;
  }
}

/** Read-only grouped rendering of a full UserPolicy, plus any keys the catalog does not know. */
export function PolicyView({ policy, refData }: { policy: Record<string, unknown>; refData: ReferenceData }) {
  const known = new Set<string>();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {POLICY_GROUPS.map((g) => {
        const fields = fieldsInGroup(g.id);
        fields.forEach((f) => known.add(f.key));
        return (
          <section key={g.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <h3 className="font-semibold">{g.title}</h3>
            <p className="mb-2 text-xs text-zinc-500">{g.description}</p>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] gap-2 py-1.5">
                  <dt>
                    <div>{f.label}</div>
                    <code className="text-[11px] text-zinc-400">{f.key}</code>
                  </dt>
                  <dd className="text-right">
                    <PolicyValue field={f} value={policy[f.key]} refData={refData} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      {Object.keys(policy).some((k) => !known.has(k)) ? (
        <section className="rounded-md border border-amber-300 p-3">
          <h3 className="font-semibold">Unknown fields</h3>
          <p className="mb-2 text-xs text-zinc-500">Returned by Jellyfin but not in this app&apos;s catalog. They are preserved on save.</p>
          <pre className="overflow-x-auto text-xs">{JSON.stringify(Object.fromEntries(Object.entries(policy).filter(([k]) => !known.has(k))), null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
