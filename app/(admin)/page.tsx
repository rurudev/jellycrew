import { requireAdmin } from "@/lib/auth/session";
import { getHealth } from "@/lib/services/system";
import { Card, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const session = await requireAdmin();
  const health = await getHealth();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardTitle>Server</CardTitle>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
          <dt className="text-zinc-500">Name</dt>
          <dd>{health.jellyfin.serverName ?? "—"}</dd>
          <dt className="text-zinc-500">Version</dt>
          <dd>
            {health.jellyfin.version ?? "—"} {health.jellyfin.compatible ? "" : `(tested against ${health.jellyfin.targetVersion})`}
          </dd>
          <dt className="text-zinc-500">Reachable</dt>
          <dd>{health.jellyfin.reachable ? "yes" : "no"}</dd>
        </dl>
      </Card>
      <Card>
        <CardTitle>This app</CardTitle>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
          <dt className="text-zinc-500">Version</dt>
          <dd>{health.app.version}</dd>
          <dt className="text-zinc-500">Database</dt>
          <dd>{health.database.ok ? "ok" : health.database.error}</dd>
          <dt className="text-zinc-500">Signed in as</dt>
          <dd>{session.userName}</dd>
        </dl>
      </Card>
    </div>
  );
}
