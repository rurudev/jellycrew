import type { Metadata } from "next";
import { publicInviteInfo, type InviteStatus } from "@/lib/services/invites";
import { publicServerName } from "@/lib/public/server-name";
import { getSettingOrDefault } from "@/lib/settings";
import { GuestMessage } from "@/components/public/guest-message";
import { SignupForm } from "./signup-form";

/** A dead link should not promise an invitation in the tab title. */
export async function generateMetadata(props: PageProps<"/invite/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const info = publicInviteInfo(token);
  return { title: info?.status === "active" ? "You're invited" : "Invite" };
}

const closed: Record<Exclude<InviteStatus, "active">, { title: string; body: string }> = {
  expired: { title: "This invite has expired", body: "Ask the person who invited you for a fresh link." },
  exhausted: { title: "This invite has been used", body: "Ask the person who invited you for a fresh link." },
  revoked: { title: "This invite was withdrawn", body: "Ask the person who invited you whether you should still have access." },
};

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const info = publicInviteInfo(token);
  const serverName = await publicServerName();

  if (!info) {
    return <GuestMessage tone="warning" title="This link is not valid" body="Check that you copied the whole link, including the part after the last slash." />;
  }
  if (info.status !== "active") {
    const message = closed[info.status];
    return <GuestMessage tone="warning" title={message.title} body={message.body} />;
  }

  return (
    <SignupForm
      token={token}
      requireEmail={info.requireEmail}
      minPasswordLength={getSettingOrDefault("minPasswordLength")}
      serverName={serverName}
      accountExpiryDays={info.accountExpiryDays ?? null}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">You&apos;re invited to {serverName}</h1>
          <p className="text-muted-foreground">Pick a username and password below, and you can start watching straight away.</p>
        </div>
        {info.note ? <blockquote className="border-l-2 border-primary pl-4 text-muted-foreground">{info.note}</blockquote> : null}
      </div>
    </SignupForm>
  );
}
