// No "use client" here on purpose (shadcn ships one): the kit is server-safe and every table on
// every page would otherwise become a client boundary. The one interactive piece, LinkRow, lives
// in components/ui/link-row.tsx.
import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

/**
 * shadcn Table, tuned for the console: 36 px rows (cells stretch for taller content), 13 px cells
 * that wrap unless a cell opts into `whitespace-nowrap`, quiet 12 px headers, horizontal scrolling
 * when a table is wider than its container, and a bordered surface when the table stands on its
 * own (`variant="card"`). Inside a Section use `variant="plain"`.
 */
function Table({ className, variant = "card", ...props }: React.ComponentProps<"table"> & { variant?: "card" | "plain" }) {
  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-x-auto", variant === "card" && "rounded-lg border bg-card")}>
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("relative border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-primary/10", className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground [&:has([type=checkbox])]:w-8 [&:has([type=checkbox])]:pr-0", className)}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("h-9 px-3 py-1.5 align-middle [&:has([type=checkbox])]:pr-0", className)} {...props} />
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
}

/** A sortable column header: a real link (the sort lives in the URL) with `aria-sort` and a direction icon. */
function SortHead({
  label,
  active,
  dir,
  href,
  className,
}: {
  label: React.ReactNode
  active: boolean
  dir: "asc" | "desc"
  href: string
  className?: string
}) {
  const Icon = active ? (dir === "asc" ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon
  return (
    <TableHead aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={className}>
      {/* Fills the cell so the whole header is the target, not just the word. */}
      <Link href={href} className={cn("-mx-3 flex h-9 items-center gap-1 px-3 hover:text-foreground", active && "text-foreground")}>
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </Link>
    </TableHead>
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, SortHead }
