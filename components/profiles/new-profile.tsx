"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogHost, useOpenDialog } from "@/components/ui/dialog-host";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createProfileAction } from "@/app/(admin)/profiles/actions";
import type { ProfileActionState } from "@/app/(admin)/profiles/state";

export interface NamedRecord {
  id: string;
  name: string;
}

/** Opens the page's one create dialog. */
export function NewProfileButton({ variant }: { variant?: "default" | "outline" }) {
  const open = useOpenDialog();
  return (
    <Button type="button" variant={variant} onClick={open}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      New profile
    </Button>
  );
}

export function NewProfile({ users, profiles, children }: { users: NamedRecord[]; profiles: NamedRecord[]; children: ReactNode }) {
  return (
    <DialogHost param="new" className="sm:max-w-lg" dialog={<NewProfileBody users={users} profiles={profiles} />}>
      {children}
    </DialogHost>
  );
}

function NewProfileBody({ users, profiles }: { users: NamedRecord[]; profiles: NamedRecord[] }) {
  const id = useId();
  const router = useRouter();
  // The new profile is where the work continues, so the dialog hands over to its page.
  const [state, submit] = useActionState<ProfileActionState, FormData>(async (prev, formData) => {
    const result = await createProfileAction(prev, formData);
    if (result.ok && result.href) {
      toast.success(result.ok);
      router.push(result.href);
    }
    return result;
  }, {});
  const [source, setSource] = useState<"blank" | "user" | "clone">("blank");

  return (
    <>
      <DialogHeader>
        <DialogTitle>New profile</DialogTitle>
        <DialogDescription>A profile is a set of library, playback and parental settings you can hand to many accounts at once.</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        {state.error ? <Callout tone="error">{state.error}</Callout> : null}
        <FormField id={`${id}-name`} label="Name">
          <Input name="name" required maxLength={80} placeholder="Family, Housemates…" />
        </FormField>
        <FormField id={`${id}-description`} label="Description" help="For your own list.">
          <Textarea name="description" maxLength={500} className="min-h-16" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${id}-expiry`} label="Default expiry (days)" help="Suggested to invites. Blank means no expiry." controlClassName="max-w-48">
            <Input name="defaultExpiryDays" type="number" min={1} max={3650} placeholder="None" />
          </FormField>
          <FormField id={`${id}-inactivity`} label="Disable after inactivity (days)" help="Members inherit this. Blank means never." controlClassName="max-w-48">
            <Input name="inactivityDisableDays" type="number" min={1} max={3650} placeholder="Never" />
          </FormField>
        </div>
        <FormField id={`${id}-source`} label="Start from">
          <NativeSelect name="source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="blank">Jellyfin&apos;s defaults for a new account</option>
            <option value="user">The current settings of a user</option>
            <option value="clone">Another profile</option>
          </NativeSelect>
        </FormField>
        {source === "user" ? (
          <FormField id={`${id}-user`} label="Copy settings from" help="Only profile-managed fields are copied. The user is not changed.">
            <NativeSelect name="userId" defaultValue="" required>
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : null}
        {source === "clone" ? (
          <FormField id={`${id}-clone`} label="Copy settings from">
            <NativeSelect name="sourceProfileId" defaultValue="" required>
              <option value="">Choose a profile…</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <SubmitButton pendingLabel="Creating…">Create profile</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
