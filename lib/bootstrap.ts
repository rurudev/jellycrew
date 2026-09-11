import { APP_VERSION, env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/log";
import { ensureDeviceId } from "@/lib/settings";
import { getServerStatus } from "@/lib/services/system";

/** Runs once at server start: validates env, migrates the database, checks Jellyfin. */
export async function bootstrap(): Promise<void> {
  const e = env();
  getDb();
  const deviceId = ensureDeviceId();
  logger.info({ version: APP_VERSION, dataDir: e.DATA_DIR, jellyfinUrl: e.JELLYFIN_URL, deviceId }, "jellycrew starting");
  const status = await getServerStatus();
  if (!status.reachable) {
    logger.warn({ error: status.error }, "Jellyfin is not reachable at startup; will retry per request");
  } else if (!status.compatible) {
    logger.warn(
      { live: status.version, target: status.targetVersion },
      "Jellyfin version differs from the tested target; proceed with care",
    );
  } else {
    logger.info({ serverName: status.serverName, version: status.version }, "connected to Jellyfin");
  }
}
