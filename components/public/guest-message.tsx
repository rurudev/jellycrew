import type { ReactNode } from "react";
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

const icons = { success: CircleCheckIcon, warning: TriangleAlertIcon, error: CircleAlertIcon } as const;
const colors = { success: "text-success", warning: "text-warning", error: "text-destructive" } as const;

/** A whole guest page that is only a message: one icon, one heading, one sentence, one way on. */
export function GuestMessage({ tone, title, body, children }: { tone: "success" | "warning" | "error"; title: string; body: ReactNode; children?: ReactNode }) {
  const Icon = icons[tone];
  return (
    <div className="space-y-4">
      <Icon aria-hidden className={`size-8 ${colors[tone]}`} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}
