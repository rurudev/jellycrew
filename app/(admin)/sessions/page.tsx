import { requireAdmin } from "@/lib/auth/session";
import { listSessions } from "@/lib/services/sessions";
import { listDevices } from "@/lib/services/devices";
import { summarizeSessions } from "@/lib/sessions/view";
import { AutoRefresh } from "@/components/auto-refresh";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { DevicesTable } from "@/components/sessions/devices-table";

export const metadata = { title: "Sessions" };

export default async function SessionsPage(props: PageProps<"/sessions">) {
  await requireAdmin();
  const params = await props.searchParams;
  const q = {
    user: typeof params.user === "string" ? params.user.trim().toLowerCase() : "",
    client: typeof params.client === "string" ? params.client.trim().toLowerCase() : "",
    method: typeof params.method === "string" ? params.method : "",
  };
  const [all, devices] = await Promise.all([listSessions(), listDevices()]);
  const sessions = all.filter(
    (s) =>
      (!q.user || (s.userName ?? "").toLowerCase().includes(q.user)) &&
      (!q.client || (s.client ?? "").toLowerCase().includes(q.client)) &&
      (!q.method || (q.method === "idle" ? !s.nowPlaying : s.playMethod === q.method)),
  );
  const summary = summarizeSessions(all);
  const search = new URLSearchParams();
  if (q.user) search.set("user", q.user);
  if (q.client) search.set("client", q.client);
  if (q.method) search.set("method", q.method);
  const returnTo = `/sessions${search.size ? `?${search}` : ""}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Sessions</h1>
        <AutoRefresh seconds={10} />
      </div>
      <Notice params={params} />
      <p className="text-zinc-600 dark:text-zinc-300">
        {summary.streams} active {summary.streams === 1 ? "stream" : "streams"} · {summary.transcodes} transcoding · {summary.users} distinct{" "}
        {summary.users === 1 ? "user" : "users"} · {summary.sessions} connected {summary.sessions === 1 ? "session" : "sessions"}
      </p>
      <form method="get" action="/sessions" className="flex flex-wrap items-end gap-2">
        <Input name="user" placeholder="User" defaultValue={q.user} className="w-40" aria-label="Filter by user" />
        <Input name="client" placeholder="Client" defaultValue={q.client} className="w-40" aria-label="Filter by client" />
        <Select name="method" defaultValue={q.method} className="w-auto" aria-label="Filter by play method">
          <option value="">Any method</option>
          <option value="direct">Direct play</option>
          <option value="remux">Remux</option>
          <option value="transcode">Transcode</option>
          <option value="idle">Idle</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <SessionsTable sessions={sessions} returnTo={returnTo} />
      <h2 className="pt-2 text-base font-semibold">Devices</h2>
      <DevicesTable devices={devices} returnTo={returnTo} />
    </div>
  );
}
