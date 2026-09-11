import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { distinctAuditActions, listAudit, type AuditFilters } from "@/lib/services/audit";
import { listUsers } from "@/lib/services/users";
import { Time } from "@/components/time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";

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
    f.to = new Date(`${to}T23:59:59.999Z`.length === 29 && to.length === 10 ? `${to}T23:59:59.999Z` : to);
    raw.to = to;
  }
  const before = Number(get("before"));
  if (Number.isInteger(before) && before > 0) f.beforeId = before;
  return { ...f, raw };
}

function pretty(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
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
  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
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
      <form method="get" action="/audit" className="flex flex-wrap items-end gap-2">
        <NativeSelect name="actorType" defaultValue={filters.raw.actorType ?? ""} aria-label="Actor type">
          <option value="">Any actor</option>
          {ACTOR_TYPES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </NativeSelect>
        <Input name="actorId" placeholder="Actor id" defaultValue={filters.raw.actorId ?? ""} className="w-40" aria-label="Actor id" />
        <NativeSelect name="action" defaultValue={filters.raw.action ?? ""} aria-label="Action">
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
        </NativeSelect>
        <NativeSelect name="targetUserId" defaultValue={filters.raw.targetUserId ?? ""} aria-label="User">
          <option value="">Any user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
        <Input name="from" type="date" defaultValue={filters.raw.from ?? ""} aria-label="From date" className="w-auto" />
        <Input name="to" type="date" defaultValue={filters.raw.to ?? ""} aria-label="To date" className="w-auto" />
        <Button type="submit" variant="outline">
          Filter
        </Button>
        <Link href="/audit" className="px-2 text-muted-foreground hover:underline">
          Reset
        </Link>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>User</Th>
            <Th>Before</Th>
            <Th>After</Th>
            <Th>Detail</Th>
          </tr>
        </thead>
        <tbody>
          {page.length === 0 ? <EmptyRow colSpan={7}>No audit entries match.</EmptyRow> : null}
          {page.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">
                <Time date={r.ts} />
                <div className="text-xs text-muted-foreground">#{r.id}</div>
              </Td>
              <Td>
                {r.actorType}
                {r.actorId ? <div className="text-xs text-muted-foreground">{nameById.get(r.actorId) ?? r.actorId}</div> : null}
              </Td>
              <Td>
                <code className="text-xs">{r.action}</code>
              </Td>
              <Td>{r.targetUserId ? <Link href={`/users/${r.targetUserId}`}>{nameById.get(r.targetUserId) ?? r.targetUserId.slice(0, 8)}</Link> : ""}</Td>
              <Td className="max-w-48 truncate text-xs text-muted-foreground" title={pretty(r.before)}>
                {pretty(r.before)}
              </Td>
              <Td className="max-w-48 truncate text-xs text-muted-foreground" title={pretty(r.after)}>
                {pretty(r.after)}
              </Td>
              <Td className="max-w-64 truncate text-xs text-muted-foreground" title={pretty(r.detail)}>
                {pretty(r.detail)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {hasMore ? (
        <Link href={`/audit?${nextQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Older entries
        </Link>
      ) : null}
    </div>
  );
}
