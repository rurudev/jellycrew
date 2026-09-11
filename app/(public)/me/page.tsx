import { getSelfSession } from "@/lib/auth/session";
import { getSelfOverview } from "@/lib/services/self";
import { getSettingOrDefault } from "@/lib/settings";
import { Notice } from "@/components/notice";
import { Time } from "@/components/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { KeyValue } from "@/components/ui/key-value";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { changePasswordAction, logoutSelfAction, resendVerificationAction, revokeOwnDeviceAction, setEmailAction } from "./actions";
import { SelfLoginForm } from "./login-form";

export const metadata = { title: "My account" };

const reasonText = { expired: "Your access has expired.", inactive: "Your account was disabled after a period of inactivity.", manual: "Your account was disabled by an administrator." } as const;

export default async function MePage(props: PageProps<"/me">) {
  const params = await props.searchParams;
  const session = await getSelfSession();
  const overview = session ? await getSelfOverview(session.userId) : null;
  if (!session || !overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">My account</h1>
          <p className="mt-1 text-muted-foreground">Sign in with your Jellyfin credentials to manage your password, email and devices.</p>
        </div>
        <SelfLoginForm />
      </div>
    );
  }
  const minPasswordLength = getSettingOrDefault("minPasswordLength");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hi, {overview.userName}</h1>
        <form action={logoutSelfAction}>
          <SubmitButton variant="ghost" size="sm">
            Sign out
          </SubmitButton>
        </form>
      </div>
      <Notice params={params} />
      {overview.isDisabled ? (
        <Alert tone="error" title="This account is disabled">
          {overview.disabledReason ? reasonText[overview.disabledReason] : ""} Contact the administrator.
        </Alert>
      ) : null}
      <Section title="Overview">
        <KeyValue>
          <KeyValue.Item label="Server">{overview.serverName}</KeyValue.Item>
          <KeyValue.Item label="Profile">{overview.profileName ?? <span className="text-muted-foreground">none</span>}</KeyValue.Item>
          <KeyValue.Item label="Access until">{overview.expiresAt ? <Time date={overview.expiresAt} /> : "no expiry"}</KeyValue.Item>
        </KeyValue>
      </Section>

      <Section title="Password">
        <form action={changePasswordAction} className="grid gap-3 sm:grid-cols-3">
          <FormField id="currentPassword" label="Current password">
            <Input name="currentPassword" className="h-11 text-lg" type="password" required autoComplete="current-password" />
          </FormField>
          <FormField id="newPassword" label="New password">
            <Input name="newPassword" className="h-11 text-lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
          </FormField>
          <FormField id="confirmPassword" label="Repeat new password">
            <Input name="confirmPassword" className="h-11 text-lg" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
          </FormField>
          <div className="space-y-1 sm:col-span-3">
            <SubmitButton variant="outline" size="lg" pendingLabel="Changing…">
              Change password
            </SubmitButton>
            <Hint>At least {minPasswordLength} characters. Your current password is checked first.</Hint>
          </div>
        </form>
      </Section>

      <Section title="Email">
        <p className="mb-2">
          {overview.email ? (
            <>
              <span className="font-medium">{overview.email}</span> {overview.emailVerified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">not verified</Badge>}
            </>
          ) : (
            <span className="text-muted-foreground">No email address on file.</span>
          )}
        </p>
        {overview.mailConfigured ? (
          <div className="space-y-3">
            <form action={setEmailAction} className="flex flex-wrap items-end gap-2">
              <FormField id="email" label={overview.email ? "Change email address" : "Add email address"} className="min-w-64">
                <Input name="email" className="h-11 text-lg" type="email" required autoComplete="email" />
              </FormField>
              <SubmitButton variant="outline" size="lg" pendingLabel="Sending…">
                Send verification link
              </SubmitButton>
            </form>
            {overview.email && !overview.emailVerified ? (
              <form action={resendVerificationAction}>
                <SubmitButton variant="ghost" size="sm" pendingLabel="Sending…">
                  Resend verification email
                </SubmitButton>
              </form>
            ) : null}
            <Hint>Only a verified address can be used to reset a forgotten password.</Hint>
          </div>
        ) : (
          <Hint>Email is not set up on this server, so addresses cannot be verified here. Contact the administrator if you need a password reset.</Hint>
        )}
      </Section>

      <Section title="Active sessions">
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Device</Th>
              <Th>Now playing</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {overview.sessions.length === 0 ? <EmptyRow colSpan={4}>No active sessions.</EmptyRow> : null}
            {overview.sessions.map((s) => (
              <tr key={s.id}>
                <Td>{s.client ?? "—"}</Td>
                <Td>{s.deviceName ?? "—"}</Td>
                <Td>{s.nowPlaying ? s.nowPlaying.title : <span className="text-muted-foreground">idle</span>}</Td>
                <Td>
                  <Time date={s.lastActivity} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Devices">
        <Table>
          <thead>
            <tr>
              <Th>Device</Th>
              <Th>App</Th>
              <Th>Last used</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {overview.devices.length === 0 ? <EmptyRow colSpan={4}>No devices.</EmptyRow> : null}
            {overview.devices.map((d) => (
              <tr key={d.id}>
                <Td>{d.name}</Td>
                <Td>
                  {d.appName ?? "—"} <span className="text-muted-foreground">{d.appVersion}</span>
                </Td>
                <Td>
                  <Time date={d.lastActivity} />
                </Td>
                <Td className="text-right">
                  <form action={revokeOwnDeviceAction}>
                    <input type="hidden" name="deviceId" value={d.id} />
                    <SubmitButton size="sm" variant="destructive" pendingLabel="Signing out…">
                      Sign out device
                    </SubmitButton>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
