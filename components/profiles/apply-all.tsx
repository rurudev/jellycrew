"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { DiffTable } from "@/components/policy/diff-table";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogHost, useOpenDialog } from "@/components/ui/dialog-host";
import { Spinner } from "@/components/ui/spinner";
import { applyToMembersAction } from "@/app/(admin)/profiles/actions";
import type { ProfileActionState } from "@/app/(admin)/profiles/state";

/** Opens the apply-to-members preview. */
export function ApplyToMembersButton({ disabled }: { disabled?: boolean }) {
  const open = useOpenDialog();
  return (
    <Button type="button" variant="outline" disabled={disabled} onClick={open}>
      Apply to all members
    </Button>
  );
}

export function ApplyToMembers({ profileId, profileName, children }: { profileId: string; profileName: string; children: React.ReactNode }) {
  return (
    <DialogHost className="sm:max-w-2xl" dialog={<ApplyToMembersBody profileId={profileId} profileName={profileName} />}>
      {children}
    </DialogHost>
  );
}

function ApplyToMembersBody({ profileId, profileName }: { profileId: string; profileName: string }) {
  const [state, submit, pending] = useActionState<ProfileActionState, FormData>(async (prev, formData) => {
    const result = await applyToMembersAction(prev, formData);
    if (result.ok) toast.success(result.ok);
    return result;
  }, {});
  const preview = state.preview;
  const drifting = preview?.filter((m) => m.changes.length > 0) ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Apply {profileName} to its members</DialogTitle>
        <DialogDescription>Each member&apos;s Jellyfin settings are overwritten with the profile&apos;s, one after another. Nothing else about them changes.</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="profileId" value={profileId} />
        {state.error ? <Callout tone="error">{state.error}</Callout> : null}

        {state.ok ? (
          <p>{state.ok}</p>
        ) : preview ? (
          preview.length === 0 ? (
            <p className="text-muted-foreground">This profile has no members yet.</p>
          ) : drifting.length === 0 ? (
            <p>All {preview.length === 1 ? "1 member" : `${preview.length} members`} already match. Applying would change nothing.</p>
          ) : (
            <div className="space-y-3">
              <p>
                {drifting.length === 1 ? "1 member differs" : `${drifting.length} of ${preview.length} members differ`} from the profile:
              </p>
              <div className="max-h-80 space-y-3 overflow-auto rounded-lg border p-3">
                {drifting.map((member) => (
                  <div key={member.id}>
                    <p className="font-medium">{member.name}</p>
                    <div className="overflow-x-auto">
                      <DiffTable changes={member.changes} beforeLabel="Now" afterLabel="After" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <p className="text-muted-foreground">Check what would change before anything is written.</p>
        )}

        {drifting.map((member) => (
          <input key={member.id} type="hidden" name="memberId" value={member.id} />
        ))}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{state.ok ? "Close" : "Cancel"}</DialogClose>
          {!state.ok && preview && drifting.length > 0 ? (
            <Button type="submit" name="confirm" value="1" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Applying…" : `Apply to ${drifting.length === 1 ? "1 member" : `${drifting.length} members`}`}
            </Button>
          ) : state.ok || preview ? null : (
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Checking…" : "Show what would change"}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  );
}
