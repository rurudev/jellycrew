import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme-server";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const theme = await getTheme();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
          <span className="font-semibold">jellycrew</span>
          <ThemeToggle theme={theme} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
