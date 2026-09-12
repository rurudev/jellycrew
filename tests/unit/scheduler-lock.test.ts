import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The scheduler only touches the database, so a throw-away file is enough.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jellycrew-lock-"));
process.env.JELLYFIN_URL = "http://localhost:8096";
process.env.JELLYFIN_API_KEY = "not-used-by-these-tests";
process.env.PUBLIC_BASE_URL = "http://localhost:3000";
process.env.SESSION_SECRET = "unit-test-secret-that-is-long-enough-0123456789";
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";
process.env.JELLYCREW_DISABLE_SCHEDULER = "1";

type Deferred = { promise: Promise<void>; resolve: () => void };
function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let runJob: typeof import("@/lib/services/scheduler").runJob;
let getDb: typeof import("@/lib/db").getDb;
let closeDb: typeof import("@/lib/db").closeDb;
let jobRun: typeof import("@/lib/db/schema").jobRun;

beforeAll(async () => {
  ({ runJob } = await import("@/lib/services/scheduler"));
  ({ getDb, closeDb } = await import("@/lib/db"));
  ({ jobRun } = await import("@/lib/db/schema"));
});

afterAll(() => {
  closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function row(name: string) {
  return getDb().select().from(jobRun).where(eq(jobRun.name, name)).get();
}

describe("runJob", () => {
  it("refuses a second run while the first holds the lease", async () => {
    const gate = deferred();
    const first = runJob("one", async () => {
      await gate.promise;
      return "first";
    });
    const second = await runJob("one", async () => "second");
    expect(second).toBeNull();
    gate.resolve();
    expect(await first).toBe("first");
    expect(row("one")?.lockUntil).toBeNull();
    expect(row("one")?.runId).toBeNull();
  });

  it("records the result and frees the lock when the job throws", async () => {
    await expect(
      runJob("two", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = row("two");
    expect(after?.lockUntil).toBeNull();
    expect(after?.lastResult).toMatchObject({ ok: false, error: "boom" });
  });

  it("does not let an overrun run clear the lease of the run that replaced it", async () => {
    const gate = deferred();
    const overrunning = runJob("three", async () => {
      await gate.promise;
      return "overrun";
    });
    // The lease expires while the first run is still working, so the next tick takes over.
    getDb().update(jobRun).set({ lockUntil: new Date(Date.now() - 1000) }).where(eq(jobRun.name, "three")).run();
    const takeoverGate = deferred();
    const takeover = runJob("three", async () => {
      await takeoverGate.promise;
      return "takeover";
    });
    const heldByTakeover = row("three");
    expect(heldByTakeover?.runId).toBeTruthy();

    // The overrun run finishes last. Its release must not touch the new owner's lease.
    gate.resolve();
    expect(await overrunning).toBe("overrun");
    const stillHeld = row("three");
    expect(stillHeld?.runId).toBe(heldByTakeover?.runId);
    expect(stillHeld?.lockUntil).not.toBeNull();

    takeoverGate.resolve();
    expect(await takeover).toBe("takeover");
    expect(row("three")?.lockUntil).toBeNull();
    expect(row("three")?.lastResult).toMatchObject({ ok: true });
  });
});
