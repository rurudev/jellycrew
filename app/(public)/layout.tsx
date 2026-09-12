import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { publicServerName } from "@/lib/public/server-name";
import { getTheme } from "@/lib/theme-server";

/** Guests see the server they are joining, not the tool that manages it. */
export async function generateMetadata(): Promise<Metadata> {
  const serverName = await publicServerName();
  return { title: { default: serverName, template: `%s · ${serverName}` } };
}

/** The guest surface: the server's own name, one column, larger type than the console. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [theme, serverName] = await Promise.all([getTheme(), publicServerName()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <span className="truncate font-medium">{serverName}</span>
          <ThemeToggle theme={theme} compact />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 text-base">{children}</main>
      <footer className="mx-auto w-full max-w-xl px-4 pb-8 text-sm text-muted-foreground">Runs on Jellyfin. Your account lives on this server only.</footer>
    </div>
  );
}
