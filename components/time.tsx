import { absoluteTime, relativeTime } from "@/lib/format";

/** Relative time with the absolute UTC timestamp on hover. */
export function Time({ date, never = "never" }: { date: Date | string | null | undefined; never?: string }) {
  if (!date) return <span className="text-zinc-400">{never}</span>;
  const abs = absoluteTime(date);
  return (
    <time dateTime={typeof date === "string" ? date : date.toISOString()} title={abs}>
      {relativeTime(date)}
    </time>
  );
}
