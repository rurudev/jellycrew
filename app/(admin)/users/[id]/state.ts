import type { FieldChange } from "@/lib/policy/diff";

/**
 * What a dialog action reports back. Results travel in the action's return value rather than
 * the URL, so one-time secrets (a reset link) and previews never end up in history or a
 * bookmark. Redirect-with-notice is still used by the plain forms elsewhere on the page.
 */
export interface ActionState {
  ok?: string;
  error?: string;
  /** A single-use reset link, shown once in the dialog that created it. */
  link?: string;
  /** What copying from `sourceId` would change; the same form then confirms it. */
  preview?: { sourceId: string; changes: FieldChange[] };
}

export const IDLE: ActionState = {};
