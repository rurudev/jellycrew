import { describe, expect, it } from "vitest";
import { formatBitrate, relativeTime, ticksToDuration } from "./format";

const now = new Date("2026-09-11T12:00:00Z");

describe("format", () => {
  it("renders relative times", () => {
    expect(relativeTime(null, now)).toBe("never");
    expect(relativeTime(new Date(now.getTime() - 10_000), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() - 3 * 60_000), now)).toBe("3 minutes ago");
    expect(relativeTime(new Date(now.getTime() - 5 * 3600_000), now)).toBe("5 hours ago");
    expect(relativeTime(new Date(now.getTime() - 3 * 86400_000), now)).toBe("3 days ago");
    expect(relativeTime(new Date(now.getTime() + 2 * 86400_000), now)).toBe("in 2 days");
    expect(relativeTime("garbage", now)).toBe("unknown");
  });
  it("formats ticks and bitrates", () => {
    expect(ticksToDuration(0)).toBe("0:00");
    expect(ticksToDuration(90 * 10_000_000)).toBe("1:30");
    expect(ticksToDuration(3725 * 10_000_000)).toBe("1:02:05");
    expect(formatBitrate(4_500_000)).toBe("4.5 Mbps");
    expect(formatBitrate(320_000)).toBe("320 kbps");
  });
});
