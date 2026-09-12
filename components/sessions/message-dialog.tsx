"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessageAction } from "@/app/(admin)/sessions/actions";

/**
 * Sends a line of text to one playing client. It is a dialog because the message is written,
 * not chosen, and a table row is no place to type in. The action reports back as `?ok=` on the
 * same route, which is the signal to close: otherwise it would sit in front of its own toast.
 */
export function MessageDialog({ sessionId, device, returnTo }: { sessionId: string; device: string; returnTo: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const reported = params.has("ok") || params.has("error");
  const [lastReported, setLastReported] = useState(reported);
  if (reported !== lastReported) {
    setLastReported(reported);
    if (reported) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <MessageSquareIcon data-icon="inline-start" aria-hidden />
        Message
      </DialogTrigger>
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
