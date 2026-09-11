import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getServerStatus } from "@/lib/services/system";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const session = await requireAdmin();
  const [status, theme] = await Promise.all([getServerStatus(), getTheme()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2">
          <Link href="/" className="font-semibold">
            jellycrew
          </Link>
          <nav className="flex gap-4 text-zinc-600 dark:text-zinc-300">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-zinc-900 dark:hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            <span title={status.reachable ? `Jellyfin ${status.version}` : status.error}>
              {status.serverName ?? "Jellyfin"} {status.version ? `· ${status.version}` : "· unreachable"}
            </span>
            <span>{session.userName}</span>
            <ThemeToggle theme={theme} />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4">
        {status.reachable && !status.compatible ? (
          <Alert tone="warning" title="Jellyfin version mismatch">
            This server runs Jellyfin {status.version}; jellycrew is tested against {status.targetVersion}. Policy fields may differ.
          </Alert>
        ) : null}
        {!status.reachable ? (
          <Alert tone="error" title="Jellyfin is unreachable">
            {status.error}
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}
