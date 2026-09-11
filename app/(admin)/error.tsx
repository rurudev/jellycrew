"use client";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3">
      <Callout tone="error" title="Something went wrong">
        {error.message}
        {error.digest ? <span className="mt-1 block text-xs text-muted-foreground">ref {error.digest}</span> : null}
      </Callout>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
