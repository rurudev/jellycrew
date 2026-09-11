"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Server actions report results by redirecting with `?ok=` or `?error=` (see lib/notice.ts).
 * This shows that message as a toast and then removes it from the URL, so a reload, a bookmark
 * or the back button never replays it. Mounted once per surface that emits notices, inside a
 * Suspense boundary.
 */
export function NoticeToast() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const error = params.get("error");
  // Guards the double effect run of development Strict Mode; reset once the URL is clean so the
  // same message can toast again on the next redirect.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!ok && !error) {
      shown.current = null;
      return;
    }
    const key = `${ok ?? ""}|${error ?? ""}`;
    if (shown.current === key) return;
    shown.current = key;
    if (ok) toast.success(ok);
    if (error) toast.error(error, { duration: Infinity });
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    url.searchParams.delete("error");
    // The plain form Next integrates with its router; passing Next's own state object would be ignored.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ok, error]);
  return null;
}
