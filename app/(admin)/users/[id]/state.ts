import type { FieldChange } from "@/lib/policy/diff";
import type { ActionState as BaseActionState } from "@/lib/forms/action-state";

export { IDLE } from "@/lib/forms/action-state";

/** The shared dialog result plus what the copy-policy dialog needs for its preview step. */
export interface ActionState extends BaseActionState {
  /** What copying from `sourceId` would change; the same form then confirms it. */
  preview?: { sourceId: string; changes: FieldChange[] };
}
