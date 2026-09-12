"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusDot } from "@/components/ui/status-badge";

/** Re-renders the current server component tree every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (!timer) timer = setInterval(() => router.refresh(), seconds * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        setPaused(true);
      } else {
        setPaused(false);
        router.refresh();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="off">
      <StatusDot tone={paused ? "neutral" : "success"} />
      {paused ? "Paused while the tab is hidden" : `Refreshing every ${seconds} seconds`}
    </span>
  );
}
