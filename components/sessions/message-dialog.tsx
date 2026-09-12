"use client";

import { useId, useState } from "react";
import { MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessageAction } from "@/app/(admin)/sessions/actions";

/**
 * Sends a line of text to one playing client. It is a dialog because the message is written,
 * not chosen, and the table row is no place to type in.
 */
export function MessageDialog({ sessionId, device, returnTo }: { sessionId: string; device: string; returnTo: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquareIcon data-icon="inline-start" aria-hidden />
        Message
      </Button>
      <DialogContent>
        <form action={sendMessageAction} className="grid gap-4">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <DialogHeader>
            <DialogTitle>Message {device}</DialogTitle>
            <DialogDescription>Jellyfin shows this on the client for a few seconds. Not every app displays messages.</DialogDescription>
          </DialogHeader>
          <FormField id={id} label="Message">
            <Input name="text" required maxLength={500} placeholder="Dinner is ready" />
          </FormField>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
