"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, Hint } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DiffTable } from "@/components/policy/diff-table";
import { SectionIndex } from "@/components/ui/section-index";
import { IdCheckboxes } from "@/components/policy/id-checkboxes";
import { POLICY_GROUPS, SYNC_PLAY_ACCESS_VALUES, UNRATED_ITEM_VALUES, fieldsInGroup, type PolicyFieldDef } from "@/lib/policy/fields";
import { mergeEdit } from "@/lib/policy/merge";
import { idleEditorState, type PolicyEditorState } from "@/lib/policy/editor-state";

export interface EditorRefData {
  folders: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string; appName: string | null }>;
  ratings: Array<{ name: string; value: number | null }>;
}

export type PolicyEditorAction = (prev: PolicyEditorState, formData: FormData) => Promise<PolicyEditorState>;

/** The raw Jellyfin key, shown only while the form's "Show field names" toggle is on. */
function FieldKey({ name }: { name: string }) {
  return <code className="text-xs font-normal text-muted-foreground [[data-keys=off]_&]:hidden">{name}</code>;
}

/** The id and `aria-describedby` that `FormField` clones onto whatever it wraps. */
type FieldAria = Pick<ComponentProps<"input">, "aria-describedby" | "aria-invalid">;

function FieldInput({ field, id, value, refData, ...aria }: { field: PolicyFieldDef; id: string; value: unknown; refData: EditorRefData } & FieldAria) {
  switch (field.kind) {
    case "boolean":
      return <Checkbox id={id} name={field.key} defaultChecked={value === true} {...aria} />;
    case "integer":
      return <Input id={id} type="number" name={field.key} defaultValue={value === null || value === undefined ? "" : String(value)} {...aria} />;
    case "string":
      return <Input id={id} name={field.key} defaultValue={typeof value === "string" ? value : ""} {...aria} />;
    case "stringList":
    case "channelIds":
      return <Textarea id={id} name={field.key} defaultValue={Array.isArray(value) ? value.join("\n") : ""} placeholder="One per line" className="min-h-16" {...aria} />;
    case "folderIds":
      return <IdCheckboxes name={field.key} selected={Array.isArray(value) ? value.map(String) : []} options={refData.folders.map((f) => ({ id: f.id, label: f.name }))} empty="This server has no libraries." />;
    case "deviceIds":
      return (
        <IdCheckboxes
          name={field.key}
          selected={Array.isArray(value) ? value.map(String) : []}
          options={refData.devices.map((d) => ({ id: d.id, label: d.appName ? `${d.name} · ${d.appName}` : d.name }))}
          empty="No device has signed in yet."
        />
      );
    case "rating": {
      const values = [...new Map(refData.ratings.filter((r) => r.value !== null).map((r) => [r.value, r])).values()].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      return (
        <NativeSelect id={id} name={field.key} defaultValue={value === null || value === undefined ? "" : String(value)} {...aria}>
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
        </NativeSelect>
      );
    }
    case "unratedItems":
      return <IdCheckboxes name={field.key} selected={Array.isArray(value) ? value.map(String) : []} options={UNRATED_ITEM_VALUES.map((v) => ({ id: v, label: v }))} />;
    case "syncPlayAccess":
      return (
        <NativeSelect id={id} name={field.key} defaultValue={typeof value === "string" ? value : "CreateAndJoinGroups"} {...aria}>
          {SYNC_PLAY_ACCESS_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </NativeSelect>
      );
    case "schedules":
      return (
        <Textarea
          id={id}
          name={field.key}
          defaultValue={Array.isArray(value) && value.length ? JSON.stringify(value, null, 2) : "[]"}
          className="min-h-20 font-mono text-xs"
          spellCheck={false}
          placeholder='[{"DayOfWeek":"Weekend","StartHour":8,"EndHour":20}]'
          {...aria}
        />
      );
  }
}

/** Kinds that need the full width of the group: lists, schedules and free text. */
const WIDE_KINDS = new Set(["folderIds", "deviceIds", "unratedItems", "stringList", "channelIds", "schedules"]);

/** How wide the control may grow. A number entry 500px wide reads as a mistake. */
const FIELD_WIDTH: Partial<Record<string, string>> = { integer: "max-w-48", rating: "max-w-sm", syncPlayAccess: "max-w-sm", string: "max-w-sm", stringList: "max-w-md", channelIds: "max-w-md", schedules: "max-w-lg" };

function FieldRow({ field, value, refData }: { field: PolicyFieldDef; value: unknown; refData: EditorRefData }) {
  const id = useId();
  if (field.kind === "boolean") {
    return (
      <div className="flex items-start gap-2.5 self-start">
        <FieldInput field={field} id={id} value={value} refData={refData} />
        <div className="min-w-0 -mt-0.5">
          <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 font-medium">
            {field.label}
            <FieldKey name={field.key} />
          </label>
          <Hint>{field.help}</Hint>
        </div>
      </div>
    );
  }
  if (field.kind === "folderIds" || field.kind === "deviceIds" || field.kind === "unratedItems") {
    return (
      <fieldset className={cn("space-y-1.5", FIELD_WIDTH[field.kind])}>
        <legend className="flex flex-wrap items-baseline gap-x-2 font-medium">
          {field.label}
          <FieldKey name={field.key} />
        </legend>
        <Hint>{field.help}</Hint>
        <FieldInput field={field} id={id} value={value} refData={refData} />
      </fieldset>
    );
  }
  return (
    <FormField
      id={id}
      className={FIELD_WIDTH[field.kind]}
      label={
        <span className="flex flex-wrap items-baseline gap-x-2">
          {field.label}
          <FieldKey name={field.key} />
        </span>
      }
      help={field.help}
    >
      <FieldInput field={field} id={id} value={value} refData={refData} />
    </FormField>
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
      return (
        <>
          {(Array.isArray(value) ? value : []).map((v) => (
            <input key={String(v)} type="hidden" name={field.key} value={String(v)} />
          ))}
        </>
      );
    case "stringList":
    case "channelIds":
      return <input type="hidden" name={field.key} value={Array.isArray(value) ? value.join("\n") : ""} />;
    case "schedules":
      return <input type="hidden" name={field.key} value={Array.isArray(value) && value.length ? JSON.stringify(value) : "[]"} />;
    default:
      return <input type="hidden" name={field.key} value={value === null || value === undefined ? "" : String(value)} />;
  }
}

/** Controlled so that React's reset-after-action does not throw away unsaved JSON. */
function RawPanel({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <>
      <Textarea name="raw" value={text} onChange={(event) => setText(event.target.value)} className="min-h-96 font-mono text-xs" spellCheck={false} aria-label="Policy JSON" />
      <Hint>Keys you leave out keep their current value, and keys outside the catalogue are preserved as Jellyfin returned them. Values are type-checked before the preview.</Hint>
    </>
  );
}

function changeCount(n: number): string {
  return `${n} ${n === 1 ? "change" : "changes"}`;
}

/**
 * The policy editor for a user or a profile. Nothing is written until the operator has seen
 * the diff: Preview returns the changes, the dialog confirms them. The base policy and its
 * hash travel with the form so a write that lost a race is refused rather than applied.
 */
export function PolicyEditor({
  action,
  policy,
  hash,
  refData,
  target,
}: {
  action: PolicyEditorAction;
  policy: Record<string, unknown>;
  hash: string;
  refData: EditorRefData;
  /** Which record is being edited. Scope, the hidden id and the cancel link follow from it. */
  target: { kind: "user" | "profile"; id: string };
}) {
  const formId = useId();
  const scope = target.kind === "user" ? "all" : "profile";
  const cancelHref = target.kind === "user" ? `/users/${target.id}` : `/profiles/${target.id}`;
  const idField = target.kind === "user" ? "userId" : "profileId";

  const [state, formAction, pending] = useActionState<PolicyEditorState, FormData>(async (prev, formData) => {
    const next = await action(prev, formData);
    if (next.status === "saved") toast.success(`Saved ${changeCount(next.changes?.length ?? 0)}.`);
    if (next.status === "no_changes") toast("Nothing to save: the policy already matches the form.");
    return next;
  }, idleEditorState);

  const [mode, setMode] = useState<"grouped" | "raw">("grouped");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editedSincePreview, setEditedSincePreview] = useState(false);
  // Bumped only when a result brings a new starting point. A parse error brings none, so the
  // form is left alone with what the operator typed.
  const [seed, setSeed] = useState(0);
  // Every result is a new object: open the review when a preview arrives, and forget that the
  // form was touched. State is adjusted during render rather than in an effect.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setReviewOpen(state.status === "preview");
    setEditedSincePreview(false);
    if (!(state.status === "error" && !state.edit)) setSeed((n) => n + 1);
  }

  // After a stale write the live policy becomes the new base; the operator's edit is kept.
  const base = state.status === "stale" && state.live ? state.live : policy;
  const baseHash = state.status === "stale" && state.liveHash ? state.liveHash : (state.liveHash ?? hash);
  const current = useMemo(() => (state.edit ? mergeEdit(base, state.edit) : base), [base, state.edit]);
  const formKey = `${baseHash}:${seed}`;

  const groups = POLICY_GROUPS.map((g) => {
    const all = fieldsInGroup(g.id).filter((f) => scope === "all" || f.scope === scope);
    return { ...g, shown: all.filter((f) => showAdvanced || !f.advanced), hidden: all.filter((f) => !showAdvanced && f.advanced) };
  }).filter((g) => g.shown.length > 0 || g.hidden.length > 0);

  const previewChanges = state.status === "preview" ? (state.changes ?? []) : null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
      {/* Keyed with the form: the sections it observes are recreated whenever the form is. */}
      {mode === "grouped" ? (
        <SectionIndex key={`index-${formKey}`} sections={groups.filter((g) => g.shown.length > 0).map((g) => ({ id: `g-${g.id}`, title: g.title, count: g.shown.length }))} />
      ) : (
        <div className="hidden lg:block" />
      )}

      <form
        key={formKey}
        id={formId}
        action={formAction}
        data-keys={showKeys ? "on" : "off"}
        onChange={(event) => {
          // The list filters live inside the form but change nothing that gets submitted.
          if (!(event.target as HTMLElement).closest("[data-no-dirty]")) setEditedSincePreview(true);
        }}
        className="min-w-0 space-y-4"
      >
        <input type="hidden" name={idField} value={target.id} />
        <input type="hidden" name="baseHash" value={baseHash} />
        <input type="hidden" name="base" value={JSON.stringify(base)} />
        <input type="hidden" name="mode" value={mode} />

        {state.status === "error" ? <Callout tone="error">{state.error}</Callout> : null}
        {state.status === "stale" ? (
          <Callout tone="warning" title="The policy changed while you were editing">
            <p>
              Nothing was saved. The form below now starts from the current policy with your edits put back on top. Your form holds every field as you had it, so a field you never touched can still overwrite what changed here. Preview
              again and read the diff before you save.
            </p>
            <div className="mt-2 overflow-x-auto">
              <DiffTable changes={state.changedSince ?? []} beforeLabel="When you opened the editor" afterLabel="Now on the server" empty="Nothing visible changed: a field outside the catalogue may have." />
            </div>
          </Callout>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value === "raw" ? "raw" : "grouped")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger type="button" value="grouped">
                Fields
              </TabsTrigger>
              <TabsTrigger type="button" value="raw">
                Raw JSON
              </TabsTrigger>
            </TabsList>
            {mode === "grouped" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" aria-pressed={showAdvanced} onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
                </Button>
                <Button type="button" variant="ghost" size="sm" aria-pressed={showKeys} onClick={() => setShowKeys((v) => !v)}>
                  {showKeys ? "Hide field names" : "Show field names"}
                </Button>
              </div>
            ) : null}
          </div>

          <TabsContent value="grouped" className="space-y-4">
            {groups.map((g) =>
              g.shown.length === 0 ? (
                // Nothing to show without "advanced": carry the values, skip the empty card.
                <div key={g.id} hidden>
                  {g.hidden.map((f) => (
                    <HiddenField key={f.key} field={f} value={current[f.key]} />
                  ))}
                </div>
              ) : (
                <Section key={g.id} id={`g-${g.id}`} title={g.title} description={g.description} level={target.kind === "user" ? 2 : 3} className="scroll-mt-14">
                  <div className="grid items-start gap-x-8 gap-y-4 xl:grid-cols-2">
                    {g.shown.map((f) => (
                      <div key={f.key} className={WIDE_KINDS.has(f.kind) ? "xl:col-span-2" : undefined}>
                        <FieldRow field={f} value={current[f.key]} refData={refData} />
                      </div>
                    ))}
                    {/* Hidden advanced fields still travel with the form, or an absent checkbox would read as false. */}
                    {g.hidden.map((f) => (
                      <HiddenField key={f.key} field={f} value={current[f.key]} />
                    ))}
                  </div>
                </Section>
              ),
            )}
          </TabsContent>

          <TabsContent value="raw" className="space-y-1.5">
            <RawPanel initial={JSON.stringify(current, null, 2)} />
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
          {previewChanges ? (
            <p className="text-muted-foreground">
              {editedSincePreview ? `You changed the form after previewing ${changeCount(previewChanges.length)}.` : `${changeCount(previewChanges.length)} ready to save.`}
            </p>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
            {previewChanges && !editedSincePreview ? (
              <Button type="button" variant="outline" onClick={() => setReviewOpen(true)}>
                Review {changeCount(previewChanges.length)}
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Working…" : "Preview changes"}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Save {changeCount(previewChanges?.length ?? 0)}?</DialogTitle>
            <DialogDescription>
              {target.kind === "user" ? "This writes to Jellyfin straight away." : "This changes the profile. Members keep their current settings until the profile is applied to them."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded-lg border p-2">
            <DiffTable changes={previewChanges ?? []} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep editing</DialogClose>
            <Button type="submit" form={formId} name="confirm" value="1" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : "Confirm and save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
