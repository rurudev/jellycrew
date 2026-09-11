import { Suspense, type ReactNode } from "react";
import { NoticeToast } from "@/components/ui/notice-toast";
import { Toaster } from "@/components/ui/sonner";
import { getTheme } from "@/lib/theme-server";

/** Self-service is the only guest route whose actions report back with notices. */
export default async function MeLayout({ children }: { children: ReactNode }) {
  const theme = await getTheme();
  return (
    <>
      {children}
      <Toaster theme={theme ?? "system"} closeButton position="bottom-right" />
      <Suspense fallback={null}>
        <NoticeToast />
      </Suspense>
    </>
  );
}
