import { cache } from "react";
import { Callout } from "@/components/ui/callout";
import { getServerStatus } from "@/lib/services/system";
import { cn } from "@/lib/utils";

/**
 * One Jellyfin status probe per request, shared by the header item and the alerts below it.
 * Both render inside their own Suspense so the console shell streams before Jellyfin answers.
 */
const status = cache(() => getServerStatus());

/** The dot is always visible; the name and version only from md up. */
export async function ServerStatusItem() {
  const s = await status();
  const name = s.serverName ?? "Jellyfin";
  const tone = !s.reachable ? "bg-destructive" : s.compatible ? "bg-success" : "bg-warning";
  const detail = !s.reachable ? s.error : s.compatible ? `Jellyfin ${s.version}` : `Jellyfin ${s.version}; tested against ${s.targetVersion}`;
  return (
    <span className="flex items-center gap-1.5" title={detail}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone)} />
      <span className="hidden md:inline">
        {name} · {s.reachable ? s.version : "unreachable"}
      </span>
      <span className="sr-only">{s.reachable ? `${name} reachable` : `${name} unreachable`}</span>
    </span>
  );
}

export function ServerStatusFallback() {
  return <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />;
}

export async function ServerStatusAlerts() {
  const s = await status();
  if (s.reachable && !s.compatible) {
    return (
      <Callout tone="warning" title="Jellyfin version mismatch">
        This server runs Jellyfin {s.version}; jellycrew is tested against {s.targetVersion}. Policy fields may differ.
      </Callout>
    );
  }
  if (!s.reachable) {
    return (
      <Callout tone="error" title="Jellyfin is unreachable">
        {s.error}
      </Callout>
    );
  }
  return null;
}
