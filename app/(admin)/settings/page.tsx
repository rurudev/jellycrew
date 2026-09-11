import { requireAdmin } from "@/lib/auth/session";
import { APP_VERSION, env } from "@/lib/env";
import { getJobStatus, LIFECYCLE_INTERVAL_MS, LIFECYCLE_JOB } from "@/lib/services/scheduler";
import { getHealth } from "@/lib/services/system";
import { getSettingOrDefault } from "@/lib/settings";
import { Notice } from "@/components/notice";
import { Timestamp } from "@/components/ui/timestamp";
import { Callout } from "@/components/ui/callout";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { KeyValue } from "@/components/ui/key-value";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { runLifecycleNowAction, saveSettingsAction, testSmtpAction } from "./actions";

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
      <PageHeader title="Settings" />
      <Notice params={params} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Jellyfin server">
          {!health.jellyfin.reachable ? (
            <Callout tone="error" title="Unreachable" className="mb-3">
              {health.jellyfin.error}
            </Callout>
          ) : null}
          {health.jellyfin.reachable && !health.jellyfin.compatible ? (
            <Callout tone="warning" title="Version mismatch" className="mb-3">
              The server runs {health.jellyfin.version}; this app is built and tested against {health.jellyfin.targetVersion}. Policy fields may differ.
            </Callout>
          ) : null}
          <KeyValue>
            <KeyValue.Item label="Name">{health.jellyfin.serverName ?? "—"}</KeyValue.Item>
            <KeyValue.Item label="Version">
              {health.jellyfin.version ?? "—"} <span className="text-muted-foreground">(target {health.jellyfin.targetVersion})</span>
            </KeyValue.Item>
            <KeyValue.Item label="URL">
              <code>{e.JELLYFIN_URL}</code>
            </KeyValue.Item>
            <KeyValue.Item label="App version">{APP_VERSION}</KeyValue.Item>
            <KeyValue.Item label="Database">{health.database.ok ? "ok" : health.database.error}</KeyValue.Item>
            <KeyValue.Item label="Health endpoint">
              <code>/healthz</code> → {health.status}
            </KeyValue.Item>
          </KeyValue>
        </Section>

        <Section title="Scheduler">
          <KeyValue>
            <KeyValue.Item label="Interval">every {LIFECYCLE_INTERVAL_MS / 60000} minutes</KeyValue.Item>
            <KeyValue.Item label="Last started">
              <Timestamp date={job?.lastStartedAt ?? null} />
            </KeyValue.Item>
            <KeyValue.Item label="Last finished">
              <Timestamp date={job?.lastFinishedAt ?? null} />
            </KeyValue.Item>
            <KeyValue.Item label="Running">{job?.lockUntil && job.lockUntil > new Date() ? "yes" : "no"}</KeyValue.Item>
            <KeyValue.Item label="Last result">
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">{job?.lastResult ? JSON.stringify(job.lastResult, null, 2) : "never run"}</pre>
            </KeyValue.Item>
          </KeyValue>
          <form action={runLifecycleNowAction} className="mt-3 space-y-1">
            <SubmitButton variant="outline" pendingLabel="Running…">
              Run lifecycle now
            </SubmitButton>
            <Hint>Disables expired and inactive users and deletes accounts past their grace period. Administrators are never touched.</Hint>
          </form>
        </Section>

        <Section title="App settings">
          <form action={saveSettingsAction} className="space-y-3">
            <FormField id="graceDays" label="Deletion grace period (days)" help={<>Time between &quot;schedule deletion&quot; (disable now) and the actual delete.</>}>
              <Input name="graceDays" type="number" min={0} max={3650} defaultValue={getSettingOrDefault("graceDays")} className="w-40" />
            </FormField>
            <FormField id="minPasswordLength" label="Minimum password length" help="Applies to admin-set passwords, invites and self-service.">
              <Input name="minPasswordLength" type="number" min={1} max={128} defaultValue={getSettingOrDefault("minPasswordLength")} className="w-40" />
            </FormField>
            <FormField
              id="publicBaseUrl"
              label="Public base URL"
              help={
                <>
                  Used in invite and reset links. Blank uses <code>PUBLIC_BASE_URL</code> from the environment ({e.PUBLIC_BASE_URL}).
                </>
              }
            >
              <Input name="publicBaseUrl" type="url" defaultValue={getSettingOrDefault("publicBaseUrl") ?? ""} placeholder={e.PUBLIC_BASE_URL} />
            </FormField>
            <FormField
              id="jellyfinPublicUrl"
              label="Jellyfin URL for users"
              help={
                <>
                  Shown to invitees after signup. Blank uses <code>JELLYFIN_URL</code> ({e.JELLYFIN_URL}), which is usually an internal address.
                </>
              }
            >
              <Input name="jellyfinPublicUrl" type="url" defaultValue={getSettingOrDefault("jellyfinPublicUrl") ?? ""} placeholder={e.JELLYFIN_URL} />
            </FormField>
            <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
          </form>
        </Section>

        <Section title="Email (SMTP)">
          {smtpConfigured ? (
            <div className="space-y-3">
              <KeyValue>
                <KeyValue.Item label="From">{e.SMTP_FROM}</KeyValue.Item>
                <KeyValue.Item label="Last test">{smtpTest ? `${smtpTest.ok ? "ok" : "failed"} · ${smtpTest.message} (${smtpTest.at})` : "never"}</KeyValue.Item>
              </KeyValue>
              <form action={testSmtpAction} className="flex flex-wrap items-end gap-2">
                <FormField id="to" label="Send a test mail to (optional)">
                  <Input name="to" type="email" placeholder="you@example.com" className="w-64" />
                </FormField>
                <SubmitButton variant="outline" pendingLabel="Testing…">
                  Test SMTP
                </SubmitButton>
              </form>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Not configured. Set <code>SMTP_URL</code> and <code>SMTP_FROM</code> to enable verification and reset mail. Admins can always generate reset links by hand.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
