/**
 * What a dialog action reports back. Results travel in the action's return value rather than
 * the URL, so a one-time link never ends up in history or a bookmark.
 */
export interface ActionState {
  ok?: string;
  error?: string;
  /** A link the dialog shows once, such as an invite or a password reset. */
  link?: string;
}

export const IDLE: ActionState = {};
