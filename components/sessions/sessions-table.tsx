import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Timestamp } from "@/components/ui/timestamp";
import { formatBitrate, ticksToDuration } from "@/lib/format";
import type { SessionView } from "@/lib/sessions/view";
import { sendMessageAction, stopPlaybackAction } from "@/app/(admin)/sessions/actions";

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

export function SessionsTable({ sessions, columns = SESSION_COLUMNS, returnTo, variant = "card" }: { sessions: SessionView[]; /** Which columns to show; a user's own page leaves out `user`. */ columns?: readonly SessionColumn[]; returnTo: string; /** `plain` inside a Section. */ variant?: "card" | "plain" }) {
  const showUser = columns.includes("user");
  const cols = columns.length;
  return (
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          {showUser ? <TableHead>User</TableHead> : null}
          <TableHead>Client</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>Now playing</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 ? <EmptyState.Row colSpan={cols} title="No active sessions" description="Sessions appear here while a Jellyfin client is connected." /> : null}
        {sessions.map((s) => (
          <TableRow key={s.id}>
            {showUser ? (
              <TableCell>{s.userId ? <Link href={`/users/${s.userId}`}>{s.userName ?? s.userId}</Link> : <span className="text-muted-foreground">—</span>}</TableCell>
            ) : null}
            <TableCell>
              {s.client ?? "—"}
              {s.appVersion ? <div className="text-xs text-muted-foreground">{s.appVersion}</div> : null}
            </TableCell>
            <TableCell>
              {s.deviceName ?? "—"}
              {s.remoteEndPoint ? <div className="text-xs text-muted-foreground">{s.remoteEndPoint}</div> : null}
            </TableCell>
            <TableCell>
              {s.nowPlaying ? (
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
              )}
            </TableCell>
            <TableCell>
              <PlayMethodBadge s={s} />
              {s.playMethod === "transcode" ? (
                <div className="text-xs text-muted-foreground">
                  {[s.videoCodec, s.audioCodec, s.container, s.resolution, formatBitrate(s.bitrate)].filter(Boolean).join(" · ")}
                  {s.transcodeReasons.length ? <div>{s.transcodeReasons.join(", ")}</div> : null}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <Timestamp date={s.lastActivity} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-1">
                {s.nowPlaying ? (
                  <form action={stopPlaybackAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SubmitButton size="sm" variant="outline">
                      Stop
                    </SubmitButton>
                  </form>
                ) : null}
                <details className="text-left">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">Message</summary>
                  <form action={sendMessageAction} className="mt-1 flex gap-1">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Input name="text" placeholder="Message text" required maxLength={500} className="w-48" aria-label="Message text" />
                    <SubmitButton size="sm">Send</SubmitButton>
                  </form>
                </details>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
