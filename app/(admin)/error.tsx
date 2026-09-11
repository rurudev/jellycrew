"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-3">
      <Alert tone="error" title="Something went wrong">
        {error.message}
        {error.digest ? <div className="text-xs opacity-70">ref {error.digest}</div> : null}
      </Alert>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
