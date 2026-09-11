import { StatusBadge, StatusDot } from "@/components/ui/status-badge";
import { POLICY_GROUPS, fieldsInGroup, type PolicyFieldDef } from "@/lib/policy/fields";
import type { ReferenceData } from "@/lib/services/reference";

function Bool({ value }: { value: unknown }) {
  return value === true ? <span>Yes</span> : <span className="text-muted-foreground">No</span>;
}

function IdList({ ids, resolve }: { ids: unknown; resolve: (id: string) => string | undefined }) {
  if (!Array.isArray(ids) || ids.length === 0) return <span className="text-muted-foreground">none</span>;
  return (
    <ul className="space-y-0.5">
      {ids.map((id) => {
        const name = resolve(String(id));
        return (
          <li key={String(id)}>
            {name ?? <code className="text-xs">{String(id)}</code>}
            {name ? null : (
              <StatusBadge tone="warning" className="ml-1" title="This id no longer exists on the server">
                missing
              </StatusBadge>
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
      return Array.isArray(value) && value.length ? <span>{value.map(String).join(", ")}</span> : <span className="text-muted-foreground">none</span>;
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
        <span className="text-muted-foreground">always</span>
      );
    default:
      return value === null || value === undefined || value === "" ? <span className="text-muted-foreground">—</span> : <span>{String(value)}</span>;
  }
}

/**
 * One label/value row. The raw field name is hidden while an ancestor carries `data-keys="off"`
 * (the access section's "Show field names" toggle); elsewhere it is always shown.
 */
export function PolicyRow({ field, value, refData, drift = false }: { field: PolicyFieldDef; value: unknown; refData: ReferenceData; /** Differs from the assigned profile. */ drift?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 py-1.5">
      <dt>
        <span className="inline-flex items-center gap-1.5">
          {field.label}
          {drift ? (
            <span title="Differs from the assigned profile" className="inline-flex">
              <StatusDot tone="warning" />
              <span className="sr-only">differs from the assigned profile</span>
            </span>
          ) : null}
        </span>
        <code className="block text-xs text-muted-foreground [[data-keys=off]_&]:hidden">{field.key}</code>
      </dt>
      <dd className="text-right">
        <PolicyValue field={field} value={value} refData={refData} />
      </dd>
    </div>
  );
}

/** Keys Jellyfin returned that the catalogue does not know; shown wherever the policy is, never folded away. */
export function UnknownFields({ fields }: { fields: Record<string, unknown> }) {
  return (
    <section className="rounded-lg border border-warning/40 p-3">
      <h3 className="font-medium">Unknown fields</h3>
      <p className="mb-2 text-xs text-muted-foreground">Returned by Jellyfin but not in this app&apos;s catalog. They are preserved on save.</p>
      <pre className="overflow-x-auto text-xs">{JSON.stringify(fields, null, 2)}</pre>
    </section>
  );
}

/** Read-only grouped rendering of a full UserPolicy, plus any keys the catalog does not know. */
export function PolicyView({ policy, refData, drift }: { policy: Record<string, unknown>; refData: ReferenceData; /** Keys that differ from the assigned profile. */ drift?: ReadonlySet<string> }) {
  const known = new Set<string>();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {POLICY_GROUPS.map((g) => {
        const fields = fieldsInGroup(g.id);
        fields.forEach((f) => known.add(f.key));
        return (
          <section key={g.id} className="rounded-lg border p-3">
            <h3 className="font-medium">{g.title}</h3>
            <p className="mb-2 text-xs text-muted-foreground">{g.description}</p>
            <dl className="divide-y divide-border">
              {fields.map((f) => (
                <PolicyRow key={f.key} field={f} value={policy[f.key]} refData={refData} drift={drift?.has(f.key)} />
              ))}
            </dl>
          </section>
        );
      })}
      {Object.keys(policy).some((k) => !known.has(k)) ? <UnknownFields fields={Object.fromEntries(Object.entries(policy).filter(([k]) => !known.has(k)))} /> : null}
    </div>
  );
}
