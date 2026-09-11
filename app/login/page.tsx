import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getServerStatus } from "@/lib/services/system";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme-server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getAdminSession();
  if (session) redirect("/");
  const search = await props.searchParams;
  const next = typeof search.next === "string" ? search.next : undefined;
  const [status, theme] = await Promise.all([getServerStatus(), getTheme()]);
  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      <div className="absolute top-3 right-3">
        <ThemeToggle theme={theme} />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold">jellycrew</h1>
          <p className="text-zinc-500">
            Sign in with a Jellyfin administrator account
            {status.serverName ? (
              <>
                {" "}
                for <span className="font-medium text-zinc-700 dark:text-zinc-300">{status.serverName}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        {!status.reachable ? <Alert tone="error" title="Jellyfin is unreachable">{status.error}</Alert> : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
