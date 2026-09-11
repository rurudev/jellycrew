"use client";

import { useActionState, useId, useState, startTransition, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClockIcon, CopyIcon, KeyRoundIcon, LinkIcon, MailCheckIcon, MailIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, UserCheckIcon, UserXIcon, type LucideIcon } from "lucide-react";
import { DiffTable } from "@/components/policy/diff-table";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyField } from "@/components/ui/copy-field";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { copyPolicyAction, renameUserAction, setEnabledAction, setPasswordAction } from "@/app/(admin)/users/[id]/actions";
import { deleteNowAction, scheduleDeletionAction } from "@/app/(admin)/users/[id]/lifecycle-actions";
import { createResetLinkAction, emailResetLinkAction, sendVerificationAction } from "@/app/(admin)/users/[id]/reset-actions";
import { IDLE, type ActionState } from "@/app/(admin)/users/[id]/state";

type StateAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type DialogId = "rename" | "password" | "resetLink" | "emailReset" | "verify" | "copy" | "disable" | "schedule" | "delete";

export interface UserActionsUser {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  email: string | null;
  emailVerified: boolean;
  deletionScheduled: boolean;
}

/** One menu item: an icon, a label, and the reason beside it when the action is unavailable. */
function ActionItem({ icon: Icon, label, hint, disabled, variant, onClick }: { icon: LucideIcon; label: string; hint?: string; disabled?: boolean; variant?: "default" | "destructive"; onClick: () => void }) {
  return (
    <DropdownMenuItem disabled={disabled} variant={variant} onClick={onClick} className="items-start">
      <Icon aria-hidden className="mt-0.5" />
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {disabled && hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </DropdownMenuItem>
  );
}

function ActionDialog({ open, onOpenChange, title, description, className, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Runs a state action, toasts its message and closes the dialog on success. */
function useDialogAction(action: StateAction, onDone: () => void): [ActionState, (formData: FormData) => void] {
  const [state, dispatch] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok && !result.link) {
      toast.success(result.ok);
      onDone();
    }
    return result;
  }, IDLE);
  return [state, dispatch];
}

function ErrorNote({ state }: { state: ActionState }) {
  return state.error ? <Callout tone="error">{state.error}</Callout> : null;
}

function Cancel({ children = "Cancel" }: { children?: ReactNode }) {
  return <DialogClose render={<Button type="button" variant="outline" />}>{children}</DialogClose>;
}

function RenameDialog({ user, open, onOpenChange }: { user: UserActionsUser; open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  // Controlled: React clears an uncontrolled form once its action settles, which would wipe
  // what was typed whenever the action comes back with an error.
  const [name, setName] = useState(user.name);
  const [state, submit] = useDialogAction(renameUserAction, () => onOpenChange(false));
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title={`Rename ${user.name}`} description="Jellyfin validates the name; a name already in use is rejected.">
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="userId" value={user.id} />
        <ErrorNote state={state} />
        <FormField id={id} label="Name">
          <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="off" />
        </FormField>
        <DialogFooter>
          <Cancel />
          <SubmitButton pendingLabel="Renaming…">Rename</SubmitButton>
        </DialogFooter>
      </form>
    </ActionDialog>
  );
}

function PasswordDialog({ user, open, onOpenChange }: { user: UserActionsUser; open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, submit] = useDialogAction(setPasswordAction, () => onOpenChange(false));
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title={`Set a password for ${user.name}`} description="Sets the password directly; the current one is not needed and the user is not notified.">
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="userId" value={user.id} />
        {/* Password managers need the account name to save the entry against. */}
        <input type="text" name="username" value={user.name} readOnly tabIndex={-1} aria-hidden autoComplete="username" className="sr-only" />
        <ErrorNote state={state} />
        <FormField id={id} label="New password">
          <Input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </FormField>
        <FormField id={`${id}-confirm`} label="Repeat password" error={confirm && password !== confirm ? "The two passwords do not match." : undefined}>
          <Input name="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </FormField>
        <DialogFooter>
          <Cancel />
          <SubmitButton pendingLabel="Saving…" disabled={password === "" || password !== confirm}>
            Set password
          </SubmitButton>
        </DialogFooter>
      </form>
    </ActionDialog>
  );
}

function ResetLinkDialog({ user, open, onOpenChange }: { user: UserActionsUser; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, submit] = useDialogAction(createResetLinkAction, () => onOpenChange(false));
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title={`Reset link for ${user.name}`} description="A single-use link, valid for 60 minutes. Nothing is emailed: you hand it over yourself.">
      {state.link ? (
        <div className="grid gap-4">
          <CopyField value={state.link} label="Copy link" />
          <Callout tone="warning">This is the only time the link is shown. Closing this dialog discards it.</Callout>
          <DialogFooter>
            <Cancel>Done</Cancel>
          </DialogFooter>
        </div>
      ) : (
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="userId" value={user.id} />
          <ErrorNote state={state} />
          <DialogFooter>
            <Cancel />
            <SubmitButton pendingLabel="Generating…">Generate link</SubmitButton>
          </DialogFooter>
        </form>
      )}
    </ActionDialog>
  );
}

/** A dialog whose whole body is one confirmation of a state action. */
function ConfirmActionDialog({
  user,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  hidden,
  variant = "default",
}: {
  user: UserActionsUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action: StateAction;
  hidden?: Record<string, string>;
  variant?: "default" | "destructive";
}) {
  const [state, submit] = useDialogAction(action, () => onOpenChange(false));
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="userId" value={user.id} />
        {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
        <ErrorNote state={state} />
        <DialogFooter>
          <Cancel />
          <SubmitButton variant={variant} pendingLabel={pendingLabel}>
            {confirmLabel}
          </SubmitButton>
        </DialogFooter>
      </form>
    </ActionDialog>
  );
}

function CopyPolicyDialog({ user, users, open, onOpenChange }: { user: UserActionsUser; users: Array<{ id: string; name: string }>; open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const [sourceId, setSourceId] = useState("");
  const [state, submit] = useDialogAction(copyPolicyAction, () => onOpenChange(false));
  const preview = state.preview;
  const sourceName = preview ? (users.find((u) => u.id === preview.sourceId)?.name ?? preview.sourceId) : "";
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-xl"
      title={`Copy a policy to ${user.name}`}
      description="Copies profile-managed fields only. Administrator, device and login settings stay as they are."
    >
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="userId" value={user.id} />
        <ErrorNote state={state} />
        {preview ? (
          <>
            <input type="hidden" name="sourceId" value={preview.sourceId} />
            <input type="hidden" name="confirm" value="1" />
            <div className="grid gap-2">
              <p>
                Copying from <span className="font-medium">{sourceName}</span>:
              </p>
              <div className="max-h-72 overflow-auto rounded-lg border p-2">
                <DiffTable changes={preview.changes} beforeLabel="Now" afterLabel="After copy" empty="Nothing to copy: the managed fields already match." />
              </div>
            </div>
            <DialogFooter>
              <Cancel>{preview.changes.length ? "Cancel" : "Close"}</Cancel>
              {preview.changes.length ? (
                <SubmitButton pendingLabel="Copying…">
                  Copy {preview.changes.length} {preview.changes.length === 1 ? "field" : "fields"}
                </SubmitButton>
              ) : null}
            </DialogFooter>
          </>
        ) : (
          <>
            <FormField id={id} label="Copy from">
              <NativeSelect name="sourceId" value={sourceId} onChange={(e) => setSourceId(e.target.value)} required className="w-full">
                <option value="">Choose a user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <DialogFooter>
              <Cancel />
              <SubmitButton variant="outline" pendingLabel="Comparing…">
                Preview changes
              </SubmitButton>
            </DialogFooter>
          </>
        )}
      </form>
    </ActionDialog>
  );
}

/**
 * Every secondary action for one user: a menu in the page header, each item opening its own
 * dialog. Nothing destructive and no secret is rendered until it is asked for.
 */
export function UserActions({ user, users, mailConfigured, isSelf, graceDays }: { user: UserActionsUser; users: Array<{ id: string; name: string }>; mailConfigured: boolean; isSelf: boolean; graceDays: number }) {
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [opened, setOpened] = useState(0);
  const params = useSearchParams();
  // The typed-phrase dialogs post plain forms, so their result arrives as ?ok=/?error= on this
  // route. Close whatever is open when it does, or it would sit in front of the toast.
  const reported = params.has("ok") || params.has("error");
  const [lastReported, setLastReported] = useState(reported);
  if (reported !== lastReported) {
    setLastReported(reported);
    if (reported) setDialog(null);
  }
  const openDialog = (id: DialogId) => {
    setOpened((n) => n + 1);
    setDialog(id);
  };
  const close = (next: boolean) => {
    if (!next) setDialog(null);
  };
  const [, setEnabled] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await setEnabledAction(prev, formData);
    if (result.ok) toast.success(result.ok);
    if (result.error) toast.error(result.error);
    return result;
  }, IDLE);
  const enable = () => {
    const formData = new FormData();
    formData.set("userId", user.id);
    formData.set("enabled", "1");
    startTransition(() => setEnabled(formData));
  };
  const emailHint = !user.email ? "No email address on file." : !mailConfigured ? "SMTP is not configured." : undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <MoreHorizontalIcon data-icon="inline-start" aria-hidden />
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <ActionItem icon={PencilIcon} label="Rename…" onClick={() => openDialog("rename")} />
          <ActionItem icon={KeyRoundIcon} label="Set password…" onClick={() => openDialog("password")} />
          <DropdownMenuSeparator />
          <ActionItem icon={LinkIcon} label="Generate reset link…" onClick={() => openDialog("resetLink")} />
          <ActionItem icon={MailIcon} label="Email reset link…" disabled={Boolean(emailHint)} hint={emailHint} onClick={() => openDialog("emailReset")} />
          {user.email && !user.emailVerified ? (
            <ActionItem icon={MailCheckIcon} label="Send verification email…" disabled={!mailConfigured} hint="SMTP is not configured." onClick={() => openDialog("verify")} />
          ) : null}
          <DropdownMenuSeparator />
          <ActionItem icon={CopyIcon} label="Copy policy from…" onClick={() => openDialog("copy")} />
          <DropdownMenuSeparator />
          {user.isDisabled ? (
            <ActionItem
              icon={UserCheckIcon}
              label="Enable"
              disabled={user.deletionScheduled}
              hint="Cancel the scheduled deletion to re-enable this account."
              onClick={enable}
            />
          ) : (
            <ActionItem icon={UserXIcon} label="Disable…" disabled={isSelf} hint="You cannot disable your own account." onClick={() => openDialog("disable")} />
          )}
          {user.deletionScheduled ? null : (
            <ActionItem
              icon={CalendarClockIcon}
              label="Schedule deletion…"
              variant="destructive"
              disabled={isSelf || user.isAdmin}
              hint={isSelf ? "You cannot delete your own account." : "Administrators cannot be scheduled for deletion."}
              onClick={() => openDialog("schedule")}
            />
          )}
          <ActionItem icon={Trash2Icon} label="Delete now…" variant="destructive" disabled={isSelf} hint="You cannot delete your own account." onClick={() => openDialog("delete")} />
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog key={`rename-${opened}`} user={user} open={dialog === "rename"} onOpenChange={close} />
      <PasswordDialog key={`password-${opened}`} user={user} open={dialog === "password"} onOpenChange={close} />
      <ResetLinkDialog key={`reset-${opened}`} user={user} open={dialog === "resetLink"} onOpenChange={close} />
      <CopyPolicyDialog key={`copy-${opened}`} user={user} users={users} open={dialog === "copy"} onOpenChange={close} />
      <ConfirmActionDialog
        key={`email-${opened}`}
        user={user}
        open={dialog === "emailReset"}
        onOpenChange={close}
        title="Email a reset link?"
        description={`Sends a single-use link, valid for 60 minutes, to ${user.email ?? "the address on file"}.`}
        confirmLabel="Send email"
        pendingLabel="Sending…"
        action={emailResetLinkAction}
      />
      <ConfirmActionDialog
        key={`verify-${opened}`}
        user={user}
        open={dialog === "verify"}
        onOpenChange={close}
        title="Send a verification email?"
        description={`Asks ${user.name} to confirm ${user.email ?? "their address"}. Password resets by email work only once it is verified.`}
        confirmLabel="Send email"
        pendingLabel="Sending…"
        action={sendVerificationAction}
      />
      <ConfirmActionDialog
        key={`disable-${opened}`}
        user={user}
        open={dialog === "disable"}
        onOpenChange={close}
        title={`Disable ${user.name}?`}
        description="Ends their active sessions and blocks sign-in until the account is enabled again. Nothing is deleted."
        confirmLabel="Disable"
        pendingLabel="Disabling…"
        action={setEnabledAction}
        hidden={{ enabled: "0" }}
        variant="destructive"
      />
      <ConfirmDialog
        key={`schedule-${opened}`}
        open={dialog === "schedule"}
        onOpenChange={close}
        label="Schedule deletion"
        title={`Schedule deletion of ${user.name}?`}
        description={`Disables the account now and deletes it after the ${graceDays}-day grace period. You can cancel until then.`}
        phrase={user.name}
        action={scheduleDeletionAction}
        hidden={{ userId: user.id }}
      />
      <ConfirmDialog
        key={`delete-${opened}`}
        open={dialog === "delete"}
        onOpenChange={close}
        label="Delete now"
        title={`Delete ${user.name} permanently?`}
        description="Immediately and permanently deletes the Jellyfin account, its watch history and app metadata. There is no grace period. Audit history is kept."
        phrase={`delete ${user.name}`}
        action={deleteNowAction}
        hidden={{ userId: user.id }}
      />
    </>
  );
}
