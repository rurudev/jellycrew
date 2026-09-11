import { describe, expect, it } from "vitest";
import { describeNowPlaying, playMethodLabel, summarizeSessions, toSessionView } from "./view";

describe("session view", () => {
  it("maps play methods", () => {
    expect(playMethodLabel("DirectPlay")).toBe("direct");
    expect(playMethodLabel("DirectStream")).toBe("remux");
    expect(playMethodLabel("Transcode")).toBe("transcode");
    expect(playMethodLabel(undefined)).toBeNull();
  });

  it("describes episodes, music and movies", () => {
    expect(describeNowPlaying({ Type: "Episode", Name: "Pilot", SeriesName: "Show", ParentIndexNumber: 1, IndexNumber: 2 })).toEqual({ title: "Show", subtitle: "S01E02 Pilot" });
    expect(describeNowPlaying({ Type: "Audio", Name: "Song", Artists: ["A", "B"], Album: "Alb" })).toEqual({ title: "Song", subtitle: "A, B · Alb" });
    expect(describeNowPlaying({ Type: "Movie", Name: "Film", ProductionYear: 1999 })).toEqual({ title: "Film", subtitle: "1999" });
  });

  it("converts a raw session and drops the zero user id", () => {
    const v = toSessionView({
      Id: "s1",
      UserId: "00000000000000000000000000000000",
      Client: "Web",
      DeviceId: "d1",
      NowPlayingItem: { Name: "Film", Type: "Movie", RunTimeTicks: 600_000_000 },
      PlayState: { PositionTicks: 300_000_000, PlayMethod: "Transcode", IsPaused: true },
      TranscodingInfo: { Bitrate: 4_000_000, VideoCodec: "h264", Width: 1920, Height: 1080, TranscodeReasons: ["VideoCodecNotSupported"] },
    });
    expect(v.userId).toBeNull();
    expect(v.playMethod).toBe("transcode");
    expect(v.nowPlaying?.isPaused).toBe(true);
    expect(v.resolution).toBe("1920×1080");
    expect(v.transcodeReasons).toEqual(["VideoCodecNotSupported"]);
  });

  it("summarizes streams, transcodes and distinct users", () => {
    const a = toSessionView({ Id: "1", UserId: "u1", NowPlayingItem: { Name: "x" }, PlayState: { PlayMethod: "Transcode" } });
    const b = toSessionView({ Id: "2", UserId: "u1" });
    const c = toSessionView({ Id: "3", UserId: "u2", NowPlayingItem: { Name: "y" }, PlayState: { PlayMethod: "DirectPlay" } });
    expect(summarizeSessions([a, b, c])).toEqual({ sessions: 3, streams: 2, transcodes: 1, users: 2 });
  });
});
