"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DiffTable } from "@/components/policy/diff-table";
import { BULK_KINDS, BULK_LABELS, BULK_PARAM, type BulkKind } from "@/lib/bulk/kinds";
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
  const [kind, setKind] = useState<BulkKind>(state.kind ?? "assign_profile");
  const param = BULK_PARAM[kind];
  return (
    <form action={formAction} className="space-y-3">
      {state.stage === "error" ? <Alert tone="error">{state.error}</Alert> : null}

      {state.stage === "preview" && state.preview ? (
        <Alert tone="info" title={`Preview: ${BULK_LABELS[state.kind!]} for ${state.preview.length} user(s)`}>
          <ul className="space-y-2">
            {state.preview.map((p) => (
              <li key={p.userId} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="font-medium">
                  {p.name} {p.skip ? <Badge tone="amber">skip: {p.skip}</Badge> : <span className="text-xs font-normal text-muted-foreground">{p.summary}</span>}
                </div>
                {p.changes.length ? <DiffTable changes={p.changes} /> : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {state.userIds?.map((id) => <input key={id} type="hidden" name="userIds" value={id} />)}
            <input type="hidden" name="kind" value={state.kind} />
            {state.profileId ? <input type="hidden" name="profileId" value={state.profileId} /> : null}
            {state.date ? <input type="hidden" name="date" value={state.date} /> : null}
            {state.days ? <input type="hidden" name="days" value={String(state.days)} /> : null}
            {state.label ? <input type="hidden" name="label" value={state.label} /> : null}
            <Button type="submit" name="confirm" value="1" disabled={pending || state.preview.every((p) => p.skip)}>
              {pending ? "Running…" : "Execute"}
            </Button>
            <span className="self-center text-xs text-muted-foreground">Runs one user at a time; every user gets a result.</span>
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
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
          <span className="text-muted-foreground">With selected:</span>
          <NativeSelect name="kind" value={kind} onChange={(e) => setKind(e.target.value as BulkKind)} aria-label="Bulk action">
            {BULK_KINDS.map((k) => (
              <option key={k} value={k}>
                {BULK_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          {param === "profile" ? (
            <NativeSelect name="profileId" defaultValue={state.profileId ?? ""} aria-label="Profile for bulk action">
              <option value="">{kind === "apply_profile" ? "Choose a profile…" : "No profile (unassign)"}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          {param === "date" ? <Input type="date" name="date" defaultValue={state.date?.slice(0, 10) ?? ""} aria-label="Expiry date" className="w-auto" required /> : null}
          {param === "days" ? <Input type="number" name="days" min={1} defaultValue={state.days ?? 30} className="w-24" aria-label="Days" required /> : null}
          {param === "label" ? <Input name="label" defaultValue={state.label ?? ""} placeholder="label" className="w-40" aria-label="Label" required maxLength={50} /> : null}
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Working…" : "Preview"}
          </Button>
        </div>
      ) : null}
      {children}
    </form>
  );
}
