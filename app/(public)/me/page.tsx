import { getSelfSession } from "@/lib/auth/session";
import { getSelfOverview } from "@/lib/services/self";
import { getSettingOrDefault } from "@/lib/settings";
import { Notice } from "@/components/notice";
import { Time } from "@/components/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Help, Label } from "@/components/ui/label";
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
          <p className="mt-1 text-zinc-500">Sign in with your Jellyfin credentials to manage your password, email and devices.</p>
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
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      <Notice params={params} />
      {overview.isDisabled ? <Alert tone="error" title="This account is disabled">{overview.disabledReason ? reasonText[overview.disabledReason] : ""} Contact the administrator.</Alert> : null}
      <Card>
        <CardTitle>Overview</CardTitle>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
          <dt className="text-zinc-500">Server</dt>
          <dd>{overview.serverName}</dd>
          <dt className="text-zinc-500">Profile</dt>
          <dd>{overview.profileName ?? <span className="text-zinc-400">none</span>}</dd>
          <dt className="text-zinc-500">Access until</dt>
          <dd>{overview.expiresAt ? <Time date={overview.expiresAt} /> : "no expiry"}</dd>
        </dl>
      </Card>

      <Card>
        <CardTitle>Password</CardTitle>
        <form action={changePasswordAction} className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Repeat new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={minPasswordLength} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary">
              Change password
            </Button>
            <Help>At least {minPasswordLength} characters. Your current password is checked first.</Help>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Email</CardTitle>
        <p className="mb-2">
          {overview.email ? (
            <>
              <span className="font-medium">{overview.email}</span> {overview.emailVerified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">not verified</Badge>}
            </>
          ) : (
            <span className="text-zinc-500">No email address on file.</span>
          )}
        </p>
        {overview.mailConfigured ? (
          <div className="space-y-3">
            <form action={setEmailAction} className="flex flex-wrap items-end gap-2">
              <div className="min-w-64">
                <Label htmlFor="email">{overview.email ? "Change email address" : "Add email address"}</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <Button type="submit" variant="secondary">
                Send verification link
              </Button>
            </form>
            {overview.email && !overview.emailVerified ? (
              <form action={resendVerificationAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Resend verification email
                </Button>
              </form>
            ) : null}
            <Help>Only a verified address can be used to reset a forgotten password.</Help>
          </div>
        ) : (
          <Help>Email is not set up on this server, so addresses cannot be verified here. Contact the administrator if you need a password reset.</Help>
        )}
      </Card>

      <Card>
        <CardTitle>Active sessions</CardTitle>
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
                <Td>{s.nowPlaying ? s.nowPlaying.title : <span className="text-zinc-400">idle</span>}</Td>
                <Td>
                  <Time date={s.lastActivity} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Devices</CardTitle>
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
                  {d.appName ?? "—"} <span className="text-zinc-400">{d.appVersion}</span>
                </Td>
                <Td>
                  <Time date={d.lastActivity} />
                </Td>
                <Td className="text-right">
                  <form action={revokeOwnDeviceAction}>
                    <input type="hidden" name="deviceId" value={d.id} />
                    <Button type="submit" size="sm" variant="danger">
                      Sign out device
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
