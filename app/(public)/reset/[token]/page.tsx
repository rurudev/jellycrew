import Link from "next/link";
import { resetTokenStatus } from "@/lib/services/reset";
import { getSettingOrDefault } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

const reasons = {
  invalid: "This reset link is not valid. Check that you copied the whole link.",
  used: "This reset link has already been used.",
  expired: "This reset link has expired.",
} as const;

export default async function ResetTokenPage(props: PageProps<"/reset/[token]">) {
  const { token } = await props.params;
  const status = resetTokenStatus(token);
  if (!status.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="Link not usable">{reasons[status.reason]}</Alert>
        <p className="text-sm">
          <Link href="/reset" className="underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <ResetForm token={token} minPasswordLength={getSettingOrDefault("minPasswordLength")} />
    </div>
  );
}
