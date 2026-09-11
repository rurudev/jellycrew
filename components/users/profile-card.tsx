import Link from "next/link";
import { showPolicyValue } from "@/components/policy/diff-table";
import { FormField, Hint } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Profile } from "@/lib/db/schema";
import type { FieldChange } from "@/lib/policy/diff";
import { POLICY_FIELD_BY_KEY } from "@/lib/policy/fields";
import type { AdoptPreview } from "@/lib/services/profiles";
import { adoptIntoProfileAction, applyProfileAction, assignProfileAction } from "@/app/(admin)/users/[id]/actions";

/** Which profile the user follows, how far the live policy has drifted from it, and the two ways to reconcile. */
export function ProfileCard({ userId, profiles, assigned, drift, adopt }: { userId: string; profiles: Profile[]; assigned: Profile | null; drift: FieldChange[] | null; adopt: AdoptPreview | null }) {
  const drifting = adopt ? adopt.otherMembers.filter((m) => m.willDrift).length : 0;
  return (
    <Section title="Profile">
      <form action={assignProfileAction} className="space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <FormField id="profileId" label="Assigned profile" help="Assigning only records the link. Apply pushes the profile's managed fields to Jellyfin.">
          <div className="flex gap-2">
            <NativeSelect name="profileId" defaultValue={assigned?.id ?? ""} className="min-w-0 flex-1">
              <option value="">No profile</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            <SubmitButton variant="outline" pendingLabel="Assigning…">
              Assign
            </SubmitButton>
          </div>
        </FormField>
      </form>
      {assigned ? (
        <div className="mt-4 space-y-3">
          {drift?.length ? (
            <>
              <p>
                {drift.length} {drift.length === 1 ? "field drifts" : "fields drift"} from{" "}
                <Link href={`/profiles/${assigned.id}`} className="underline">
                  {assigned.name}
                </Link>
                .
              </p>
              <dl className="divide-y divide-border rounded-lg border">
                {drift.map((c) => (
                  <div key={c.key} className="px-3 py-1.5">
                    <dt>{POLICY_FIELD_BY_KEY.get(c.key)?.label ?? c.key}</dt>
                    <dd className="text-xs">
                      <span className="text-muted-foreground">User </span>
                      <span className="break-all text-destructive">{showPolicyValue(c.before)}</span>
                      <span className="text-muted-foreground"> · Profile </span>
                      <span className="break-all text-success">{showPolicyValue(c.after)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <form action={applyProfileAction}>
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Applying…">
                    Apply profile to user
                  </SubmitButton>
                </form>
                <form action={adoptIntoProfileAction}>
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="profileId" value={assigned.id} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Adopting…">
                    Adopt user into profile
                  </SubmitButton>
                </form>
              </div>
              {adopt ? (
                <Hint>
                  Adopting makes the profile match this user&apos;s live settings; {drifting} of {adopt.otherMembers.length} other {adopt.otherMembers.length === 1 ? "member" : "members"} would then drift.
                </Hint>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">
              Matches{" "}
              <Link href={`/profiles/${assigned.id}`} className="underline">
                {assigned.name}
              </Link>
              .
            </p>
          )}
        </div>
      ) : null}
    </Section>
  );
}
