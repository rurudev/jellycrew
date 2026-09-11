import { ConfirmForm } from "@/components/confirm-form";
import { Time } from "@/components/time";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { KeyValue } from "@/components/ui/key-value";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Profile } from "@/lib/db/schema";
import type { UserRow } from "@/lib/users/types";
import { cancelDeletionAction, deleteNowAction, scheduleDeletionAction, updateMetaAction } from "@/app/(admin)/users/[id]/lifecycle-actions";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function LifecycleCard({ row, assigned, graceDays, isSelf }: { row: UserRow; assigned: Profile | null; graceDays: number; isSelf: boolean }) {
  const id = row.id;
  return (
    <Section title="Lifecycle">
      <form action={updateMetaAction} className="space-y-3">
        <input type="hidden" name="userId" value={id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="email" label="Email" help={row.meta.email ? row.meta.emailVerifiedAt ? <Badge tone="green">verified</Badge> : <Badge tone="amber">unverified</Badge> : "Used for password resets once verified."}>
            <Input name="email" type="email" defaultValue={row.meta.email ?? ""} />
          </Field>
          <Field id="labels" label="Labels" help="Comma-separated. Used for filtering and bulk actions.">
            <Input name="labels" defaultValue={row.labels.join(", ")} placeholder="family, trial" />
          </Field>
          <Field id="expiresAt" label="Expires on" help={row.isAdmin ? "Administrators are excluded from automation." : "Blank = never. The scheduler disables the account at 00:00 UTC on this date."}>
            <Input name="expiresAt" type="date" defaultValue={toDateInput(row.expiresAt)} disabled={row.isAdmin} />
          </Field>
          <Field
            id="inactivityDisableDays"
            label="Disable after inactivity (days)"
            help={<>Blank = inherit from profile{assigned ? ` (${assigned.name}: ${assigned.inactivityDisableDays ? `${assigned.inactivityDisableDays} days` : "never"})` : " (none assigned: never)"}.</>}
          >
            <Input name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={row.meta.inactivityDisableDays ?? ""} disabled={row.isAdmin} />
          </Field>
          <Field id="notes" label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={row.meta.notes ?? ""} maxLength={5000} />
          </Field>
        </div>
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save lifecycle
        </SubmitButton>
      </form>

      <KeyValue className="mt-4">
        {row.meta.disabledByAppAt ? (
          <KeyValue.Item label="Disabled by app">
            <Time date={row.meta.disabledByAppAt} /> ({row.meta.disabledReason})
          </KeyValue.Item>
        ) : null}
        <KeyValue.Item label="Last login">
          <Time date={row.lastLogin} />
        </KeyValue.Item>
        <KeyValue.Item label="Last activity">
          <Time date={row.lastActivity} />
        </KeyValue.Item>
        <KeyValue.Item label="First seen by app">
          <Time date={row.meta.firstSeenAt} />
        </KeyValue.Item>
        <KeyValue.Item label="Deletion">
          {row.meta.deleteAfter ? (
            <>
              scheduled <Time date={row.meta.deleteAfter} />
            </>
          ) : (
            <span className="text-fg-subtle">not scheduled</span>
          )}
        </KeyValue.Item>
      </KeyValue>

      <div className="mt-4 space-y-3 border-t border-edge pt-3">
        <h3 className="font-medium">Deletion</h3>
        {row.meta.deleteAfter ? (
          <form action={cancelDeletionAction}>
            <input type="hidden" name="userId" value={id} />
            <SubmitButton variant="secondary" pendingLabel="Cancelling…">
              Cancel scheduled deletion and re-enable
            </SubmitButton>
          </form>
        ) : (
          <ConfirmForm
            action={scheduleDeletionAction}
            phrase={row.name}
            label="Schedule deletion"
            hidden={{ userId: id }}
            description={
              isSelf || row.isAdmin ? (
                <span className="text-fg-subtle">{isSelf ? "You cannot delete your own account." : "Administrators cannot be scheduled for deletion. Remove administrator rights first."}</span>
              ) : (
                <>Disables the account now and deletes it after the {graceDays}-day grace period. Can be cancelled until then.</>
              )
            }
          />
        )}
        <ConfirmForm
          action={deleteNowAction}
          phrase={`delete ${row.name}`}
          label="Delete now (no grace period)"
          hidden={{ userId: id }}
          description={isSelf ? <span className="text-fg-subtle">You cannot delete your own account.</span> : <>Immediately and permanently deletes the Jellyfin account, its watch history and app metadata. Audit history is kept.</>}
        />
      </div>
    </Section>
  );
}
