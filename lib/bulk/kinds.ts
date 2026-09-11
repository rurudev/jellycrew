/** Bulk action identifiers and labels. Pure module so client components can import it. */
export const BULK_KINDS = [
  "assign_profile",
  "apply_profile",
  "enable",
  "disable",
  "set_expiry",
  "extend_expiry",
  "clear_expiry",
  "schedule_deletion",
  "cancel_deletion",
  "add_label",
  "remove_label",
] as const;
export type BulkKind = (typeof BULK_KINDS)[number];

export const BULK_LABELS: Record<BulkKind, string> = {
  assign_profile: "Assign profile",
  apply_profile: "Apply profile",
  enable: "Enable",
  disable: "Disable",
  set_expiry: "Set expiry date",
  extend_expiry: "Extend expiry by days",
  clear_expiry: "Remove expiry",
  schedule_deletion: "Schedule deletion (disable now, delete after grace)",
  cancel_deletion: "Cancel scheduled deletion",
  add_label: "Add label",
  remove_label: "Remove label",
};

/** Which extra parameter a kind needs, for the form. */
export const BULK_PARAM: Record<BulkKind, "profile" | "date" | "days" | "label" | null> = {
  assign_profile: "profile",
  apply_profile: "profile",
  enable: null,
  disable: null,
  set_expiry: "date",
  extend_expiry: "days",
  clear_expiry: null,
  schedule_deletion: null,
  cancel_deletion: null,
  add_label: "label",
  remove_label: "label",
};
