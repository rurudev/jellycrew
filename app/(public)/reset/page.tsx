import Link from "next/link";
import { isMailConfigured } from "@/lib/mail";
import { publicServerName } from "@/lib/public/server-name";
import { GuestMessage } from "@/components/public/guest-message";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Reset password" };
// Reads runtime configuration (SMTP, server name); never prerender at build time.
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const serverName = await publicServerName();
  if (!isMailConfigured()) {
    return (
      <GuestMessage tone="warning" title="Password reset by email is off" body={`This server does not send email, so ${serverName} cannot mail you a link. Ask the administrator to hand you one directly.`}>
        <p>
          <Link href="/me" className="underline">
            Back to my account
          </Link>
        </p>
      </GuestMessage>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Reset your {serverName} password</h1>
        <p className="text-muted-foreground">Tell us your username or email address and we will send a link to the address on your account.</p>
      </div>
      <ResetRequestForm />
      <p className="text-muted-foreground">
        Remembered it?{" "}
        <Link href="/me" className="underline">
          Sign in to your account
        </Link>
        .
      </p>
    </div>
  );
}
