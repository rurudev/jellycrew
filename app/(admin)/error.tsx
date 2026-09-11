"use client";

import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3">
      <Callout tone="error" title="Something went wrong">
        {error.message}
        {error.digest ? <div className="text-xs opacity-70">ref {error.digest}</div> : null}
      </Callout>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
