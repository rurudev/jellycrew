"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Server actions report results by redirecting with `?ok=` or `?error=` (see lib/notice.ts).
 * This shows that message as a toast and then removes it from the URL, so a reload, a bookmark
 * or the back button never replays it. Mounted once, in the root layout, inside a Suspense.
 */
export function NoticeToast() {
  const params = useSearchParams();
  const ok = params.get("ok");
  const error = params.get("error");
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!ok && !error) return;
    const key = `${ok ?? ""}|${error ?? ""}`;
    if (shown.current === key) return;
    shown.current = key;
    if (ok) toast.success(ok);
    if (error) toast.error(error, { duration: Infinity });
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ok, error]);
  return null;
}
