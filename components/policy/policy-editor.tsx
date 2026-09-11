"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Hint } from "@/components/ui/field";
import { DiffTable } from "@/components/policy/diff-table";
import { POLICY_GROUPS, SYNC_PLAY_ACCESS_VALUES, UNRATED_ITEM_VALUES, fieldsInGroup, type PolicyFieldDef, type PolicyScope } from "@/lib/policy/fields";
import { mergeEdit } from "@/lib/policy/merge";
import { idleEditorState, type PolicyEditorState } from "@/lib/policy/editor-state";

export interface EditorRefData {
  folders: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string; appName: string | null }>;
  ratings: Array<{ name: string; value: number | null }>;
}

export type PolicyEditorAction = (prev: PolicyEditorState, formData: FormData) => Promise<PolicyEditorState>;

function IdCheckboxes({ field, value, options }: { field: PolicyFieldDef; value: unknown; options: Array<{ id: string; label: string }> }) {
  const selected = Array.isArray(value) ? value.map(String) : [];
  const known = new Set(options.map((o) => o.id));
  const missing = selected.filter((id) => !known.has(id));
  return (
    <div className="space-y-1">
      {options.length === 0 && missing.length === 0 ? <span className="text-fg-subtle">none available</span> : null}
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2">
          <input type="checkbox" name={field.key} value={o.id} defaultChecked={selected.includes(o.id)} />
          <span>{o.label}</span>
        </label>
      ))}
      {missing.map((id) => (
        <label key={id} className="flex items-center gap-2">
          <input type="checkbox" name={field.key} value={id} defaultChecked />
          <code className="text-xs">{id}</code>
          <Badge tone="amber" title="This id no longer exists on the server; untick to remove it">
            missing
          </Badge>
        </label>
      ))}
    </div>
  );
}

function FieldInput({ field, value, refData }: { field: PolicyFieldDef; value: unknown; refData: EditorRefData }) {
  const id = `f-${field.key}`;
  switch (field.kind) {
    case "boolean":
      return <input id={id} type="checkbox" name={field.key} defaultChecked={value === true} className="h-4 w-4" />;
    case "integer":
      return <Input id={id} type="number" name={field.key} defaultValue={value === null || value === undefined ? "" : String(value)} width="auto" className="w-40" />;
    case "string":
      return <Input id={id} name={field.key} defaultValue={typeof value === "string" ? value : ""} />;
    case "stringList":
    case "channelIds":
      return <Textarea id={id} name={field.key} defaultValue={Array.isArray(value) ? value.join("\n") : ""} placeholder="One per line" className="min-h-16" />;
    case "folderIds":
      return <IdCheckboxes field={field} value={value} options={refData.folders.map((f) => ({ id: f.id, label: f.name }))} />;
    case "deviceIds":
      return <IdCheckboxes field={field} value={value} options={refData.devices.map((d) => ({ id: d.id, label: `${d.name}${d.appName ? ` (${d.appName})` : ""}` }))} />;
    case "rating": {
      const values = [...new Map(refData.ratings.filter((r) => r.value !== null).map((r) => [r.value, r])).values()].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      return (
        <Select id={id} name={field.key} defaultValue={value === null || value === undefined ? "" : String(value)}>
          <option value="">No limit</option>
          {values.map((r) => (
            <option key={r.value} value={String(r.value)}>
              {refData.ratings
                .filter((x) => x.value === r.value)
                .map((x) => x.name)
                .join(" / ")}{" "}
              ({r.value})
            </option>
          ))}
        </Select>
      );
    }
    case "unratedItems": {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {UNRATED_ITEM_VALUES.map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="checkbox" name={field.key} value={v} defaultChecked={selected.includes(v)} /> {v}
            </label>
          ))}
        </div>
      );
    }
    case "syncPlayAccess":
      return (
        <Select id={id} name={field.key} defaultValue={typeof value === "string" ? value : "CreateAndJoinGroups"}>
          {SYNC_PLAY_ACCESS_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      );
    case "schedules":
      return (
        <Textarea
          id={id}
          name={field.key}
          defaultValue={Array.isArray(value) && value.length ? JSON.stringify(value, null, 2) : "[]"}
          className="min-h-20 font-mono text-xs"
          placeholder='[{"DayOfWeek":"Weekend","StartHour":8,"EndHour":20}]'
        />
      );
  }
}

/**
 * Grouped policy editor with a raw JSON fallback. Two-step: Preview shows the diff, Confirm
 * writes. Carries the base policy and its hash for stale-write protection.
 */
export function PolicyEditor({
  action,
  policy,
  hash,
  refData,
  scope,
  hidden,
  cancelHref,
}: {
  action: PolicyEditorAction;
  policy: Record<string, unknown>;
  hash: string;
  refData: EditorRefData;
  /** "all" for users, "profile" for profiles. */
  scope: PolicyScope | "all";
  hidden?: Record<string, string>;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<PolicyEditorState, FormData>(action, idleEditorState);
  const [mode, setMode] = useState<"grouped" | "raw">("grouped");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // After a stale write the live policy becomes the new base; the operator's edit is kept.
  const base = state.status === "stale" && state.live ? state.live : policy;
  const baseHash = state.status === "stale" && state.liveHash ? state.liveHash : state.liveHash ?? hash;
  const current = useMemo(() => (state.edit ? mergeEdit(base, state.edit) : base), [base, state.edit]);
  const formKey = `${baseHash}:${state.status}:${state.changes?.length ?? 0}`;
  const groups = POLICY_GROUPS.filter((g) => fieldsInGroup(g.id).some((f) => scope === "all" || f.scope === scope));

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <input type="hidden" name="baseHash" value={baseHash} />
      <input type="hidden" name="base" value={JSON.stringify(base)} />
      <input type="hidden" name="mode" value={mode} />

      {state.status === "error" ? <Alert tone="error">{state.error}</Alert> : null}
      {state.status === "saved" ? <Alert tone="success">Saved {state.changes?.length ?? 0} change(s).</Alert> : null}
      {state.status === "no_changes" ? <Alert tone="info">No changes to save.</Alert> : null}
      {state.status === "stale" ? (
        <Alert tone="warning" title="The policy changed while you were editing">
          <p>Your edits were not saved. This is what changed on the server in the meantime; the form below now starts from the current policy with your edits reapplied. Review and preview again.</p>
          <div className="mt-2">
            <DiffTable changes={state.changedSince ?? []} beforeLabel="When you opened the editor" afterLabel="Now on the server" empty="Nothing visible changed (a field outside the catalog may have)." />
          </div>
        </Alert>
      ) : null}
      {state.status === "preview" ? (
        <Alert tone="info" title="Review changes before saving">
          <DiffTable changes={state.changes ?? []} />
          <div className="mt-3 flex gap-2">
            <Button type="submit" name="confirm" value="1" disabled={pending}>
              {pending ? "Saving…" : "Confirm and save"}
            </Button>
            <span className="self-center text-xs text-fg-muted">or keep editing below and preview again</span>
          </div>
        </Alert>
      ) : null}

      <div className="flex items-center gap-2 border-b border-edge pb-2 text-sm">
        <button type="button" onClick={() => setMode("grouped")} className={mode === "grouped" ? "font-semibold" : "text-fg-muted"}>
          Grouped editor
        </button>
        <span className="text-edge-strong">|</span>
        <button type="button" onClick={() => setMode("raw")} className={mode === "raw" ? "font-semibold" : "text-fg-muted"}>
          Raw JSON
        </button>
        {mode === "grouped" ? (
          <label className="ml-auto flex items-center gap-1 text-xs text-fg-muted">
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} /> show advanced fields
          </label>
        ) : null}
      </div>

      {mode === "raw" ? (
        <div>
          <Textarea name="raw" defaultValue={JSON.stringify(current, null, 2)} mono className="min-h-96 text-xs" spellCheck={false} />
          <Hint>Keys you omit keep their current value. Unknown keys are preserved as Jellyfin returned them. Values are type-checked against the field catalog before preview.</Hint>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const fields = fieldsInGroup(g.id).filter((f) => (scope === "all" || f.scope === scope) && (showAdvanced || !f.advanced));
            const hiddenAdvanced = fieldsInGroup(g.id).filter((f) => (scope === "all" || f.scope === scope) && !showAdvanced && f.advanced);
            return (
              <section key={g.id} className="rounded-md border border-edge p-3">
                <h3 className="font-semibold">{g.title}</h3>
                <p className="mb-2 text-xs text-fg-muted">{g.description}</p>
                <div className="space-y-3">
                  {fields.map((f) => (
                    <div key={f.key} className="grid gap-1 sm:grid-cols-[1fr_1fr]">
                      <div>
                        <label htmlFor={`f-${f.key}`} className="font-medium">
                          {f.label}
                        </label>
                        <div>
                          <code className="text-xs text-fg-subtle">{f.key}</code>
                        </div>
                        <Hint>{f.help}</Hint>
                      </div>
                      <div className="sm:pt-0.5">
                        <FieldInput field={f} value={current[f.key]} refData={refData} />
                      </div>
                    </div>
                  ))}
                  {/* Advanced fields that are hidden still travel with the form so absent checkboxes are not read as false. */}
                  {hiddenAdvanced.map((f) => (
                    <HiddenField key={f.key} field={f} value={current[f.key]} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Working…" : "Preview changes"}
        </Button>
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}

/** Carries an unrendered field's current value in the same encoding the visible input would use. */
function HiddenField({ field, value }: { field: PolicyFieldDef; value: unknown }) {
  switch (field.kind) {
    case "boolean":
      return value === true ? <input type="hidden" name={field.key} value="on" /> : null;
    case "folderIds":
    case "deviceIds":
    case "unratedItems":
      return <>{(Array.isArray(value) ? value : []).map((v) => <input key={String(v)} type="hidden" name={field.key} value={String(v)} />)}</>;
    case "stringList":
    case "channelIds":
      return <input type="hidden" name={field.key} value={Array.isArray(value) ? value.join("\n") : ""} />;
    case "schedules":
      return <input type="hidden" name={field.key} value={Array.isArray(value) && value.length ? JSON.stringify(value) : "[]"} />;
    default:
      return <input type="hidden" name={field.key} value={value === null || value === undefined ? "" : String(value)} />;
  }
}
