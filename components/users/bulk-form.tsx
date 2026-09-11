"use client";

import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DiffTable } from "@/components/policy/diff-table";
import { BULK_KINDS, BULK_LABELS } from "@/lib/bulk/kinds";
import type { BulkState } from "@/app/(admin)/users/bulk-actions";

/**
 * Wraps the users table so its row checkboxes belong to this form. Preview first, then a
 * confirm step that resubmits the same selection, then per-user results.
 */
export function BulkForm({
  action,
  profiles,
  children,
}: {
  action: (prev: BulkState, formData: FormData) => Promise<BulkState>;
  profiles: Array<{ id: string; name: string }>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<BulkState, FormData>(action, { stage: "idle" });
  const needsProfile = (k: string | undefined) => k === "apply_profile" || k === "assign_profile";
  return (
    <form action={formAction} className="space-y-3">
      {state.stage === "error" ? <Alert tone="error">{state.error}</Alert> : null}

      {state.stage === "preview" && state.preview ? (
        <Alert tone="info" title={`Preview: ${BULK_LABELS[state.kind!]} for ${state.preview.length} user(s)`}>
          <ul className="space-y-2">
            {state.preview.map((p) => (
              <li key={p.userId} className="border-t border-blue-200 pt-2 first:border-0 first:pt-0 dark:border-blue-900">
                <div className="font-medium">
                  {p.name} {p.skip ? <Badge tone="amber">skip: {p.skip}</Badge> : <span className="text-xs font-normal text-zinc-600 dark:text-zinc-300">{p.summary}</span>}
                </div>
                {p.changes.length ? <DiffTable changes={p.changes} /> : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {state.userIds?.map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}
            <input type="hidden" name="kind" value={state.kind} />
            {state.profileId ? <input type="hidden" name="profileId" value={state.profileId} /> : null}
            <Button type="submit" name="confirm" value="1" disabled={pending || state.preview.every((p) => p.skip)}>
              {pending ? "Running…" : "Execute"}
            </Button>
            <span className="self-center text-xs text-zinc-500">Runs one user at a time; every user gets a result.</span>
          </div>
        </Alert>
      ) : null}

      {state.stage === "done" && state.results ? (
        <Alert tone={state.results.some((r) => !r.ok) ? "warning" : "success"} title={`${BULK_LABELS[state.kind!]}: ${state.results.filter((r) => r.ok).length} ok, ${state.results.filter((r) => !r.ok).length} failed`}>
          <ul className="space-y-1">
            {state.results.map((r) => (
              <li key={r.userId}>
                <Badge tone={r.ok ? (r.message.startsWith("Skipped") ? "neutral" : "green") : "red"}>{r.ok ? "ok" : "failed"}</Badge> {r.name}: {r.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {state.stage !== "preview" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-zinc-500">With selected:</span>
          <Select name="kind" defaultValue={state.kind ?? "assign_profile"} className="w-auto" aria-label="Bulk action">
            {BULK_KINDS.map((k) => (
              <option key={k} value={k}>
                {BULK_LABELS[k]}
              </option>
            ))}
          </Select>
          <Select name="profileId" defaultValue={state.profileId ?? ""} className="w-auto" aria-label="Profile for bulk action">
            <option value="">{needsProfile(state.kind) ? "Choose a profile…" : "Profile (for assign/apply)"}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Working…" : "Preview"}
          </Button>
        </div>
      ) : null}
      {children}
    </form>
  );
}
