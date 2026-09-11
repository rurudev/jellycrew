import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { NavLink } from "@/components/shell/nav-link";
import { ServerStatusAlerts, ServerStatusFallback, ServerStatusItem } from "@/components/shell/server-status";
import { SkipLink } from "@/components/shell/skip-link";
import { NoticeToast } from "@/components/ui/notice-toast";
import { Toaster } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme-server";
import { logoutAction } from "./actions";

const nav: Array<{ href: string; label: string }> = [
  { href: "/users", label: "Users" },
  { href: "/profiles", label: "Profiles" },
  { href: "/invites", label: "Invites" },
  { href: "/sessions", label: "Sessions" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const [session, theme] = await Promise.all([requireAdmin(), getTheme()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SkipLink />
      <header className="border-b bg-card">
        <div className="mx-auto flex h-11 max-w-7xl items-stretch gap-4 px-4 md:px-6">
          <Link href="/" className="flex shrink-0 items-center text-sm font-semibold">
            jellycrew
          </Link>
          {/* Scrolls sideways on narrow screens instead of wrapping or overflowing the page. */}
          <nav aria-label="Sections" className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <Suspense fallback={<ServerStatusFallback />}>
              <ServerStatusItem />
            </Suspense>
            <span className="hidden lg:inline">{session.userName}</span>
            <ThemeToggle theme={theme} />
            <form action={logoutAction}>
              <SubmitButton variant="ghost" size="sm" aria-label="Sign out">
                <LogOutIcon data-icon="inline-start" />
                <span className="hidden sm:inline">Sign out</span>
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 outline-none md:px-6 md:py-6">
        <Suspense fallback={null}>
          <ServerStatusAlerts />
        </Suspense>
        {children}
      </main>
      <Toaster theme={theme ?? "system"} closeButton position="bottom-right" />
      <Suspense fallback={null}>
        <NoticeToast />
      </Suspense>
    </div>
  );
}
