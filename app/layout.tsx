import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getTheme } from "@/lib/theme-server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "jellycrew", template: "%s · jellycrew" },
  description: "User management for Jellyfin",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendered server-side from the preference cookie so the page never flashes the wrong theme.
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme ?? undefined} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-sm">{children}</body>
    </html>
  );
}
