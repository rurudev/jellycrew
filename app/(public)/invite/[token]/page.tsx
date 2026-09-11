import { publicInviteInfo } from "@/lib/services/invites";
import { getServerStatus } from "@/lib/services/system";
import { getSettingOrDefault } from "@/lib/settings";
import { Callout } from "@/components/ui/callout";
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
    return <Callout tone="error" title="Invalid invite">This invite link is not valid. Check that you copied the whole link.</Callout>;
  }
  if (info.status !== "active") {
    return <Callout tone="warning" title="Invite closed">{closed[info.status]}</Callout>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Join {serverName}</h1>
        <p className="mt-1 text-muted-foreground">Create your Jellyfin account{info.label ? ` (${info.label})` : ""}.</p>
      </div>
      {info.note ? <Callout tone="info">{info.note}</Callout> : null}
      {info.accountExpiryDays ? <p className="text-sm text-muted-foreground">Access will be valid for {info.accountExpiryDays} days after signup.</p> : null}
      <SignupForm token={token} requireEmail={info.requireEmail} minPasswordLength={getSettingOrDefault("minPasswordLength")} />
    </div>
  );
}
