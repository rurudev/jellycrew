import Link from "next/link";
import { PolicyRow, PolicyView, UnknownFields } from "@/components/policy/policy-view";
import { summarizePolicy } from "@/lib/policy/summary";
import type { ReferenceData } from "@/lib/services/reference";
import { AccessToggles } from "./access-toggles";

/**
 * The access section: first the fields that drift from the assigned profile or differ from
 * Jellyfin's defaults (usually a handful), the full 44-field view behind a toggle. `driftKeys`
 * comes from the page's drift diff so this and the profile card never disagree.
 */
export function AccessSummary({ policy, profile, driftKeys, refData }: { policy: Record<string, unknown>; profile: { id: string; name: string } | null; driftKeys: ReadonlySet<string>; refData: ReferenceData }) {
  const summary = summarizePolicy(policy, driftKeys);
  const drifting = summary.groups.reduce((n, g) => n + g.rows.filter((r) => r.drift).length, 0);
  const intro =
    summary.highlighted === 0 ? (
      <p className="text-muted-foreground">Every field is at Jellyfin&apos;s default{profile ? " and matches the profile" : ""}.</p>
    ) : (
      <p className="text-muted-foreground">
        {summary.highlighted} of {summary.total} fields differ from {profile ? "Jellyfin's defaults or the profile" : "Jellyfin's defaults"}
        {profile && drifting ? (
          <>
            ; {drifting} {drifting === 1 ? "drifts" : "drift"} from{" "}
            <Link href={`/profiles/${profile.id}`} className="underline">
              {profile.name}
            </Link>
          </>
        ) : null}
        .
      </p>
    );
  const hasUnknown = Object.keys(summary.unknown).length > 0;
  return (
    <AccessToggles
      total={summary.total}
      summary={
        <div className="space-y-3">
          {intro}
          {summary.groups.length || hasUnknown ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {summary.groups.map((g) => (
                <section key={g.id} className="rounded-lg border p-3">
                  <h3 className="mb-2 font-medium">{g.title}</h3>
                  <dl className="divide-y divide-border">
                    {g.rows.map((r) => (
                      <PolicyRow key={r.field.key} field={r.field} value={r.value} refData={refData} drift={r.drift} />
                    ))}
                  </dl>
                </section>
              ))}
              {hasUnknown ? <UnknownFields fields={summary.unknown} /> : null}
            </div>
          ) : null}
        </div>
      }
      full={<PolicyView policy={policy} refData={refData} drift={driftKeys} />}
    />
  );
}
