import { env } from "@/lib/env";
import { getSettingOrDefault } from "@/lib/settings";

/** Base URL for links sent to invitees and users. */
export function publicBaseUrl(): string {
  return (getSettingOrDefault("publicBaseUrl") ?? env().PUBLIC_BASE_URL).replace(/\/+$/, "");
}

/** The Jellyfin URL to tell people to sign in at. */
export function jellyfinPublicUrl(): string {
  return (getSettingOrDefault("jellyfinPublicUrl") ?? env().JELLYFIN_URL).replace(/\/+$/, "");
}

export function inviteUrl(token: string): string {
  return `${publicBaseUrl()}/invite/${token}`;
}
