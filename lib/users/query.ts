import { z } from "zod";
import { daysBetween } from "@/lib/format";
import type { UserRow } from "./types";

export const SORT_KEYS = ["name", "status", "profile", "lastLogin", "lastActivity", "sessions", "devices", "expiry", "labels"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const STATUS_FILTERS = ["enabled", "disabled", "disabled_by_app", "expiring", "expired", "deletion_scheduled", "admin"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const QuerySchema = z.object({
  q: z.string().trim().default(""),
  sort: z.enum(SORT_KEYS).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(STATUS_FILTERS).optional(),
  /** Profile id, or "none" for unassigned. */
  profile: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  drift: z.enum(["yes", "no"]).optional(),
  inactive: z.coerce.number().int().positive().optional(),
});

export type UsersQuery = z.infer<typeof QuerySchema>;

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === "" ? undefined : s;
}

/** Parses URL search params leniently: unknown or invalid values fall back to defaults. */
export function parseUsersQuery(params: RawParams): UsersQuery {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["q", "sort", "dir", "status", "profile", "label", "drift", "inactive"]) raw[key] = first(params[key]);
  const result = QuerySchema.safeParse(raw);
  if (result.success) return result.data;
  // Drop the offending keys and retry so one bad value does not reset everything.
  const bad = new Set(result.error.issues.map((i) => String(i.path[0])));
  for (const k of bad) delete raw[k];
  return QuerySchema.parse(raw);
}

export function usersQueryToParams(q: Partial<UsersQuery>): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.sort && q.sort !== "name") p.set("sort", q.sort);
  if (q.dir && q.dir !== "asc") p.set("dir", q.dir);
  if (q.status) p.set("status", q.status);
  if (q.profile) p.set("profile", q.profile);
  if (q.label) p.set("label", q.label);
  if (q.drift) p.set("drift", q.drift);
  if (q.inactive) p.set("inactive", String(q.inactive));
  return p;
}

const statusRank: Record<UserRow["status"]["kind"], number> = {
  deletion_scheduled: 0,
  disabled_by_app: 1,
  disabled: 2,
  expired: 3,
  expiring: 4,
  enabled: 5,
};

function cmp<T>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dateKey(d: Date | null): number {
  return d ? d.getTime() : Number.NEGATIVE_INFINITY;
}

const comparators: Record<SortKey, (a: UserRow, b: UserRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  status: (a, b) => cmp(statusRank[a.status.kind], statusRank[b.status.kind]),
  profile: (a, b) => cmp(a.profileName ?? "￿", b.profileName ?? "￿"),
  lastLogin: (a, b) => cmp(dateKey(a.lastLogin), dateKey(b.lastLogin)),
  lastActivity: (a, b) => cmp(dateKey(a.lastActivity), dateKey(b.lastActivity)),
  sessions: (a, b) => cmp(a.activeSessions, b.activeSessions),
  devices: (a, b) => cmp(a.deviceCount, b.deviceCount),
  expiry: (a, b) => cmp(a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY, b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY),
  labels: (a, b) => cmp(a.labels.join(",").toLowerCase(), b.labels.join(",").toLowerCase()),
};

export function matchesUsersQuery(row: UserRow, q: UsersQuery, now: Date): boolean {
  if (q.q) {
    const needle = q.q.toLowerCase();
    const hay = [row.name, row.meta.email ?? "", row.meta.notes ?? "", ...row.labels].join(" ").toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (q.status) {
    if (q.status === "admin") {
      if (!row.isAdmin) return false;
    } else if (row.status.kind !== q.status) return false;
  }
  if (q.profile) {
    if (q.profile === "none" ? row.profileId !== null : row.profileId !== q.profile) return false;
  }
  if (q.label && !row.labels.includes(q.label)) return false;
  if (q.drift) {
    const wantDrift = q.drift === "yes";
    if ((row.drift ?? false) !== wantDrift) return false;
  }
  if (q.inactive !== undefined && daysBetween(now, row.activityBasis) < q.inactive) return false;
  return true;
}

/** Filters and sorts rows. Name is always the tie-breaker so ordering is stable. */
export function applyUsersQuery(rows: UserRow[], q: UsersQuery, now: Date = new Date()): UserRow[] {
  const primary = comparators[q.sort];
  const sign = q.dir === "desc" ? -1 : 1;
  return rows
    .filter((r) => matchesUsersQuery(r, q, now))
    .sort((a, b) => sign * primary(a, b) || comparators.name(a, b));
}
