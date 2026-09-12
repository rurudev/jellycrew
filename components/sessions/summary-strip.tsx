import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: number;
  /** Draws attention when it is not zero, such as transcodes. */
  notable?: boolean;
}

/** The numbers worth knowing before reading the table: what is playing, and how hard. */
export function SummaryStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dd className={cn("text-2xl leading-tight font-semibold tabular-nums", stat.notable && stat.value > 0 ? "text-warning" : undefined)}>{stat.value}</dd>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
