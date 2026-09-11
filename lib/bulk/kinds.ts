/** Bulk action identifiers and labels. Pure module so client components can import it. */
export const BULK_KINDS = ["assign_profile", "apply_profile", "enable", "disable"] as const;
export type BulkKind = (typeof BULK_KINDS)[number];

export const BULK_LABELS: Record<BulkKind, string> = {
  assign_profile: "Assign profile",
  apply_profile: "Apply profile",
  enable: "Enable",
  disable: "Disable",
};
