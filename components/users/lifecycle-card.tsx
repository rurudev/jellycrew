import { ConfirmForm } from "@/components/confirm-form";
import { Time } from "@/components/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
import type { Profile } from "@/lib/db/schema";
import type { UserRow } from "@/lib/users/types";
import { cancelDeletionAction, deleteNowAction, scheduleDeletionAction, updateMetaAction } from "@/app/(admin)/users/[id]/lifecycle-actions";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function LifecycleCard({ row, assigned, graceDays, isSelf }: { row: UserRow; assigned: Profile | null; graceDays: number; isSelf: boolean }) {
  const id = row.id;
  return (
    <Card>
      <CardTitle>Lifecycle</CardTitle>
      <form action={updateMetaAction} className="space-y-3">
        <input type="hidden" name="userId" value={id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={row.meta.email ?? ""} />
            <Help>
              {row.meta.email ? row.meta.emailVerifiedAt ? <Badge tone="green">verified</Badge> : <Badge tone="amber">unverified</Badge> : "Used for password resets once verified."}
            </Help>
          </div>
          <div>
            <Label htmlFor="labels">Labels</Label>
            <Input id="labels" name="labels" defaultValue={row.labels.join(", ")} placeholder="family, trial" />
            <Help>Comma-separated. Used for filtering and bulk actions.</Help>
          </div>
          <div>
            <Label htmlFor="expiresAt">Expires on</Label>
            <Input id="expiresAt" name="expiresAt" type="date" defaultValue={toDateInput(row.expiresAt)} disabled={row.isAdmin} />
            <Help>{row.isAdmin ? "Administrators are excluded from automation." : "Blank = never. The scheduler disables the account at 00:00 UTC on this date."}</Help>
          </div>
          <div>
            <Label htmlFor="inactivityDisableDays">Disable after inactivity (days)</Label>
            <Input id="inactivityDisableDays" name="inactivityDisableDays" type="number" min={1} max={3650} defaultValue={row.meta.inactivityDisableDays ?? ""} disabled={row.isAdmin} />
            <Help>
              Blank = inherit from profile{assigned ? ` (${assigned.name}: ${assigned.inactivityDisableDays ? `${assigned.inactivityDisableDays} days` : "never"})` : " (none assigned: never)"}.
            </Help>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={row.meta.notes ?? ""} maxLength={5000} />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          Save lifecycle
        </Button>
      </form>

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
        {row.meta.disabledByAppAt ? (
          <>
            <dt className="text-zinc-500">Disabled by app</dt>
            <dd>
              <Time date={row.meta.disabledByAppAt} /> ({row.meta.disabledReason})
            </dd>
          </>
        ) : null}
        <dt className="text-zinc-500">Last login</dt>
        <dd>
          <Time date={row.lastLogin} />
        </dd>
        <dt className="text-zinc-500">Last activity</dt>
        <dd>
          <Time date={row.lastActivity} />
        </dd>
        <dt className="text-zinc-500">First seen by app</dt>
        <dd>
          <Time date={row.meta.firstSeenAt} />
        </dd>
        <dt className="text-zinc-500">Deletion</dt>
        <dd>
          {row.meta.deleteAfter ? (
            <>
              scheduled <Time date={row.meta.deleteAfter} />
            </>
          ) : (
            <span className="text-zinc-400">not scheduled</span>
          )}
        </dd>
      </dl>

      <div className="mt-4 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <h3 className="font-medium">Deletion</h3>
        {row.meta.deleteAfter ? (
          <form action={cancelDeletionAction}>
            <input type="hidden" name="userId" value={id} />
            <Button type="submit" variant="secondary">
              Cancel scheduled deletion and re-enable
            </Button>
          </form>
        ) : (
          <ConfirmForm
            action={scheduleDeletionAction}
            phrase={row.name}
            label="Schedule deletion"
            hidden={{ userId: id }}
            description={
              isSelf || row.isAdmin ? (
                <span className="text-zinc-400">{isSelf ? "You cannot delete your own account." : "Administrators cannot be scheduled for deletion. Remove administrator rights first."}</span>
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
          description={isSelf ? <span className="text-zinc-400">You cannot delete your own account.</span> : <>Immediately and permanently deletes the Jellyfin account, its watch history and app metadata. Audit history is kept.</>}
        />
      </div>
    </Card>
  );
}
