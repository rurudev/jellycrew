import { requireAdmin } from "@/lib/auth/session";
import { APP_VERSION, env } from "@/lib/env";
import { getJobStatus, LIFECYCLE_INTERVAL_MS, LIFECYCLE_JOB } from "@/lib/services/scheduler";
import { getHealth } from "@/lib/services/system";
import { getSettingOrDefault } from "@/lib/settings";
import { AutomationSection } from "@/components/settings/automation-section";
import { ServerSection } from "@/components/settings/server-section";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { KeyValue } from "@/components/ui/key-value";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SectionIndex } from "@/components/ui/section-index";
import { StatusDot } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Timestamp } from "@/components/ui/timestamp";
import { saveSettingsAction, testSmtpAction } from "./actions";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "s-server", title: "Server" },
  { id: "s-automation", title: "Automation" },
  { id: "s-accounts", title: "Accounts" },
  { id: "s-links", title: "Links" },
  { id: "s-email", title: "Email" },
];

export default async function SettingsPage() {
  await requireAdmin();
  const health = await getHealth();
  const job = getJobStatus(LIFECYCLE_JOB);
  const e = env();
  const smtpConfigured = Boolean(e.SMTP_URL);
  const smtpTest = getSettingOrDefault("smtpTestResult");

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="How this app talks to Jellyfin, what the automation does, and the links your users receive." />
      <div className="grid items-start gap-4 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
        <SectionIndex sections={SECTIONS} />
        <div className="min-w-0 space-y-4">
          <ServerSection health={health} jellyfinUrl={e.JELLYFIN_URL} appVersion={APP_VERSION} id="s-server" />

          <AutomationSection job={job} intervalMs={LIFECYCLE_INTERVAL_MS} id="s-automation" />

          <Section id="s-accounts" title="Accounts" description="Rules applied to every account this app creates or retires.">
            <form action={saveSettingsAction} className="space-y-4">
              <FormField id="graceDays" label="Deletion grace period (days)" help="Between scheduling a deletion, which disables the account at once, and the account actually being removed." className="max-w-48">
                <Input name="graceDays" type="number" min={0} max={3650} defaultValue={getSettingOrDefault("graceDays")} />
              </FormField>
              <FormField id="minPasswordLength" label="Minimum password length" help="Applies to passwords you set, invites and self-service resets." className="max-w-48">
                <Input name="minPasswordLength" type="number" min={1} max={128} defaultValue={getSettingOrDefault("minPasswordLength")} />
              </FormField>
              <SubmitButton pendingLabel="Saving…">Save account rules</SubmitButton>
            </form>
          </Section>

          <Section id="s-links" title="Links" description="The addresses that end up in invite and reset links, and in front of your users.">
            <form action={saveSettingsAction} className="space-y-4">
              <FormField id="publicBaseUrl" label="This app's public address" help={`Used to build invite and reset links. Blank uses the environment setting, ${e.PUBLIC_BASE_URL}.`}>
                <Input name="publicBaseUrl" type="url" defaultValue={getSettingOrDefault("publicBaseUrl") ?? ""} placeholder={e.PUBLIC_BASE_URL} className="max-w-md" />
              </FormField>
              <FormField id="jellyfinPublicUrl" label="Jellyfin's address for users" help={`Shown to people after they sign up. Blank uses ${e.JELLYFIN_URL}, which is often an address only this app can reach.`}>
                <Input name="jellyfinPublicUrl" type="url" defaultValue={getSettingOrDefault("jellyfinPublicUrl") ?? ""} placeholder={e.JELLYFIN_URL} className="max-w-md" />
              </FormField>
              <SubmitButton pendingLabel="Saving…">Save links</SubmitButton>
            </form>
          </Section>

          <Section id="s-email" title="Email" description="Email is optional. Without it, you hand out reset links yourself from a user's page.">
            {smtpConfigured ? (
              <div className="space-y-4">
                <p className="flex flex-wrap items-center gap-1.5">
                  <StatusDot tone={smtpTest ? (smtpTest.ok ? "success" : "destructive") : "neutral"} />
                  <span>
                    Sending as <span className="font-medium">{e.SMTP_FROM}</span>.
                  </span>
                  {smtpTest ? (
                    <span className="text-muted-foreground">
                      Last test <Timestamp date={new Date(smtpTest.at)} />: {smtpTest.message}.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Never tested.</span>
                  )}
                </p>
                <form action={testSmtpAction} className="flex flex-wrap items-end gap-2">
                  <FormField id="to" label="Send a test message to" help="Leave blank to only check the connection." className="min-w-64 flex-1">
                    <Input name="to" type="email" placeholder="you@example.com" />
                  </FormField>
                  <SubmitButton variant="outline" pendingLabel="Testing…">
                    Test email
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="flex flex-wrap items-center gap-1.5">
                  <StatusDot tone="neutral" />
                  <span className="text-muted-foreground">No mail server is configured, so nothing is sent.</span>
                </p>
                <KeyValue>
                  <KeyValue.Item label="To turn it on">
                    set <code className="text-xs">SMTP_URL</code> and <code className="text-xs">SMTP_FROM</code> in the environment, then restart
                  </KeyValue.Item>
                  <KeyValue.Item label="Until then">verification and reset mail stay off; reset links are generated by hand</KeyValue.Item>
                </KeyValue>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
