import { z } from "zod";

const RunResult = z.object({
  at: z.string().optional(),
  scanned: z.number().optional(),
  disabled: z.array(z.object({ userId: z.string(), name: z.string(), reason: z.string() }).loose()).optional(),
  deleted: z.array(z.object({ userId: z.string(), name: z.string() }).loose()).optional(),
  skippedAdmins: z.number().optional(),
  errors: z.array(z.object({ name: z.string(), error: z.string() }).loose()).optional(),
});

export interface LifecycleSummary {
  /** What the run did, in one clause: "checked 12 accounts: 2 disabled, 1 deleted". */
  sentence: string;
  tone: "success" | "warning";
  scanned: number;
  disabled: Array<{ name: string; reason?: string }>;
  deleted: Array<{ name: string }>;
  errors: Array<{ name: string; error: string }>;
  skippedAdmins: number;
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The scheduler stores its last result as JSON. This turns it into the sentence the settings
 * page shows, and returns null when the job has never run or wrote something unreadable.
 */
export function lifecycleSummary(raw: unknown): LifecycleSummary | null {
  const parsed = RunResult.safeParse(raw);
  if (!parsed.success) return null;
  const { scanned = 0, skippedAdmins = 0 } = parsed.data;
  const disabled = parsed.data.disabled ?? [];
  const deleted = parsed.data.deleted ?? [];
  const errors = parsed.data.errors ?? [];
  const changes: string[] = [];
  if (disabled.length) changes.push(count(disabled.length, "account") + " disabled");
  if (deleted.length) changes.push(count(deleted.length, "account") + " deleted");
  if (errors.length) changes.push(count(errors.length, "error"));
  const checked = `checked ${count(scanned, "account")}`;
  return {
    sentence: changes.length === 0 ? `${checked}, nothing needed doing` : `${checked}: ${changes.join(", ")}`,
    tone: errors.length ? "warning" : "success",
    scanned,
    disabled: disabled.map((d) => ({ name: d.name, reason: typeof d.reason === "string" ? d.reason : undefined })),
    deleted: deleted.map((d) => ({ name: d.name })),
    errors: errors.map((e) => ({ name: e.name, error: e.error })),
    skippedAdmins,
  };
}
