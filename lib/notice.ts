/** Flash messages travel in the URL so plain server-action forms can report results after redirect. */
export function withNotice(path: string, notice: { ok?: string; error?: string }): string {
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  if (notice.ok) url.searchParams.set("ok", notice.ok);
  if (notice.error) url.searchParams.set("error", notice.error);
  return `${url.pathname}${url.search}`;
}

export function safeReturnTo(value: FormDataEntryValue | null | undefined, fallback: string): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
