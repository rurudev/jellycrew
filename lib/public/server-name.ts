import { cache } from "react";
import { getServerStatus } from "@/lib/services/system";

/** The server's own name, for the guest pages. Memoised so a layout and its page cost one probe. */
export const publicServerName = cache(async (): Promise<string> => (await getServerStatus()).serverName ?? "Jellyfin");
