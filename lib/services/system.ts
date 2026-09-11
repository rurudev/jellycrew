import { APP_VERSION } from "@/lib/env";
import { JELLYFIN_TARGET_VERSION, fetchSystemInfo, isCompatibleVersion } from "@/lib/jellyfin";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/log";

export interface ServerStatus {
  reachable: boolean;
  serverName: string | null;
  version: string | null;
  compatible: boolean;
  targetVersion: string;
  error?: string;
}

/** Live Jellyfin status. Never throws: unreachable servers are reported, not raised. */
export async function getServerStatus(): Promise<ServerStatus> {
  try {
    const info = await fetchSystemInfo();
    return {
      reachable: true,
      serverName: info.ServerName ?? null,
      version: info.Version ?? null,
      compatible: isCompatibleVersion(info.Version),
      targetVersion: JELLYFIN_TARGET_VERSION,
    };
  } catch (err) {
    logger.warn({ err }, "jellyfin status check failed");
    return {
      reachable: false,
      serverName: null,
      version: null,
      compatible: false,
      targetVersion: JELLYFIN_TARGET_VERSION,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface HealthReport {
  status: "ok" | "degraded";
  app: { name: string; version: string; uptimeSeconds: number };
  database: { ok: boolean; error?: string };
  jellyfin: ServerStatus;
}

export async function getHealth(): Promise<HealthReport> {
  let database: HealthReport["database"];
  try {
    getDb().run(sql`select 1`);
    database = { ok: true };
  } catch (err) {
    database = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const jellyfin = await getServerStatus();
  return {
    status: database.ok && jellyfin.reachable ? "ok" : "degraded",
    app: { name: "jellycrew", version: APP_VERSION, uptimeSeconds: Math.round(process.uptime()) },
    database,
    jellyfin,
  };
}
