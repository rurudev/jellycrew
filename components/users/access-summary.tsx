import Link from "next/link";
import { PolicyRow, PolicyView } from "@/components/policy/policy-view";
import { summarizePolicy } from "@/lib/policy/summary";
import type { ReferenceData } from "@/lib/services/reference";
import { AccessToggles } from "./access-toggles";

/**
 * The access section: first the fields that differ from the assigned profile or from
 * Jellyfin's defaults (usually a handful), the full 44-field view behind a toggle.
 */
export function AccessSummary({ policy, profile, refData }: { policy: Record<string, unknown>; profile: { id: string; name: string; policy: Record<string, unknown> } | null; refData: ReferenceData }) {
  const summary = summarizePolicy(policy, profile?.policy ?? null);
  const drifted = new Set(summary.groups.flatMap((g) => g.rows.filter((r) => r.drift).map((r) => r.field.key)));
  const drifting = drifted.size;
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
  return (
    <AccessToggles
      highlighted={summary.highlighted}
      total={summary.total}
      summary={
        <div className="space-y-3">
          {intro}
          {summary.groups.length ? (
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
            </div>
          ) : null}
        </div>
      }
      full={<PolicyView policy={policy} refData={refData} drift={drifted} />}
    />
  );
}
