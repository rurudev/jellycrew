import { Timestamp } from "@/components/ui/timestamp";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
          <FormField id="email" label="Email" help={row.meta.email ? row.meta.emailVerifiedAt ? <StatusBadge tone="success">verified</StatusBadge> : <StatusBadge tone="warning">unverified</StatusBadge> : "Used for password resets once verified."}>
            <Input name="email" type="email" defaultValue={row.meta.email ?? ""} />
          </FormField>
          <FormField id="labels" label="Labels" help="Comma-separated. Used for filtering and bulk actions.">
            <Input name="labels" defaultValue={row.labels.join(", ")} placeholder="family, trial" />
          </FormField>
          <FormField id="expiresAt" label="Expires on" help={row.isAdmin ? "Administrators are excluded from automation." : "Blank = never. The scheduler disables the account at 00:00 UTC on this date."}>
            <Input name="expiresAt" type="date" defaultValue={toDateInput(row.expiresAt)} disabled={row.isAdmin} />
          </FormField>
          <FormField
            id="inactivityDisableDays"
            label="Disable after inactivity (days)"
            help={<>Blank = inherit from profile{assigned ? ` (${assigned.name}: ${assigned.inactivityDisableDays ? `${assigned.inactivityDisableDays} days` : "never"})` : " (none assigned: never)"}.</>}
          >
            <Input name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={row.meta.inactivityDisableDays ?? ""} disabled={row.isAdmin} />
          </FormField>
          <FormField id="notes" label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={row.meta.notes ?? ""} maxLength={5000} />
          </FormField>
        </div>
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save lifecycle
        </SubmitButton>
      </form>

      <KeyValue className="mt-4">
        {row.meta.disabledByAppAt ? (
          <KeyValue.Item label="Disabled by app">
            <Timestamp date={row.meta.disabledByAppAt} absolute /> ({row.meta.disabledReason})
          </KeyValue.Item>
        ) : null}
        <KeyValue.Item label="Last login">
          <Timestamp date={row.lastLogin} absolute />
        </KeyValue.Item>
        <KeyValue.Item label="Last activity">
          <Timestamp date={row.lastActivity} absolute />
        </KeyValue.Item>
        <KeyValue.Item label="First seen by app">
          <Timestamp date={row.meta.firstSeenAt} absolute />
        </KeyValue.Item>
        <KeyValue.Item label="Deletion">
          {row.meta.deleteAfter ? (
            <>
              scheduled <Timestamp date={row.meta.deleteAfter} absolute />
            </>
          ) : (
            <span className="text-muted-foreground">not scheduled</span>
          )}
        </KeyValue.Item>
      </KeyValue>

      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <h3 className="font-medium">Deletion</h3>
        <div className="flex flex-wrap items-start gap-2">
          {row.meta.deleteAfter ? (
            <form action={cancelDeletionAction}>
              <input type="hidden" name="userId" value={id} />
              <SubmitButton variant="outline" pendingLabel="Cancelling…">
                Cancel scheduled deletion and re-enable
              </SubmitButton>
            </form>
          ) : (
            <ConfirmDialog
              label="Schedule deletion"
              title={`Schedule deletion of ${row.name}?`}
              description={`Disables the account now and deletes it after the ${graceDays}-day grace period. You can cancel until then.`}
              phrase={row.name}
              action={scheduleDeletionAction}
              hidden={{ userId: id }}
              disabledReason={isSelf ? "You cannot delete your own account." : row.isAdmin ? "Administrators cannot be scheduled for deletion. Remove administrator rights first." : undefined}
            />
          )}
          <ConfirmDialog
            label="Delete now"
            title={`Delete ${row.name} permanently?`}
            description="Immediately and permanently deletes the Jellyfin account, its watch history and app metadata. There is no grace period. Audit history is kept."
            phrase={`delete ${row.name}`}
            action={deleteNowAction}
            hidden={{ userId: id }}
            disabledReason={isSelf ? "You cannot delete your own account." : undefined}
          />
        </div>
      </div>
    </Section>
  );
}
