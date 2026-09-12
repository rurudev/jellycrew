"use client";

import { createContext, useActionState, useContext, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { DiffTable } from "@/components/policy/diff-table";
import { BULK_KINDS, BULK_LABELS, BULK_PARAM, type BulkKind } from "@/lib/bulk/kinds";
import type { BulkState } from "@/app/(admin)/users/bulk-actions";

interface Selection {
  ids: string[];
  selected: ReadonlySet<string>;
  toggle: (id: string, on: boolean) => void;
  setAll: (on: boolean) => void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("RowSelect and SelectAll must be rendered inside BulkSelection");
  return ctx;
}

/** The checkbox in a row. The hit area extends past the 16 px box (shadcn's Checkbox). */
export function RowSelect({ id, name }: { id: string; name: string }) {
  const { selected, toggle } = useSelection();
  return <Checkbox checked={selected.has(id)} onCheckedChange={(checked) => toggle(id, checked === true)} aria-label={`Select ${name}`} />;
}

/** The header checkbox: all, none, or mixed. */
export function SelectAll() {
  const { ids, selected, setAll } = useSelection();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  return <Checkbox checked={all} indeterminate={some} onCheckedChange={(checked) => setAll(checked === true)} aria-label="Select all users on this page" disabled={ids.length === 0} />;
}

type Profiles = Array<{ id: string; name: string }>;

/**
 * Wraps the users table: owns the selection, renders it as hidden inputs of one form, shows a
 * bar at the bottom while anything is selected, and opens the preview and the per-user
 * results in a dialog. The server action is the same two-step `bulkAction` as before.
 */
export function BulkSelection({ action, profiles, ids, children }: { action: (prev: BulkState, formData: FormData) => Promise<BulkState>; profiles: Profiles; ids: string[]; children: ReactNode }) {
  const formId = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [state, formAction, pending] = useActionState<BulkState, FormData>(action, { stage: "idle" });
  const [kind, setKind] = useState<BulkKind>("assign_profile");
  const [dismissed, setDismissed] = useState<BulkState | null>(null);
  const param = BULK_PARAM[kind];
  // What the UI shows: a dismissed preview or result behaves like idle again (the action state
  // itself only changes on the next submit).
  const view = state === dismissed ? "idle" : state.stage;
  const dialogOpen = view === "preview" || view === "done";
  // Rows filtered out of view are neither counted nor submitted.
  const visible = ids.filter((id) => selected.has(id));
  const selection: Selection = {
    ids,
    selected,
    toggle: (id, on) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    setAll: (on) => setSelected(on ? new Set(ids) : new Set()),
  };
  const count = visible.length;
  const close = () => {
    setDismissed(state);
    if (state.stage === "done") setSelected(new Set());
  };

  return (
    <SelectionContext value={selection}>
      <form id={formId} action={formAction} className="space-y-3">
        {visible.map((id) => (
          <input key={id} type="hidden" name="userIds" value={id} />
        ))}
        {view === "preview" ? (
          <>
            <input type="hidden" name="kind" value={state.kind} />
            {state.profileId ? <input type="hidden" name="profileId" value={state.profileId} /> : null}
            {state.date ? <input type="hidden" name="date" value={state.date} /> : null}
            {state.days ? <input type="hidden" name="days" value={String(state.days)} /> : null}
            {state.label ? <input type="hidden" name="label" value={state.label} /> : null}
          </>
        ) : null}
        {view === "error" ? <Callout tone="error">{state.error}</Callout> : null}
        {children}
        {count > 0 && view !== "preview" ? (
          <div role="region" aria-label="Bulk actions" className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
            <span className="px-1 text-sm font-medium" aria-live="polite">
              {count} selected
            </span>
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
            {/* Defaults come from the last action state so an error does not wipe what was typed (React resets forms after an action). */}
            {param === "date" ? <Input type="date" name="date" defaultValue={state.date?.slice(0, 10) ?? ""} className="w-auto" aria-label="Expiry date" required /> : null}
            {param === "days" ? <Input type="number" name="days" min={1} defaultValue={state.days ?? 30} className="w-24" aria-label="Days" required /> : null}
            {param === "label" ? <Input name="label" defaultValue={state.label ?? ""} placeholder="label" className="w-40" aria-label="Label" required maxLength={50} /> : null}
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Preview
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        ) : null}
      </form>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-2xl">
          {view === "preview" && state.preview ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {BULK_LABELS[state.kind!]} for {state.preview.length} user{state.preview.length === 1 ? "" : "s"}
                </DialogTitle>
                <DialogDescription>Review what will change. Users run one at a time and every user gets a result.</DialogDescription>
              </DialogHeader>
              <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
                {state.preview.map((p) => (
                  <li key={p.userId} className="border-t pt-3 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {p.name}
                      {p.skip ? <StatusBadge tone="warning">skip: {p.skip}</StatusBadge> : <span className="text-xs font-normal text-muted-foreground">{p.summary}</span>}
                    </div>
                    {p.changes.length ? <DiffTable changes={p.changes} /> : null}
                  </li>
                ))}
              </ul>
              <DialogFooter showCloseButton>
                <Button type="submit" form={formId} name="confirm" value="1" disabled={pending || state.preview.every((p) => p.skip)}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {pending ? "Running…" : "Execute"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
          {view === "done" && state.results ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {BULK_LABELS[state.kind!]}: {state.results.filter((r) => r.status === "applied").length} applied, {state.results.filter((r) => r.status === "skipped").length} skipped, {state.results.filter((r) => r.status === "failed").length} failed
                </DialogTitle>
              </DialogHeader>
              <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                {state.results.map((r) => (
                  <li key={r.userId} className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={r.status === "applied" ? "success" : r.status === "skipped" ? "neutral" : "destructive"}>{r.status}</StatusBadge>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground">{r.message}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <DialogClose render={<Button />}>Done</DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SelectionContext>
  );
}
