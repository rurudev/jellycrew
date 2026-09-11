import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/db/schema";
import type { UserRow } from "@/lib/users/types";
import { updateMetaAction } from "@/app/(admin)/users/[id]/lifecycle-actions";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Email, labels, expiry, inactivity rule and notes: the app's own data about a user, saved together. */
export function LifecycleForm({ row, assigned }: { row: UserRow; assigned: Profile | null }) {
  return (
    <Section title="Lifecycle" description="What jellycrew knows about this user beyond Jellyfin.">
      <form action={updateMetaAction} className="space-y-3">
        <input type="hidden" name="userId" value={row.id} />
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
        <FormField id="notes" label="Notes">
          <Textarea name="notes" defaultValue={row.meta.notes ?? ""} maxLength={5000} />
        </FormField>
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save lifecycle
        </SubmitButton>
      </form>
    </Section>
  );
}
