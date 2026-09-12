import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { distinctAuditActions, listAudit, type AuditFilters } from "@/lib/services/audit";
import { listUsers } from "@/lib/services/users";
import { AuditTable } from "@/components/audit/audit-table";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { buttonVariants } from "@/components/ui/button";
import { FilterForm } from "@/components/ui/filter-form";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Audit" };

const ACTOR_TYPES = ["admin", "self", "system", "invite"] as const;
const PAGE = 100;

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters & { raw: Record<string, string> } {
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  const raw: Record<string, string> = {};
  const f: AuditFilters = {};
  const actorType = get("actorType");
  if ((ACTOR_TYPES as readonly string[]).includes(actorType)) {
    f.actorType = actorType as AuditFilters["actorType"];
    raw.actorType = actorType;
  }
  for (const k of ["actorId", "action", "targetUserId"] as const) {
    const v = get(k);
    if (v) {
      f[k] = v;
      raw[k] = v;
    }
  }
  const from = get("from");
  const to = get("to");
  if (from && !Number.isNaN(Date.parse(from))) {
    f.from = new Date(from);
    raw.from = from;
  }
  if (to && !Number.isNaN(Date.parse(to))) {
    // A date alone means the whole of that day, or the filter would drop everything after midnight.
    f.to = to.length === 10 ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
    raw.to = to;
  }
  const before = Number(get("before"));
  if (Number.isInteger(before) && before > 0) f.beforeId = before;
  return { ...f, raw };
}

export default async function AuditPage(props: PageProps<"/audit">) {
  await requireAdmin();
  const params = await props.searchParams;
  const filters = parseAuditFilters(params);
  const [rows, actions, users] = await Promise.all([listAudit(filters, PAGE + 1), distinctAuditActions(), listUsers().catch(() => [])]);
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const qs = new URLSearchParams(filters.raw);
  const exportQs = qs.toString();
  const nextQs = new URLSearchParams({ ...filters.raw, before: String(page[page.length - 1]?.id ?? 0) }).toString();
  const filtered = Object.keys(filters.raw).length > 0;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Every change jellycrew made, and who asked for it. Entries are never edited or removed."
        actions={
          <>
            <a href={`/audit/export?format=csv&${exportQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Export CSV
            </a>
            <a href={`/audit/export?format=json&${exportQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Export JSON
            </a>
          </>
        }
      />
      <FilterForm key={exportQs} action="/audit" className="flex flex-wrap items-center gap-2">
        <AutoSubmitSelect name="actorType" defaultValue={filters.raw.actorType ?? ""} aria-label="Filter by who acted">
          <option value="">Anyone</option>
          {ACTOR_TYPES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="action" defaultValue={filters.raw.action ?? ""} aria-label="Filter by action">
          <option value="">Any action</option>
          {[...new Set(actions.map((a) => `${a.split(".")[0]}.*`))].map((prefix) => (
            <option key={prefix} value={prefix}>
              {prefix}
            </option>
          ))}
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="targetUserId" defaultValue={filters.raw.targetUserId ?? ""} aria-label="Filter by user">
          <option value="">Any user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          {filters.raw.targetUserId && !users.some((u) => u.id === filters.raw.targetUserId) ? <option value={filters.raw.targetUserId}>{filters.raw.targetUserId.slice(0, 8)}… (gone)</option> : null}
        </AutoSubmitSelect>
        <AutoSubmitInput name="from" type="date" defaultValue={filters.raw.from ?? ""} aria-label="From date" className="w-auto" />
        <AutoSubmitInput name="to" type="date" defaultValue={filters.raw.to ?? ""} aria-label="To date" className="w-auto" />
        {/* Set by a link or an export URL: it has no control of its own, so it travels in a
            hidden field and shows as a chip that can be removed. */}
        {filters.raw.actorId ? (
          <>
            <input type="hidden" name="actorId" value={filters.raw.actorId} />
            <Chip>
              Actor {nameById.get(filters.raw.actorId) ?? `${filters.raw.actorId.slice(0, 8)}…`}
              <Link href={`/audit?${new URLSearchParams(Object.fromEntries(Object.entries(filters.raw).filter(([k]) => k !== "actorId")))}`} aria-label="Remove the actor filter" className="ml-1 underline">
                remove
              </Link>
            </Chip>
          </>
        ) : null}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Apply filters
        </button>
        {filtered ? (
          <Link href="/audit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Clear
          </Link>
        ) : null}
      </FilterForm>
      <AuditTable rows={page} names={nameById} filtered={filtered} />
      {hasMore ? (
        <Link href={`/audit?${nextQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Older entries
        </Link>
      ) : null}
    </div>
  );
}
