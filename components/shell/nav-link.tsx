"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A top-bar section link that knows when it is current: `aria-current` plus the accent underline. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 shrink-0 items-center border-b-2 border-transparent px-0.5 text-sm text-muted-foreground transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:text-foreground focus-visible:outline-offset-[-2px]",
        active && "border-primary text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
