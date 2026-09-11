"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Two toggles for the access section: show every field instead of only the notable ones, and
 * show the raw field names. Both lists are server-rendered; this only switches visibility.
 * `data-keys` is read by `PolicyRow`'s CSS (`[[data-keys=off]_&]:hidden`).
 */
export function AccessToggles({ summary, full, total }: { summary: ReactNode; full: ReactNode; total: number }) {
  const [showAll, setShowAll] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  return (
    <div data-keys={showKeys ? "on" : "off"} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show notable fields only" : `Show all ${total} fields`}
        </Button>
        <Button type="button" variant="ghost" size="sm" aria-pressed={showKeys} onClick={() => setShowKeys((v) => !v)}>
          {showKeys ? "Hide field names" : "Show field names"}
        </Button>
      </div>
      <div hidden={showAll}>{summary}</div>
      <div hidden={!showAll}>{full}</div>
    </div>
  );
}
