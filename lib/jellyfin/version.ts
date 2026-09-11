/** The Jellyfin release this app is built and tested against. Bump together with lib/jellyfin/openapi.json. */
export const JELLYFIN_TARGET_VERSION = "10.11.11";
export const JELLYFIN_IMAGE = `jellyfin/jellyfin:${JELLYFIN_TARGET_VERSION}`;

export function majorMinor(version: string | null | undefined): string | null {
  if (!version) return null;
  const m = /^(\d+)\.(\d+)/.exec(version.trim());
  return m ? `${m[1]}.${m[2]}` : null;
}

/** True when the live server shares major.minor with the pinned target. */
export function isCompatibleVersion(liveVersion: string | null | undefined): boolean {
  const live = majorMinor(liveVersion);
  return live !== null && live === majorMinor(JELLYFIN_TARGET_VERSION);
}
