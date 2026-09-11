import { z } from "zod";
import { DAY_OF_WEEK_VALUES, POLICY_FIELDS, SYNC_PLAY_ACCESS_VALUES, UNRATED_ITEM_VALUES, type PolicyFieldDef, type PolicyScope } from "./fields";

export class PolicyFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyFormError";
  }
}

const ScheduleSchema = z.object({
  DayOfWeek: z.enum(DAY_OF_WEEK_VALUES),
  StartHour: z.number().min(0).max(24),
  EndHour: z.number().min(0).max(24),
  Id: z.number().optional(),
  UserId: z.string().optional(),
});

type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[]; has(name: string): boolean };

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

function splitList(v: string): string[] {
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parses one field from its form representation. Field inputs are named by policy key. */
export function parseFieldValue(field: PolicyFieldDef, form: FormLike): unknown {
  const key = field.key;
  switch (field.kind) {
    case "boolean":
      return form.get(key) === "on" || form.get(key) === "true";
    case "integer": {
      const raw = str(form.get(key)).trim();
      if (raw === "") return field.key === "MaxParentalSubRating" ? null : 0;
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new PolicyFormError(`${field.label}: must be a whole number.`);
      return n;
    }
    case "string":
      return str(form.get(key)).trim();
    case "stringList":
    case "channelIds":
      return splitList(str(form.get(key)));
    case "folderIds":
    case "deviceIds":
    case "unratedItems":
      return form.getAll(key).map((v) => str(v)).filter(Boolean);
    case "rating": {
      const raw = str(form.get(key)).trim();
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new PolicyFormError(`${field.label}: invalid rating value.`);
      return n;
    }
    case "syncPlayAccess": {
      const raw = str(form.get(key));
      if (!(SYNC_PLAY_ACCESS_VALUES as readonly string[]).includes(raw)) throw new PolicyFormError(`${field.label}: invalid value.`);
      return raw;
    }
    case "schedules": {
      const raw = str(form.get(key)).trim();
      if (raw === "" || raw === "[]") return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new PolicyFormError(`${field.label}: must be a JSON array of schedules.`);
      }
      const result = z.array(ScheduleSchema).safeParse(parsed);
      if (!result.success) throw new PolicyFormError(`${field.label}: ${z.prettifyError(result.error)}`);
      return result.data;
    }
  }
}

/**
 * Turns a grouped-editor submission into an edit object. Every catalog field in `scope`
 * is read (absent checkboxes mean false), so the caller gets a complete edit.
 */
export function parseGroupedPolicyForm(form: FormLike, scope: PolicyScope | "all"): Record<string, unknown> {
  const edit: Record<string, unknown> = {};
  for (const field of POLICY_FIELDS) {
    if (scope !== "all" && field.scope !== scope) continue;
    edit[field.key] = parseFieldValue(field, form);
  }
  return edit;
}

/** Validates a raw JSON submission: must be an object; values are type-checked against the catalog. */
export function parseRawPolicyJson(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PolicyFormError("Raw policy is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PolicyFormError("Raw policy must be a JSON object.");
  const obj = parsed as Record<string, unknown>;
  for (const field of POLICY_FIELDS) {
    if (!(field.key in obj)) continue;
    const v = obj[field.key];
    const bad = (why: string) => new PolicyFormError(`${field.key}: ${why}`);
    switch (field.kind) {
      case "boolean":
        if (typeof v !== "boolean") throw bad("expected true or false");
        break;
      case "integer":
        if (v !== null && !Number.isInteger(v)) throw bad("expected an integer");
        break;
      case "rating":
        if (v !== null && !Number.isInteger(v)) throw bad("expected an integer or null");
        break;
      case "string":
        if (typeof v !== "string") throw bad("expected a string");
        break;
      case "syncPlayAccess":
        if (!(SYNC_PLAY_ACCESS_VALUES as readonly string[]).includes(String(v))) throw bad(`expected one of ${SYNC_PLAY_ACCESS_VALUES.join(", ")}`);
        break;
      case "unratedItems":
        if (!Array.isArray(v) || v.some((x) => !(UNRATED_ITEM_VALUES as readonly string[]).includes(String(x)))) throw bad("expected an array of unrated item types");
        break;
      case "schedules": {
        const r = z.array(ScheduleSchema).safeParse(v);
        if (!r.success) throw bad(z.prettifyError(r.error));
        break;
      }
      default:
        if (v !== null && (!Array.isArray(v) || v.some((x) => typeof x !== "string"))) throw bad("expected an array of strings");
    }
  }
  return obj;
}
