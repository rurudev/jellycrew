import type { FieldChange } from "./diff";

/** State returned by the policy editor server actions (user and profile share it). */
export interface PolicyEditorState {
  status: "idle" | "preview" | "stale" | "saved" | "no_changes" | "error";
  /** The parsed edit the operator submitted, so the form can re-render with it after a preview or stale write. */
  edit?: Record<string, unknown>;
  mode?: "grouped" | "raw";
  changes?: FieldChange[];
  /** On stale: what changed on the server since the editor was opened. */
  changedSince?: FieldChange[];
  /** On stale: the new base to edit from. */
  live?: Record<string, unknown>;
  liveHash?: string;
  error?: string;
}

export const idleEditorState: PolicyEditorState = { status: "idle" };
