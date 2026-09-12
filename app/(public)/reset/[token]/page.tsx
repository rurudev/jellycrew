import Link from "next/link";
import { resetTokenStatus } from "@/lib/services/reset";
import { getSettingOrDefault } from "@/lib/settings";
import { publicServerName } from "@/lib/public/server-name";
import { GuestMessage } from "@/components/public/guest-message";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

const reasons = {
  invalid: "Check that you copied the whole link, including the part after the last slash.",
  used: "This link has already been used. Request a new one to change your password again.",
  expired: "Reset links last an hour. Request a new one and use it straight away.",
} as const;

export default async function ResetTokenPage(props: PageProps<"/reset/[token]">) {
  const { token } = await props.params;
  const status = resetTokenStatus(token);
  const serverName = await publicServerName();
  if (!status.ok) {
    return (
      <GuestMessage tone="warning" title="This link will not work" body={reasons[status.reason]}>
        <p>
          <Link href="/reset" className="underline">
            Request a new link
          </Link>
        </p>
      </GuestMessage>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-muted-foreground">This replaces your password on {serverName}. Other devices will ask you to sign in again.</p>
      </div>
      <ResetForm token={token} minPasswordLength={getSettingOrDefault("minPasswordLength")} serverName={serverName} />
    </div>
  );
}
