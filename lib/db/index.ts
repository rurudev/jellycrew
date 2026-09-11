import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "@/lib/env";
import { logger } from "@/lib/log";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/** Open (creating if needed) a SQLite database in WAL mode and apply pending migrations. */
export function openDb(file: string): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as Db;
}

declare global {
  var __jellycrewDb: Db | undefined;
}

export function dbPath(): string {
  return path.join(env().DATA_DIR, "app.db");
}

/** Process-wide database handle. Migrations run on first use. */
export function getDb(): Db {
  if (!globalThis.__jellycrewDb) {
    const file = dbPath();
    logger.info({ file }, "opening database");
    globalThis.__jellycrewDb = openDb(file);
  }
  return globalThis.__jellycrewDb;
}

export function closeDb(): void {
  if (globalThis.__jellycrewDb) {
    globalThis.__jellycrewDb.$client.close();
    globalThis.__jellycrewDb = undefined;
  }
}

export { schema };
