import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { NoticeToast } from "@/components/ui/notice-toast";
import { Toaster } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme-server";
import { logoutAction } from "./actions";
import { ServerStatusAlerts, ServerStatusItem } from "./server-status";

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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2">
          <Link href="/" className="font-semibold">
            jellycrew
          </Link>
          <nav className="flex gap-4 text-muted-foreground">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <Suspense fallback={<span>Jellyfin</span>}>
              <ServerStatusItem />
            </Suspense>
            <span>{session.userName}</span>
            <ThemeToggle theme={theme} />
            <form action={logoutAction}>
              <SubmitButton variant="ghost" size="sm">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4">
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
