import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type CalloutTone = "info" | "success" | "warning" | "error";

const icons = { info: InfoIcon, success: CircleCheckIcon, warning: TriangleAlertIcon, error: CircleAlertIcon } as const;

/** An inline, persistent notice on a soft tone fill: server unreachable, version mismatch, a preview to confirm. */
export function Callout({ tone = "info", title, children, className }: { tone?: CalloutTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <Alert variant={tone} role={tone === "error" ? "alert" : "status"} className={className}>
      <Icon aria-hidden />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  );
}
