import { publicInviteInfo } from "@/lib/services/invites";
import { getServerStatus } from "@/lib/services/system";
import { getSettingOrDefault } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import { SignupForm } from "./signup-form";

export const metadata = { title: "You're invited" };

const closed: Record<string, string> = {
  expired: "This invite has expired. Ask the person who invited you for a new link.",
  exhausted: "This invite has already been used. Ask the person who invited you for a new link.",
  revoked: "This invite is no longer valid.",
};

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const info = publicInviteInfo(token);
  const server = await getServerStatus();
  const serverName = server.serverName ?? "Jellyfin";
  if (!info) {
    return <Alert tone="error" title="Invalid invite">This invite link is not valid. Check that you copied the whole link.</Alert>;
  }
  if (info.status !== "active") {
    return <Alert tone="warning" title="Invite closed">{closed[info.status]}</Alert>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Join {serverName}</h1>
        <p className="mt-1 text-zinc-500">Create your Jellyfin account{info.label ? ` (${info.label})` : ""}.</p>
      </div>
      {info.note ? <Alert tone="info">{info.note}</Alert> : null}
      {info.accountExpiryDays ? <p className="text-sm text-zinc-500">Access will be valid for {info.accountExpiryDays} days after signup.</p> : null}
      <SignupForm token={token} requireEmail={info.requireEmail} minPasswordLength={getSettingOrDefault("minPasswordLength")} />
    </div>
  );
}
