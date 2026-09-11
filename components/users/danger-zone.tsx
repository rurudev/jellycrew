import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UserRow } from "@/lib/users/types";
import { cancelDeletionAction, deleteNowAction, scheduleDeletionAction } from "@/app/(admin)/users/[id]/lifecycle-actions";

/** The two ways to delete a user, each behind a typed confirmation; nothing destructive is on the page until asked for. */
export function DangerZone({ row, graceDays, isSelf }: { row: UserRow; graceDays: number; isSelf: boolean }) {
  return (
    <Section title="Danger zone" description={row.meta.deleteAfter ? "Deletion is scheduled; cancelling re-enables the account." : `Scheduling disables the account now and deletes it after ${graceDays} days.`}>
      <div className="flex flex-wrap items-start gap-2">
        {row.meta.deleteAfter ? (
          <form action={cancelDeletionAction}>
            <input type="hidden" name="userId" value={row.id} />
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
            hidden={{ userId: row.id }}
            disabledReason={isSelf ? "You cannot delete your own account." : row.isAdmin ? "Administrators cannot be scheduled for deletion. Remove administrator rights first." : undefined}
          />
        )}
        <ConfirmDialog
          label="Delete now"
          title={`Delete ${row.name} permanently?`}
          description="Immediately and permanently deletes the Jellyfin account, its watch history and app metadata. There is no grace period. Audit history is kept."
          phrase={`delete ${row.name}`}
          action={deleteNowAction}
          hidden={{ userId: row.id }}
          disabledReason={isSelf ? "You cannot delete your own account." : undefined}
        />
      </div>
    </Section>
  );
}
