import { getSelfSession } from "@/lib/auth/session";
import { getSelfOverview } from "@/lib/services/self";
import { getSettingOrDefault } from "@/lib/settings";
import { Timestamp } from "@/components/ui/timestamp";
import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { KeyValue } from "@/components/ui/key-value";
import { PasswordField } from "@/components/ui/password-field";
import { Section } from "@/components/ui/section";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { changePasswordAction, logoutSelfAction, resendVerificationAction, revokeOwnDeviceAction, setEmailAction } from "./actions";
import { SelfLoginForm } from "./login-form";

export const metadata = { title: "My account" };

const reasonText = {
  expired: "Your access ran out.",
  inactive: "It was disabled after a long time without use.",
  manual: "An administrator disabled it.",
} as const;

export default async function MePage() {
  const session = await getSelfSession();
  const overview = session ? await getSelfOverview(session.userId) : null;

  if (!session || !overview) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="text-muted-foreground">Sign in with the username and password you use for Jellyfin to change your password, add an email address or sign a device out.</p>
        </div>
        <SelfLoginForm />
      </div>
    );
  }

  const minPasswordLength = getSettingOrDefault("minPasswordLength");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Hello, {overview.userName}</h1>
          <p className="text-muted-foreground">Your account on {overview.serverName}.</p>
        </div>
        <form action={logoutSelfAction}>
          <SubmitButton variant="outline" pendingLabel="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      </div>

      {overview.isDisabled ? (
        <Callout tone="error" title="This account is disabled">
          {overview.disabledReason ? `${reasonText[overview.disabledReason]} ` : ""}Ask whoever runs the server to turn it back on.
        </Callout>
      ) : null}

      <Section title="Your access">
        <KeyValue>
          <KeyValue.Item label="Server">{overview.serverName}</KeyValue.Item>
          <KeyValue.Item label="Settings from">{overview.profileName ?? <span className="text-muted-foreground">no profile</span>}</KeyValue.Item>
          <KeyValue.Item label="Runs until">{overview.expiresAt ? <Timestamp date={overview.expiresAt} absolute /> : <span className="text-muted-foreground">no end date</span>}</KeyValue.Item>
        </KeyValue>
      </Section>

      <Section title="Password" description={`At least ${minPasswordLength} characters. Your current password is checked first.`}>
        <form action={changePasswordAction} className="space-y-4">
          <FormField id="currentPassword" label="Current password">
            <PasswordField name="currentPassword" size="lg" required autoComplete="current-password" />
          </FormField>
          <FormField id="newPassword" label="New password">
            <PasswordField name="newPassword" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
          </FormField>
          <FormField id="confirmPassword" label="Repeat new password">
            <PasswordField name="confirmPassword" size="lg" required minLength={minPasswordLength} autoComplete="new-password" />
          </FormField>
          <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Changing…">
            Change password
          </SubmitButton>
        </form>
      </Section>

      <Section title="Email" description="An address is only used to send you a password reset link, and only once you have confirmed it.">
        <div className="space-y-4">
          <p className="flex flex-wrap items-center gap-2">
            {overview.email ? (
              <>
                <span className="font-medium">{overview.email}</span>
                {overview.emailVerified ? <StatusBadge tone="success">confirmed</StatusBadge> : <StatusBadge tone="warning">not confirmed yet</StatusBadge>}
              </>
            ) : (
              <span className="text-muted-foreground">No address yet.</span>
            )}
          </p>
          {overview.mailConfigured ? (
            <>
              <form action={setEmailAction} className="space-y-4">
                <FormField id="email" label={overview.email ? "Change your address" : "Add an address"} help="We send a link there; the address counts once you open it.">
                  <Input name="email" size="lg" type="email" required autoComplete="email" />
                </FormField>
                <SubmitButton variant="outline" size="lg" className="w-full sm:w-auto" pendingLabel="Sending…">
                  Send the link
                </SubmitButton>
              </form>
              {overview.email && !overview.emailVerified ? (
                <form action={resendVerificationAction}>
                  <SubmitButton variant="ghost" pendingLabel="Sending…">
                    Send the link again
                  </SubmitButton>
                </form>
              ) : null}
            </>
          ) : (
            <Hint>This server does not send email, so an address cannot be confirmed here. Ask whoever runs it if you need a password reset.</Hint>
          )}
        </div>
      </Section>

      <Section title="Where you are signed in" description="Sign a device out if you no longer use it, or if you do not recognise it.">
        <div className="space-y-4">
          <Table variant="plain">
            <TableHeader>
              <TableRow>
                <TableHead>Playing now</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.sessions.length === 0 ? <EmptyState.Row colSpan={3} title="Nothing is playing" description="This shows what is open right now." /> : null}
              {overview.sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.nowPlaying ? s.nowPlaying.title : <span className="text-muted-foreground">nothing</span>}</TableCell>
                  <TableCell>
                    {s.client ?? "—"}
                    {s.deviceName ? <div className="text-xs text-muted-foreground">{s.deviceName}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Timestamp date={s.lastActivity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table variant="plain">
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.devices.length === 0 ? <EmptyState.Row colSpan={4} title="No devices yet" description="A device appears here the first time you sign in on it." /> : null}
              {overview.devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-48">
                    <div className="truncate">{d.name || <span className="text-muted-foreground">unnamed</span>}</div>
                  </TableCell>
                  <TableCell>
                    {d.appName ?? "—"}
                    {d.appVersion ? <span className="text-muted-foreground"> {d.appVersion}</span> : null}
                  </TableCell>
                  <TableCell>
                    <Timestamp date={d.lastActivity} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmDialog
                      label="Sign out"
                      size="sm"
                      variant="outline"
                      title={`Sign ${d.name || "this device"} out?`}
                      description="It will ask for your password the next time you use it. Nothing else changes."
                      confirmLabel="Sign it out"
                      action={revokeOwnDeviceAction}
                      hidden={{ deviceId: d.id }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  );
}
