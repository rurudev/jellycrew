import { StatusBadge } from "@/components/ui/status-badge";
import { absoluteTime } from "@/lib/format";
import type { UserStatus } from "@/lib/users/status";

/** A user's derived status as a badge; the relevant date (expiry, deletion) sits in the tooltip. */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <StatusBadge tone={status.tone} title={status.at ? absoluteTime(status.at) : undefined}>
      {status.label}
    </StatusBadge>
  );
}
