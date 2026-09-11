import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { Time } from "@/components/time";
import { formatBitrate, ticksToDuration } from "@/lib/format";
import type { SessionView } from "@/lib/sessions/view";
import { sendMessageAction, stopPlaybackAction } from "@/app/(admin)/sessions/actions";

const methodTone = { direct: "green", remux: "blue", transcode: "amber" } as const;

export function PlayMethodBadge({ s }: { s: SessionView }) {
  if (!s.playMethod) return null;
  const title = s.playMethod === "transcode" ? s.transcodeReasons.join(", ") || "transcoding" : undefined;
  return (
    <Badge tone={methodTone[s.playMethod]} title={title}>
      {s.playMethod}
    </Badge>
  );
}

export function SessionsTable({ sessions, showUser = true, returnTo }: { sessions: SessionView[]; showUser?: boolean; returnTo: string }) {
  const cols = showUser ? 7 : 6;
  return (
    <Table>
      <thead>
        <tr>
          {showUser ? <Th>User</Th> : null}
          <Th>Client</Th>
          <Th>Device</Th>
          <Th>Now playing</Th>
          <Th>Method</Th>
          <Th>Last activity</Th>
          <Th className="text-right">Actions</Th>
        </tr>
      </thead>
      <tbody>
        {sessions.length === 0 ? <EmptyRow colSpan={cols}>No active sessions.</EmptyRow> : null}
        {sessions.map((s) => (
          <tr key={s.id}>
            {showUser ? (
              <Td>{s.userId ? <Link href={`/users/${s.userId}`}>{s.userName ?? s.userId}</Link> : <span className="text-fg-subtle">—</span>}</Td>
            ) : null}
            <Td>
              {s.client ?? "—"}
              {s.appVersion ? <div className="text-xs text-fg-subtle">{s.appVersion}</div> : null}
            </Td>
            <Td>
              {s.deviceName ?? "—"}
              {s.remoteEndPoint ? <div className="text-xs text-fg-subtle">{s.remoteEndPoint}</div> : null}
            </Td>
            <Td>
              {s.nowPlaying ? (
                <div>
                  <div className="font-medium">
                    {s.nowPlaying.title}
                    {s.nowPlaying.isPaused ? <Badge className="ml-1">paused</Badge> : null}
                  </div>
                  {s.nowPlaying.subtitle ? <div className="text-xs text-fg-muted">{s.nowPlaying.subtitle}</div> : null}
                  <div className="text-xs text-fg-subtle">
                    {ticksToDuration(s.nowPlaying.positionTicks)}
                    {s.nowPlaying.runTimeTicks ? ` / ${ticksToDuration(s.nowPlaying.runTimeTicks)}` : ""}
                  </div>
                </div>
              ) : (
                <span className="text-fg-subtle">idle</span>
              )}
            </Td>
            <Td>
              <PlayMethodBadge s={s} />
              {s.playMethod === "transcode" ? (
                <div className="text-xs text-fg-muted">
                  {[s.videoCodec, s.audioCodec, s.container, s.resolution, formatBitrate(s.bitrate)].filter(Boolean).join(" · ")}
                  {s.transcodeReasons.length ? <div>{s.transcodeReasons.join(", ")}</div> : null}
                </div>
              ) : null}
            </Td>
            <Td>
              <Time date={s.lastActivity} />
            </Td>
            <Td className="text-right">
              <div className="flex flex-col items-end gap-1">
                {s.nowPlaying ? (
                  <form action={stopPlaybackAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SubmitButton size="sm" variant="secondary">
                      Stop
                    </SubmitButton>
                  </form>
                ) : null}
                <details className="text-left">
                  <summary className="cursor-pointer text-xs text-fg-muted hover:underline">Message</summary>
                  <form action={sendMessageAction} className="mt-1 flex gap-1">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Input name="text" placeholder="Message text" required maxLength={500} width="auto" className="w-48" aria-label="Message text" />
                    <SubmitButton size="sm">Send</SubmitButton>
                  </form>
                </details>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
