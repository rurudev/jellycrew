import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Flash messages travel in the URL so plain server-action forms can report results after redirect. */
export function withNotice(path: string, notice: { ok?: string; error?: string }): string {
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  if (notice.ok) url.searchParams.set("ok", notice.ok);
  if (notice.error) url.searchParams.set("error", notice.error);
  return `${url.pathname}${url.search}`;
}

/**
 * Redirects with a flash message; the toast reader in the layout shows it and cleans the URL.
 * `revalidate` lists the paths whose cached render must be refreshed first.
 */
export function redirectWithNotice(path: string, notice: { ok?: string; error?: string }, options: { revalidate?: string[] } = {}): never {
  for (const p of options.revalidate ?? []) revalidatePath(p);
  redirect(withNotice(path, notice));
}

export function safeReturnTo(value: FormDataEntryValue | null | undefined, fallback: string): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
