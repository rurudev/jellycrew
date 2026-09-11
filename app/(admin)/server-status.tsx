import { cache } from "react";
import { Callout } from "@/components/ui/callout";
import { getServerStatus } from "@/lib/services/system";

/**
 * One Jellyfin status probe per request, shared by the header item and the alerts below it.
 * Both render inside their own Suspense so the console shell streams before Jellyfin answers.
 */
const status = cache(() => getServerStatus());

export async function ServerStatusItem() {
  const s = await status();
  return (
    <span title={s.reachable ? `Jellyfin ${s.version}` : s.error}>
      {s.serverName ?? "Jellyfin"} {s.version ? `· ${s.version}` : "· unreachable"}
    </span>
  );
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
