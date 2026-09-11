"use client";

import { useActionState, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyField } from "@/components/ui/copy-field";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/forms/action-state";
import type { InviteDefaults } from "@/lib/invites/defaults";
import { createInviteAction } from "@/app/(admin)/invites/actions";

function expiryLabel(days: number): string {
  return days === 0 ? "Never" : days === 1 ? "In 1 day" : `In ${days} days`;
}

function usesLabel(uses: number): string {
  return uses === 0 ? "Unlimited" : uses === 1 ? "One person" : `${uses} people`;
}

/**
 * Making an invite: the terms of the last one are already filled in, and the finished link is
 * shown here rather than put in the URL. `/invites?new=1` opens it on arrival, which is where
 * the Invite button on the users page leads.
 */
export function NewInviteDialog({ profiles, defaults }: { profiles: Array<{ id: string; name: string }>; defaults: InviteDefaults }) {
  const id = useId();
  const params = useSearchParams();
  // Read once: closing must not be undone by the parameter still sitting in the URL.
  const [open, setOpen] = useState(() => params.get("new") === "1");
  const [state, submit] = useActionState(createInviteAction, IDLE);

  const close = () => {
    setOpen(false);
    if (window.location.search.includes("new=1")) window.history.replaceState(null, "", window.location.pathname);
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" aria-hidden />
        New invite
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{state.link ? "Invite ready" : "New invite"}</DialogTitle>
            <DialogDescription>
              {state.link ? "Send this link to the person you are inviting. They pick their own username and password." : "A link that lets someone create their own account with the profile you choose."}
            </DialogDescription>
          </DialogHeader>

          {state.link ? (
            <div className="grid gap-4">
              <CopyField value={state.link} label="Copy link" />
              <DialogFooter>
                <DialogClose render={<Button type="button" />}>Done</DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <form action={submit} className="grid gap-4">
              {state.error ? <Callout tone="error">{state.error}</Callout> : null}
              <FormField id={`${id}-label`} label="Label" help="For your own list. The invitee never sees it.">
                <Input name="label" maxLength={100} placeholder="Family, friends of Alex…" />
              </FormField>
              <FormField id={`${id}-profile`} label="Profile" help="Applied as soon as the account exists. If that fails, the account is removed again.">
                <NativeSelect name="profileId" defaultValue={defaults.profileId}>
                  <option value="">None, use Jellyfin&apos;s defaults</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={`${id}-expiry`} label="Link expires">
                  <NativeSelect name="linkExpiryDays" defaultValue={String(defaults.linkExpiryDays)}>
                    {defaults.linkExpiryChoices.map((days) => (
                      <option key={days} value={days}>
                        {expiryLabel(days)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id={`${id}-uses`} label="Can be used by">
                  <NativeSelect name="maxUses" defaultValue={String(defaults.maxUses)}>
                    {defaults.usesChoices.map((uses) => (
                      <option key={uses} value={uses}>
                        {usesLabel(uses)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <FormField id={`${id}-account`} label="Accounts expire after (days)" help="Leave blank to follow the profile.">
                <Input name="accountExpiryDays" type="number" min={0} max={3650} defaultValue={defaults.accountExpiryDays} placeholder="Profile default" className="max-w-48" />
              </FormField>
              <div className="flex items-center gap-2.5">
                <Checkbox id={`${id}-email`} name="requireEmail" defaultChecked={defaults.requireEmail} />
                <label htmlFor={`${id}-email`}>Ask for an email address</label>
              </div>
              <FormField id={`${id}-note`} label="Note for the invitee" help="Shown on the signup page.">
                <Textarea name="noteForInvitee" maxLength={1000} className="min-h-16" placeholder="Hi! Pick a username you&apos;ll remember." />
              </FormField>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <SubmitButton pendingLabel="Creating…">Create invite</SubmitButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
