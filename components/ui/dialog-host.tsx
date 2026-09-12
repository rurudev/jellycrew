"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const OpenDialog = createContext<(() => void) | null>(null);

/** Opens the dialog its host owns. Any number of triggers can sit inside one host. */
export function useOpenDialog(): () => void {
  const open = useContext(OpenDialog);
  return open ?? (() => {});
}

/**
 * One dialog for a whole page, with any number of triggers. The body is remounted every time
 * it opens, so a form never reopens holding the last result, and a URL parameter can open it
 * on arrival; closing removes just that parameter.
 */
export function DialogHost({ param, className, dialog, children }: { /** Opens the dialog when this query parameter is `1` on arrival. */ param?: string; className?: string; /** The dialog body. Remounted on each open, so its state starts fresh. */ dialog: ReactNode; children: ReactNode }) {
  const params = useSearchParams();
  // Read once: closing must not be undone by the parameter still sitting in the URL.
  const [open, setOpen] = useState(() => (param ? params.get(param) === "1" : false));
  const [attempt, setAttempt] = useState(0);

  const close = () => {
    setOpen(false);
    setAttempt((n) => n + 1);
    if (!param) return;
    const next = new URLSearchParams(window.location.search);
    if (!next.has(param)) return;
    next.delete(param);
    const query = next.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  };

  return (
    <OpenDialog.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className={className}>
          <DialogBody key={attempt}>{dialog}</DialogBody>
        </DialogContent>
      </Dialog>
    </OpenDialog.Provider>
  );
}

/** Exists only to carry the key that remounts the body. */
function DialogBody({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
