import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getServerStatus } from "@/lib/services/system";
import { Callout } from "@/components/ui/callout";
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
    <main className="relative flex flex-1 items-center justify-center p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle theme={theme} compact />
      </div>
      <div className="w-full max-w-sm space-y-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">jellycrew</h1>
          <p className="text-muted-foreground">
            Sign in with a Jellyfin administrator account
            {status.serverName ? (
              <>
                {" "}
                for <span className="font-medium text-foreground">{status.serverName}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        {!status.reachable ? (
          <Callout tone="error" title="Jellyfin is unreachable">
            {status.error ?? "Check that the server is running and that JELLYFIN_URL points at it."}
          </Callout>
        ) : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
