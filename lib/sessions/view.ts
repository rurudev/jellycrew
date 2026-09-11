import type { ValidatedSession } from "@/lib/jellyfin/schemas";
import { parseDate } from "@/lib/format";

export type PlayMethodLabel = "direct" | "remux" | "transcode";

export interface NowPlayingView {
  title: string;
  subtitle: string | null;
  type: string | null;
  positionTicks: number;
  runTimeTicks: number | null;
  isPaused: boolean;
}

export interface SessionView {
  id: string;
  userId: string | null;
  userName: string | null;
  client: string | null;
  deviceName: string | null;
  deviceId: string | null;
  appVersion: string | null;
  remoteEndPoint: string | null;
  lastActivity: Date | null;
  nowPlaying: NowPlayingView | null;
  playMethod: PlayMethodLabel | null;
  transcodeReasons: string[];
  bitrate: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  resolution: string | null;
  supportsRemoteControl: boolean;
}

export const ZERO_GUID = /^0{32}$|^0{8}-0{4}-0{4}-0{4}-0{12}$/;

export function playMethodLabel(method: string | null | undefined): PlayMethodLabel | null {
  switch (method) {
    case "DirectPlay":
      return "direct";
    case "DirectStream":
      return "remux";
    case "Transcode":
      return "transcode";
    default:
      return null;
  }
}

export function describeNowPlaying(item: NonNullable<ValidatedSession["NowPlayingItem"]>): { title: string; subtitle: string | null } {
  const name = item.Name ?? "Unknown";
  if (item.Type === "Episode" && item.SeriesName) {
    const num =
      item.ParentIndexNumber != null && item.IndexNumber != null
        ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} `
        : "";
    return { title: item.SeriesName, subtitle: `${num}${name}` };
  }
  if (item.Type === "Audio") {
    const artist = item.Artists?.length ? item.Artists.join(", ") : null;
    return { title: name, subtitle: [artist, item.Album].filter(Boolean).join(" · ") || null };
  }
  return { title: name, subtitle: item.ProductionYear ? String(item.ProductionYear) : null };
}

export function toSessionView(s: ValidatedSession): SessionView {
  const item = s.NowPlayingItem ?? null;
  const t = s.TranscodingInfo ?? null;
  const described = item ? describeNowPlaying(item) : null;
  return {
    id: s.Id ?? "",
    userId: s.UserId && !ZERO_GUID.test(s.UserId) ? s.UserId : null,
    userName: s.UserName ?? null,
    client: s.Client ?? null,
    deviceName: s.DeviceName ?? null,
    deviceId: s.DeviceId ?? null,
    appVersion: s.ApplicationVersion ?? null,
    remoteEndPoint: s.RemoteEndPoint ?? null,
    lastActivity: parseDate(s.LastActivityDate),
    nowPlaying:
      item && described
        ? {
            title: described.title,
            subtitle: described.subtitle,
            type: item.Type ?? null,
            positionTicks: s.PlayState?.PositionTicks ?? 0,
            runTimeTicks: item.RunTimeTicks ?? null,
            isPaused: s.PlayState?.IsPaused ?? false,
          }
        : null,
    playMethod: item ? playMethodLabel(s.PlayState?.PlayMethod) : null,
    transcodeReasons: t?.TranscodeReasons ?? [],
    bitrate: t?.Bitrate ?? null,
    videoCodec: t?.VideoCodec ?? null,
    audioCodec: t?.AudioCodec ?? null,
    container: t?.Container ?? null,
    resolution: t?.Width && t?.Height ? `${t.Width}×${t.Height}` : null,
    supportsRemoteControl: s.SupportsRemoteControl ?? false,
  };
}

export interface SessionSummary {
  sessions: number;
  streams: number;
  transcodes: number;
  users: number;
}

export function summarizeSessions(sessions: SessionView[]): SessionSummary {
  const users = new Set(sessions.map((s) => s.userId).filter((u): u is string => !!u));
  return {
    sessions: sessions.length,
    streams: sessions.filter((s) => s.nowPlaying).length,
    transcodes: sessions.filter((s) => s.playMethod === "transcode").length,
    users: users.size,
  };
}
