import { requireAdmin } from "@/lib/auth/session";
import { listSessions } from "@/lib/services/sessions";
import { listDevices } from "@/lib/services/devices";
import { summarizeSessions } from "@/lib/sessions/view";
import { AutoRefresh } from "@/components/auto-refresh";
import { DevicesTable } from "@/components/sessions/devices-table";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { SummaryStrip } from "@/components/sessions/summary-strip";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { FilterForm } from "@/components/ui/filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";

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
  for (const [key, value] of Object.entries(q)) if (value) search.set(key, value);
  const query = search.toString();
  const returnTo = `/sessions${query ? `?${query}` : ""}`;
  const filtered = query !== "";

  return (
    <div className="space-y-4">
      <PageHeader title="Sessions" description="What Jellyfin is playing right now, and the devices that have signed in." actions={<AutoRefresh seconds={10} />} />

      <SummaryStrip
        stats={[
          { label: summary.streams === 1 ? "stream" : "streams", value: summary.streams },
          { label: "transcoding", value: summary.transcodes, notable: true },
          { label: summary.users === 1 ? "person" : "people", value: summary.users },
          { label: summary.sessions === 1 ? "connected client" : "connected clients", value: summary.sessions },
        ]}
      />

      <Section title="Playing now" description={filtered ? `Filtered: showing ${sessions.length} of ${all.length}.` : undefined}>
        <FilterForm key={query} action="/sessions" className="mb-3 flex flex-wrap items-center gap-2">
          <Input name="user" placeholder="User" defaultValue={q.user} aria-label="Filter by user" className="w-40" />
          <Input name="client" placeholder="Client" defaultValue={q.client} aria-label="Filter by client" className="w-40" />
          <AutoSubmitSelect name="method" defaultValue={q.method} aria-label="Filter by play method">
            <option value="">Any method</option>
            <option value="direct">Direct play</option>
            <option value="remux">Remux</option>
            <option value="transcode">Transcode</option>
            <option value="idle">Idle</option>
          </AutoSubmitSelect>
          <button type="submit" className="sr-only" tabIndex={-1}>
            Apply filters
          </button>
        </FilterForm>
        <SessionsTable sessions={sessions} returnTo={returnTo} variant="plain" />
      </Section>

      <Section title="Devices" description="Every client that has signed in. Revoking one signs it out.">
        <DevicesTable devices={devices} returnTo={returnTo} variant="plain" />
      </Section>
    </div>
  );
}
