import type { ActionState } from "@/lib/forms/action-state";
import type { FieldChange } from "@/lib/policy/diff";

/** What a profile dialog gets back: the shared result plus the apply-to-members preview. */
export interface ProfileActionState extends ActionState {
  /** Where to go once the dialog is done, such as a newly created profile. */
  href?: string;
  /** Members that would change if the profile were applied to all of them. */
  preview?: Array<{ id: string; name: string; changes: FieldChange[] }>;
}
