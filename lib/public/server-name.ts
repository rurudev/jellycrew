import { cache } from "react";
import { fetchPublicSystemInfo } from "@/lib/jellyfin";

const FALLBACK = "Jellyfin";
/** A guest waiting on a sign-in page must not wait on Jellyfin. */
const TIMEOUT_MS = 2000;

/**
 * The server's own name, for the guest pages. It uses the anonymous endpoint, gives up
 * quickly, and is memoised per request so a layout and its page cost one call between them.
 * Every guest page renders fine without it, so a slow or missing Jellyfin only costs the name.
 */
export const publicServerName = cache(async (): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const info = await Promise.race([
      fetchPublicSystemInfo(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
    return info?.ServerName ?? FALLBACK;
  } catch {
    return FALLBACK;
  } finally {
    if (timer) clearTimeout(timer);
  }
});
