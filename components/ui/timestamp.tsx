import { absoluteTime, relativeTime } from "@/lib/format";

/**
 * A point in time as relative text ("3 days ago"), with the absolute UTC time on hover.
 * On detail pages pass `absolute` to show it inline as well, so it is reachable without a mouse.
 */
export function Timestamp({ date, never = "never", absolute = false, title }: { date: Date | string | null | undefined; never?: string; absolute?: boolean; /** Replaces the default tooltip (the absolute time). */ title?: string }) {
  if (!date) return <span className="text-muted-foreground" title={title}>{never}</span>;
  const abs = absoluteTime(date);
  return (
    <time dateTime={typeof date === "string" ? date : date.toISOString()} title={title ?? abs}>
      {relativeTime(date)}
      {absolute ? <span className="text-muted-foreground"> · {abs}</span> : null}
    </time>
  );
}
