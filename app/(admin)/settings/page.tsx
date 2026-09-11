import { requireAdmin } from "@/lib/auth/session";
import { APP_VERSION, env } from "@/lib/env";
import { getJobStatus, LIFECYCLE_INTERVAL_MS, LIFECYCLE_JOB } from "@/lib/services/scheduler";
import { getHealth } from "@/lib/services/system";
import { getSettingOrDefault } from "@/lib/settings";
import { Notice } from "@/components/notice";
import { Time } from "@/components/time";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
import { runLifecycleNowAction, saveSettingsAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage(props: PageProps<"/settings">) {
  await requireAdmin();
  const params = await props.searchParams;
  const health = await getHealth();
  const job = getJobStatus(LIFECYCLE_JOB);
  const e = env();
  const smtpConfigured = !!e.SMTP_URL;
  const smtpTest = getSettingOrDefault("smtpTestResult");
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <Notice params={params} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Jellyfin server</CardTitle>
          {!health.jellyfin.reachable ? <Alert tone="error" title="Unreachable">{health.jellyfin.error}</Alert> : null}
          {health.jellyfin.reachable && !health.jellyfin.compatible ? (
            <Alert tone="warning" title="Version mismatch" className="mb-2">
              The server runs {health.jellyfin.version}; this app is built and tested against {health.jellyfin.targetVersion}. Policy fields may differ.
            </Alert>
          ) : null}
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
            <dt className="text-zinc-500">Name</dt>
            <dd>{health.jellyfin.serverName ?? "—"}</dd>
            <dt className="text-zinc-500">Version</dt>
            <dd>
              {health.jellyfin.version ?? "—"} <span className="text-zinc-400">(target {health.jellyfin.targetVersion})</span>
            </dd>
            <dt className="text-zinc-500">URL</dt>
            <dd>
              <code>{e.JELLYFIN_URL}</code>
            </dd>
            <dt className="text-zinc-500">App version</dt>
            <dd>{APP_VERSION}</dd>
            <dt className="text-zinc-500">Database</dt>
            <dd>{health.database.ok ? "ok" : health.database.error}</dd>
            <dt className="text-zinc-500">Health endpoint</dt>
            <dd>
              <code>/healthz</code> → {health.status}
            </dd>
          </dl>
        </Card>

        <Card>
          <CardTitle>Scheduler</CardTitle>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
            <dt className="text-zinc-500">Interval</dt>
            <dd>every {LIFECYCLE_INTERVAL_MS / 60000} minutes</dd>
            <dt className="text-zinc-500">Last started</dt>
            <dd>
              <Time date={job?.lastStartedAt ?? null} />
            </dd>
            <dt className="text-zinc-500">Last finished</dt>
            <dd>
              <Time date={job?.lastFinishedAt ?? null} />
            </dd>
            <dt className="text-zinc-500">Running</dt>
            <dd>{job?.lockUntil && job.lockUntil > new Date() ? "yes" : "no"}</dd>
            <dt className="text-zinc-500">Last result</dt>
            <dd>
              <pre className="max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{job?.lastResult ? JSON.stringify(job.lastResult, null, 2) : "never run"}</pre>
            </dd>
          </dl>
          <form action={runLifecycleNowAction} className="mt-3">
            <Button type="submit" variant="secondary">
              Run lifecycle now
            </Button>
            <Help>Disables expired and inactive users and deletes accounts past their grace period. Administrators are never touched.</Help>
          </form>
        </Card>

        <Card>
          <CardTitle>App settings</CardTitle>
          <form action={saveSettingsAction} className="space-y-3">
            <div>
              <Label htmlFor="graceDays">Deletion grace period (days)</Label>
              <Input id="graceDays" name="graceDays" type="number" min={0} max={3650} defaultValue={getSettingOrDefault("graceDays")} className="w-40" />
              <Help>Time between &quot;schedule deletion&quot; (disable now) and the actual delete.</Help>
            </div>
            <div>
              <Label htmlFor="minPasswordLength">Minimum password length</Label>
              <Input id="minPasswordLength" name="minPasswordLength" type="number" min={1} max={128} defaultValue={getSettingOrDefault("minPasswordLength")} className="w-40" />
              <Help>Applies to admin-set passwords, invites and self-service.</Help>
            </div>
            <div>
              <Label htmlFor="publicBaseUrl">Public base URL</Label>
              <Input id="publicBaseUrl" name="publicBaseUrl" type="url" defaultValue={getSettingOrDefault("publicBaseUrl") ?? ""} placeholder={e.PUBLIC_BASE_URL} />
              <Help>
                Used in invite and reset links. Blank uses <code>PUBLIC_BASE_URL</code> from the environment ({e.PUBLIC_BASE_URL}).
              </Help>
            </div>
            <Button type="submit">Save settings</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Email (SMTP)</CardTitle>
          {smtpConfigured ? (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1">
              <dt className="text-zinc-500">From</dt>
              <dd>{e.SMTP_FROM}</dd>
              <dt className="text-zinc-500">Last test</dt>
              <dd>{smtpTest ? `${smtpTest.ok ? "ok" : "failed"} · ${smtpTest.message} (${smtpTest.at})` : "never"}</dd>
            </dl>
          ) : (
            <p className="text-zinc-500">
              Not configured. Set <code>SMTP_URL</code> and <code>SMTP_FROM</code> to enable verification and reset mail. Admins can always generate reset links by hand.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
