import { cache } from "react";
import { Callout } from "@/components/ui/callout";
import { StatusDot, type StatusTone } from "@/components/ui/status-badge";
import { getServerStatus, type ServerStatus } from "@/lib/services/system";

/**
 * One Jellyfin status probe per request, shared by the header item and the alerts below it.
 * Both render inside their own Suspense so the console shell streams before Jellyfin answers.
 */
const status = cache(() => getServerStatus());

type State = "ok" | "mismatch" | "unreachable";

function stateOf(s: ServerStatus): State {
  return !s.reachable ? "unreachable" : s.compatible ? "ok" : "mismatch";
}

const tones: Record<State, StatusTone> = { ok: "success", mismatch: "warning", unreachable: "destructive" };

/** One sentence that carries the whole state, so the dot is never the only signal. */
function describe(s: ServerStatus, state: State): string {
  const name = s.serverName ?? "Jellyfin";
  const version = s.version ?? "unknown version";
  if (state === "unreachable") return `${name} · unreachable`;
  if (state === "mismatch") return `${name} · ${version}, tested against ${s.targetVersion}`;
  return `${name} · ${version}`;
}

/** The dot is always visible; the text is visually hidden below md but always read out. */
export async function ServerStatusItem() {
  const s = await status();
  const state = stateOf(s);
  return (
    <span className="flex items-center gap-1.5" title={state === "unreachable" ? s.error : undefined}>
      <StatusDot tone={tones[state]} />
      <span className="max-md:sr-only">{describe(s, state)}</span>
    </span>
  );
}

export function ServerStatusFallback() {
  return <StatusDot tone="neutral" className="opacity-40" />;
}

export async function ServerStatusAlerts() {
  const s = await status();
  const state = stateOf(s);
  if (state === "mismatch") {
    return (
      <Callout tone="warning" title="Jellyfin version mismatch">
        This server runs Jellyfin {s.version ?? "an unknown version"}; jellycrew is tested against {s.targetVersion}. Policy fields may differ.
      </Callout>
    );
  }
  if (state === "unreachable") {
    return (
      <Callout tone="error" title="Jellyfin is unreachable">
        {s.error}
      </Callout>
    );
  }
  return null;
}
