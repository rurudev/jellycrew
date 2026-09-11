import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getReferenceData } from "@/lib/services/reference";
import { getUserDetail } from "@/lib/services/users";
import { Notice } from "@/components/notice";
import { PolicyView } from "@/components/policy/policy-view";
import { DevicesTable } from "@/components/sessions/devices-table";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { Time } from "@/components/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, EmptyRow } from "@/components/ui/table";
import { Avatar } from "@/components/users/avatar";
import { StatusBadge } from "@/components/users/status-badge";

export default async function UserDetailPage(props: PageProps<"/users/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const params = await props.searchParams;
  const [detail, ref] = await Promise.all([getUserDetail(id), getReferenceData()]);
  if (!detail) notFound();
  const { row, sessions, devices, history, policy } = detail;
  const returnTo = `/users/${id}`;
  return (
    <div className="space-y-4">
      <div className="text-xs text-zinc-500">
        <Link href="/users" className="hover:underline">
          Users
        </Link>{" "}
        / {row.name}
      </div>
      <header className="flex flex-wrap items-center gap-3">
        <Avatar userId={row.id} name={row.name} imageTag={row.imageTag} size={40} />
        <h1 className="text-xl font-semibold">{row.name}</h1>
        {row.isAdmin ? <Badge tone="purple">admin</Badge> : null}
        {row.isHidden ? <Badge>hidden</Badge> : null}
        <StatusBadge status={row.status} />
        <span className="text-xs text-zinc-400">
          <code>{row.id}</code>
        </span>
      </header>
      <Notice params={params} />

      <Card>
        <CardTitle>Lifecycle</CardTitle>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-500">Email</dt>
          <dd>
            {row.meta.email ?? <span className="text-zinc-400">none</span>}{" "}
            {row.meta.email ? row.meta.emailVerifiedAt ? <Badge tone="green">verified</Badge> : <Badge tone="amber">unverified</Badge> : null}
          </dd>
          <dt className="text-zinc-500">Labels</dt>
          <dd>{row.labels.length ? row.labels.map((l) => <Badge key={l} tone="blue" className="mr-1">{l}</Badge>) : <span className="text-zinc-400">none</span>}</dd>
          <dt className="text-zinc-500">Notes</dt>
          <dd className="whitespace-pre-wrap">{row.meta.notes ?? <span className="text-zinc-400">none</span>}</dd>
          <dt className="text-zinc-500">Expires</dt>
          <dd>{row.expiresAt ? <Time date={row.expiresAt} /> : <span className="text-zinc-400">never</span>}</dd>
          <dt className="text-zinc-500">Inactivity rule</dt>
          <dd>{row.meta.inactivityDisableDays ? `disable after ${row.meta.inactivityDisableDays} days` : <span className="text-zinc-400">inherit from profile</span>}</dd>
          <dt className="text-zinc-500">Deletion</dt>
          <dd>{row.meta.deleteAfter ? <>scheduled <Time date={row.meta.deleteAfter} /></> : <span className="text-zinc-400">not scheduled</span>}</dd>
          {row.meta.disabledByAppAt ? (
            <>
              <dt className="text-zinc-500">Disabled by app</dt>
              <dd>
                <Time date={row.meta.disabledByAppAt} /> ({row.meta.disabledReason})
              </dd>
            </>
          ) : null}
          <dt className="text-zinc-500">Last login</dt>
          <dd>
            <Time date={row.lastLogin} />
          </dd>
          <dt className="text-zinc-500">Last activity</dt>
          <dd>
            <Time date={row.lastActivity} />
          </dd>
          <dt className="text-zinc-500">First seen by app</dt>
          <dd>
            <Time date={row.meta.firstSeenAt} />
          </dd>
        </dl>
      </Card>

      <Card>
        <CardTitle>Access</CardTitle>
        <PolicyView policy={policy} refData={ref} />
      </Card>

      <Card>
        <CardTitle>Sessions</CardTitle>
        <SessionsTable sessions={sessions} showUser={false} returnTo={returnTo} />
      </Card>

      <Card>
        <CardTitle>Devices</CardTitle>
        <DevicesTable devices={devices} showUser={false} returnTo={returnTo} />
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? <EmptyRow colSpan={4}>No history yet.</EmptyRow> : null}
            {history.map((h) => (
              <tr key={h.id}>
                <Td>
                  <Time date={h.ts} />
                </Td>
                <Td>
                  {h.actorType}
                  {h.actorId ? <span className="text-zinc-400"> {h.actorId.slice(0, 8)}</span> : null}
                </Td>
                <Td>
                  <code className="text-xs">{h.action}</code>
                </Td>
                <Td className="max-w-md truncate text-xs text-zinc-500" title={h.detail ? JSON.stringify(h.detail) : ""}>
                  {h.detail ? JSON.stringify(h.detail) : ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
