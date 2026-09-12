import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Timestamp } from "@/components/ui/timestamp";
import { formatBitrate, ticksToDuration } from "@/lib/format";
import type { SessionView } from "@/lib/sessions/view";
import { MessageDialog } from "@/components/sessions/message-dialog";
import { stopPlaybackAction } from "@/app/(admin)/sessions/actions";

const methodTone = { direct: "success", remux: "primary", transcode: "warning" } as const;

export function PlayMethodBadge({ s }: { s: SessionView }) {
  if (!s.playMethod) return null;
  const title = s.playMethod === "transcode" ? s.transcodeReasons.join(", ") || "transcoding" : undefined;
  return (
    <StatusBadge tone={methodTone[s.playMethod]} title={title}>
      {s.playMethod}
    </StatusBadge>
  );
}

export type SessionColumn = "user" | "client" | "device" | "nowPlaying" | "method" | "lastActivity" | "actions";
export const SESSION_COLUMNS: readonly SessionColumn[] = ["user", "client", "device", "nowPlaying", "method", "lastActivity", "actions"];

const COLUMNS: Record<SessionColumn, { head: string; className?: string; cell: (s: SessionView, returnTo: string) => ReactNode }> = {
  user: {
    head: "User",
    cell: (s) => (s.userId ? <Link href={`/users/${s.userId}`}>{s.userName ?? s.userId}</Link> : <span className="text-muted-foreground">—</span>),
  },
  client: {
    head: "Client",
    cell: (s) => (
      <>
        {s.client ?? "—"}
        {s.appVersion ? <div className="text-xs text-muted-foreground">{s.appVersion}</div> : null}
      </>
    ),
  },
  device: {
    head: "Device",
    cell: (s) => (
      <>
        {s.deviceName ?? "—"}
        {s.remoteEndPoint ? <div className="text-xs text-muted-foreground">{s.remoteEndPoint}</div> : null}
      </>
    ),
  },
  nowPlaying: {
    head: "Now playing",
    cell: (s) =>
      s.nowPlaying ? (
        <div>
          <div className="font-medium">
            {s.nowPlaying.title}
            {s.nowPlaying.isPaused ? (
              <StatusBadge tone="neutral" dot={false} className="ml-1">
                paused
              </StatusBadge>
            ) : null}
          </div>
          {s.nowPlaying.subtitle ? <div className="text-xs text-muted-foreground">{s.nowPlaying.subtitle}</div> : null}
          <div className="text-xs text-muted-foreground">
            {ticksToDuration(s.nowPlaying.positionTicks)}
            {s.nowPlaying.runTimeTicks ? ` / ${ticksToDuration(s.nowPlaying.runTimeTicks)}` : ""}
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground">idle</span>
      ),
  },
  method: {
    head: "Method",
    cell: (s) => (
      <>
        <PlayMethodBadge s={s} />
        {s.playMethod === "transcode" ? (
          <div className="text-xs text-muted-foreground">
            {[s.videoCodec, s.audioCodec, s.container, s.resolution, formatBitrate(s.bitrate)].filter(Boolean).join(" · ")}
            {s.transcodeReasons.length ? <div>{s.transcodeReasons.join(", ")}</div> : null}
          </div>
        ) : null}
      </>
    ),
  },
  lastActivity: {
    head: "Last activity",
    cell: (s) => <Timestamp date={s.lastActivity} />,
  },
  actions: {
    head: "Actions",
    className: "text-right",
    cell: (s, returnTo) => (
      <div className="flex justify-end gap-1">
        {s.nowPlaying ? (
          <form action={stopPlaybackAction}>
            <input type="hidden" name="sessionId" value={s.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Stopping…">
              Stop
            </SubmitButton>
          </form>
        ) : null}
        <MessageDialog sessionId={s.id} device={s.deviceName ?? s.client ?? "this client"} returnTo={returnTo} />
      </div>
    ),
  },
};

export function SessionsTable({ sessions, columns = SESSION_COLUMNS, returnTo, variant = "card" }: { sessions: SessionView[]; /** Which columns to show, in order; a user's own page leaves out `user`. */ columns?: readonly SessionColumn[]; returnTo: string; /** `plain` inside a Section. */ variant?: "card" | "plain" }) {
  return (
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c} className={COLUMNS[c].className}>
              {COLUMNS[c].head}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 ? <EmptyState.Row colSpan={columns.length} title="No active sessions" description="Sessions appear here while a Jellyfin client is connected." /> : null}
        {sessions.map((s) => (
          <TableRow key={s.id}>
            {columns.map((c) => (
              <TableCell key={c} className={COLUMNS[c].className}>
                {COLUMNS[c].cell(s, returnTo)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
