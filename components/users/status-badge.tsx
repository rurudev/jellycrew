import { Badge } from "@/components/ui/badge";
import { absoluteTime } from "@/lib/format";
import type { UserStatus } from "@/lib/users/status";

export function StatusBadge({ status }: { status: UserStatus }) {
  const title = status.at ? absoluteTime(status.at) : undefined;
  return (
    <Badge tone={status.tone} title={title}>
      {status.label}
    </Badge>
  );
}
