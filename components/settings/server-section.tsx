import { Callout } from "@/components/ui/callout";
import { KeyValue } from "@/components/ui/key-value";
import { Section } from "@/components/ui/section";
import { StatusDot } from "@/components/ui/status-badge";
import type { HealthReport } from "@/lib/services/system";

/** Who this app is talking to, and whether that is going well. */
export function ServerSection({ health, jellyfinUrl, appVersion, id }: { health: HealthReport; jellyfinUrl: string; appVersion: string; id: string }) {
  const { jellyfin, database, status } = health;
  const tone = !jellyfin.reachable ? "destructive" : !jellyfin.compatible ? "warning" : "success";
  const sentence = !jellyfin.reachable
    ? "jellycrew cannot reach Jellyfin right now."
    : !jellyfin.compatible
      ? `Reachable, but running ${jellyfin.version} while this app is built for ${jellyfin.targetVersion}.`
      : `Reachable and running the version this app is built for.`;
  return (
    <Section id={id} title="Server">
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-1.5">
          <StatusDot tone={tone} />
          <span>{sentence}</span>
        </p>
        {!jellyfin.reachable && jellyfin.error ? <Callout tone="error" title="Last error">{jellyfin.error}</Callout> : null}
        {jellyfin.reachable && !jellyfin.compatible ? <Callout tone="warning">Policy fields may differ from what this app knows, so check a diff before saving one.</Callout> : null}
        <KeyValue>
          <KeyValue.Item label="Name">{jellyfin.serverName ?? "unknown"}</KeyValue.Item>
          <KeyValue.Item label="Jellyfin version">
            {jellyfin.version ?? "unknown"} <span className="text-muted-foreground">(built for {jellyfin.targetVersion})</span>
          </KeyValue.Item>
          <KeyValue.Item label="Address">
            <code className="text-xs">{jellyfinUrl}</code>
          </KeyValue.Item>
          <KeyValue.Item label="App version">{appVersion}</KeyValue.Item>
          <KeyValue.Item label="Database">{database.ok ? "ok" : (database.error ?? "unavailable")}</KeyValue.Item>
          <KeyValue.Item label="Health check">
            <code className="text-xs">/healthz</code> reports {status}
          </KeyValue.Item>
        </KeyValue>
      </div>
    </Section>
  );
}
