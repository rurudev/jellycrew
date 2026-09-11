import Link from "next/link";
import { isMailConfigured } from "@/lib/mail";
import { getServerStatus } from "@/lib/services/system";
import { Alert } from "@/components/ui/alert";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Reset password" };
// Reads runtime configuration (SMTP, server name); never prerender at build time.
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const server = await getServerStatus();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reset your {server.serverName ?? "Jellyfin"} password</h1>
        <p className="mt-1 text-zinc-500">A reset link is sent to your verified email address.</p>
      </div>
      {isMailConfigured() ? (
        <ResetRequestForm />
      ) : (
        <Alert tone="warning" title="Email is not set up on this server">
          Password reset by email is not available. Contact the administrator, who can hand you a reset link directly.
        </Alert>
      )}
      <p className="text-sm text-zinc-500">
        Know your password?{" "}
        <Link href="/me" className="underline">
          Manage your account
        </Link>
        .
      </p>
    </div>
  );
}
