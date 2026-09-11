"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

export interface IdOption {
  id: string;
  label: string;
}

/**
 * A list of ids as tickable rows. What is ticked travels as hidden inputs rather than as the
 * checkboxes themselves, so filtering the visible rows can never drop a selection. Ids that
 * are selected but no longer exist on the server stay listed so they can be removed.
 */
export function IdCheckboxes({ name, options, selected, searchFrom = 10, empty = "None available." }: { name: string; options: IdOption[]; selected: string[]; /** Show the search box once there are more options than this. */ searchFrom?: number; empty?: string }) {
  const uid = useId();
  const [chosen, setChosen] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  // Two checkboxes for one id would submit it twice, so an id repeated by the server or by the
  // stored policy is rendered once.
  const unique = new Map<string, IdOption>();
  for (const option of options) if (!unique.has(option.id)) unique.set(option.id, option);
  const rows = [
    ...[...unique.values()].map((o) => ({ ...o, missing: false })),
    ...[...new Set(selected)].filter((id) => !unique.has(id)).map((id) => ({ id, label: id, missing: true })),
  ];
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : rows;
  const toggle = (id: string, on: boolean) => setChosen((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));

  return (
    <div className="space-y-1.5">
      {rows.length > searchFrom ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Inside the editor form: Enter here filters, it does not submit the policy.
            if (e.key === "Enter") e.preventDefault();
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
          placeholder={`Search ${rows.length} entries`}
          aria-label={`Search ${name}`}
          className="max-w-xs"
          type="search"
          data-no-dirty
        />
      ) : null}
      {rows.length === 0 ? <p className="text-muted-foreground">{empty}</p> : null}
      {rows.length > 0 && shown.length === 0 ? <p className="text-muted-foreground">Nothing matches “{query}”.</p> : null}
      <ul className="space-y-1">
        {shown.map((r) => {
          const rowId = `${uid}-${r.id}`;
          return (
            <li key={r.id} className="flex items-center gap-2">
              <Checkbox id={rowId} aria-label={r.label} checked={chosen.includes(r.id)} onCheckedChange={(next) => toggle(r.id, next === true)} />
              <label htmlFor={rowId} className="min-w-0 cursor-pointer">
                {r.missing ? <code className="text-xs">{r.id}</code> : r.label}
              </label>
              {r.missing ? (
                <StatusBadge tone="warning" title="This id no longer exists on the server; untick it to remove it">
                  missing
                </StatusBadge>
              ) : null}
            </li>
          );
        })}
      </ul>
      {chosen.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
