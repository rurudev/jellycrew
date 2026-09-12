"use client";

import { createContext, useActionState, useContext, useId, useState, type ReactNode } from "react";
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

const OpenDialog = createContext<(() => void) | null>(null);

/** Opens the one dialog the page owns. Usable from the header and from the empty state. */
export function NewInviteButton({ variant }: { variant?: "default" | "outline" }) {
  const open = useContext(OpenDialog);
  return (
    <Button type="button" variant={variant} onClick={() => open?.()}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      New invite
    </Button>
  );
}

/**
 * Making an invite: the terms of the last one are already filled in, and the finished link is
 * shown here rather than put in the URL. `/invites?new=1` opens it on arrival, which is where
 * the Invite button on the users page leads. One dialog serves every trigger on the page.
 */
export function NewInvite({ profiles, defaults, children }: { profiles: Array<{ id: string; name: string }>; defaults: InviteDefaults; children: ReactNode }) {
  const params = useSearchParams();
  // Read once: closing must not be undone by the parameter still sitting in the URL.
  const [open, setOpen] = useState(() => params.get("new") === "1");
  // A fresh form each time it opens, so the last invite's link is never shown for a new one.
  const [attempt, setAttempt] = useState(0);

  const close = () => {
    setOpen(false);
    setAttempt((n) => n + 1);
    const next = new URLSearchParams(window.location.search);
    if (next.has("new")) {
      next.delete("new");
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
    }
  };

  return (
    <OpenDialog.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          <NewInviteBody key={attempt} profiles={profiles} defaults={defaults} />
        </DialogContent>
      </Dialog>
    </OpenDialog.Provider>
  );
}

function NewInviteBody({ profiles, defaults }: { profiles: Array<{ id: string; name: string }>; defaults: InviteDefaults }) {
  const id = useId();
  const [state, submit] = useActionState(createInviteAction, IDLE);
  // Controlled: React clears an uncontrolled form once its action settles, which would throw
  // away a long note whenever the server comes back with an error.
  const [form, setForm] = useState({
    label: "",
    profileId: defaults.profileId,
    linkExpiryDays: String(defaults.linkExpiryDays),
    maxUses: String(defaults.maxUses),
    accountExpiryDays: defaults.accountExpiryDays,
    requireEmail: defaults.requireEmail,
    noteForInvitee: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  if (state.link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invite ready</DialogTitle>
          <DialogDescription>Send this link to the person you are inviting. They pick their own username and password.</DialogDescription>
        </DialogHeader>
        <CopyField value={state.link} label="Copy link" />
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New invite</DialogTitle>
        <DialogDescription>A link that lets someone create their own account with the profile you choose.</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        {state.error ? <Callout tone="error">{state.error}</Callout> : null}
        <FormField id={`${id}-label`} label="Label" help="For your own list. The invitee never sees it.">
          <Input name="label" maxLength={100} placeholder="Family, friends of Alex…" value={form.label} onChange={(e) => set({ label: e.target.value })} />
        </FormField>
        <FormField id={`${id}-profile`} label="Profile" help="Applied as soon as the account exists. If that fails, the account is removed again.">
          <NativeSelect name="profileId" value={form.profileId} onChange={(e) => set({ profileId: e.target.value })}>
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
            <NativeSelect name="linkExpiryDays" value={form.linkExpiryDays} onChange={(e) => set({ linkExpiryDays: e.target.value })}>
              {defaults.linkExpiryChoices.map((days) => (
                <option key={days} value={days}>
                  {expiryLabel(days)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id={`${id}-uses`} label="Can be used by">
            <NativeSelect name="maxUses" value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })}>
              {defaults.usesChoices.map((uses) => (
                <option key={uses} value={uses}>
                  {usesLabel(uses)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <FormField id={`${id}-account`} label="Accounts expire after (days)" help="Leave blank to follow the profile.">
          <Input
            name="accountExpiryDays"
            type="number"
            min={0}
            max={3650}
            placeholder="Profile default"
            className="max-w-48"
            value={form.accountExpiryDays}
            onChange={(e) => set({ accountExpiryDays: e.target.value })}
          />
        </FormField>
        <div className="flex items-center gap-2.5">
          <Checkbox id={`${id}-email`} name="requireEmail" checked={form.requireEmail} onCheckedChange={(checked) => set({ requireEmail: checked === true })} />
          <label htmlFor={`${id}-email`}>Ask for an email address</label>
        </div>
        <FormField id={`${id}-note`} label="Note for the invitee" help="Shown on the signup page.">
          <Textarea name="noteForInvitee" maxLength={1000} className="min-h-16" placeholder="Hi! Pick a username you&apos;ll remember." value={form.noteForInvitee} onChange={(e) => set({ noteForInvitee: e.target.value })} />
        </FormField>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <SubmitButton pendingLabel="Creating…">Create invite</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
