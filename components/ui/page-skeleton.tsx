import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shapes for `loading.tsx`: static blocks in the layout the page will take. */

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 min-w-48 flex-1" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-6 border-b px-3 py-2.5">
          {[24, 16, 20, 20, 16].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-3 py-2 last:border-0">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

/** A detail page: main column plus a rail from 1024 px, the grid the user and profile pages use. */
export function DetailSkeleton({ main = 4, rail = 5 }: { /** Sections in the main column. */ main?: number; /** Sections in the rail. */ rail?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {Array.from({ length: main }).map((_, i) => (
            <SectionSkeleton key={i} lines={4 + ((i * 3) % 6)} />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: rail }).map((_, i) => (
            <SectionSkeleton key={i} lines={3 + ((i * 5) % 7)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The policy editor: a jump list beside a column of grouped field cards. */
export function EditorSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-6" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-56" />
          </div>
          <SectionSkeleton lines={4} />
          <SectionSkeleton lines={6} />
          <SectionSkeleton lines={5} />
        </div>
      </div>
    </div>
  );
}

