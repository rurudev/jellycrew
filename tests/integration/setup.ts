import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, inject } from "vitest";

// Runs once per test file (each file has its own worker): point the app at the shared
// Jellyfin container and a private, throw-away SQLite database.
const jf = inject("jellyfin");
const mailpit = inject("mailpit");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jellycrew-test-"));

process.env.JELLYFIN_URL = jf.url;
process.env.JELLYFIN_API_KEY = jf.apiKey;
process.env.PUBLIC_BASE_URL = "http://localhost:3000";
process.env.DATA_DIR = dataDir;
process.env.SESSION_SECRET = "integration-test-secret-that-is-long-enough-0123456789";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "warn";
process.env.SMTP_URL = mailpit.smtpUrl;
process.env.SMTP_FROM = "Jellyfin Test <noreply@test.local>";
process.env.JELLYCREW_DISABLE_SCHEDULER = "1";

afterAll(async () => {
  const { closeDb } = await import("@/lib/db");
  closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
