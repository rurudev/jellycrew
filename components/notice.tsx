import { Callout } from "@/components/ui/callout";

export function Notice({ params }: { params: Record<string, string | string[] | undefined> }) {
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  if (!ok && !error) return null;
  return (
    <div className="space-y-2">
      {ok ? <Callout tone="success">{ok}</Callout> : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
    </div>
  );
}
