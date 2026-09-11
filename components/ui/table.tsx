"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

/**
 * shadcn Table, tuned for the console: 36 px rows (cells stretch for taller content), 13 px cells, quiet 12 px headers that stay
 * put while the page scrolls on wide screens, and a bordered surface when the table stands on
 * its own (`variant="card"`). Inside a Section use `variant="plain"`.
 */
function Table({ className, variant = "card", ...props }: React.ComponentProps<"table"> & { variant?: "card" | "plain" }) {
  return (
    <div data-slot="table-container" className={cn("relative w-full max-md:overflow-x-auto", variant === "card" && "rounded-lg border bg-card")}>
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("z-10 bg-card md:sticky md:top-0 [&_tr]:border-b", className)} {...props} />
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
  return <td data-slot="table-cell" className={cn("h-9 px-3 py-1.5 align-middle whitespace-nowrap [&:has([type=checkbox])]:pr-0", className)} {...props} />
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
      <Link href={href} className={cn("inline-flex items-center gap-1 rounded-sm hover:text-foreground", active && "text-foreground")}>
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </Link>
    </TableHead>
  )
}

/**
 * A row that opens `href` when clicked anywhere that is not itself interactive, while the
 * first cell keeps a real link for the keyboard, middle-click and screen readers. Nothing is
 * overlaid, so tooltips and buttons inside the row keep working.
 */
function LinkRow({ href, className, onClick, ...props }: React.ComponentProps<"tr"> & { href: string }) {
  const router = useRouter()
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label, summary, [role=button]")) return
        if (window.getSelection()?.toString()) return
        router.push(href)
      }}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, SortHead, LinkRow }
