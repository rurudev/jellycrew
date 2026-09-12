import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobRun, type JobRun } from "@/lib/db/schema";
import { logger } from "@/lib/log";
import { recordAudit, SYSTEM_ACTOR } from "./audit";
import { runLifecycle } from "./lifecycle";

export const LIFECYCLE_JOB = "lifecycle";
export const LIFECYCLE_INTERVAL_MS = 15 * 60 * 1000;
/**
 * The lease a run holds, kept short and extended by a heartbeat while the run is alive. A slow
 * pass therefore never loses its lock to the next tick, and a process that dies mid-run frees
 * the job within one lease instead of holding it for as long as the pass might have taken.
 */
export const LOCK_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const START_DELAY_MS = 30 * 1000;

if (LOCK_MS < 3 * HEARTBEAT_MS) throw new Error("The job lease must outlast several heartbeats, or a live run loses its own lock.");

/**
 * Runs `fn` under a database lock so that only one process (or one HMR instance) runs a job at
 * a time. Returns null when the lock is held by someone else. The lock carries a run id: the
 * release is conditional on it, so a run that overran cannot clear the lease of the run that
 * replaced it.
 */
export async function runJob<T>(name: string, fn: () => Promise<T>, now: Date = new Date()): Promise<T | null> {
  const db = getDb();
  const runId = randomUUID();
  db.insert(jobRun).values({ name }).onConflictDoNothing().run();
  const acquired = db
    .update(jobRun)
    .set({ lockUntil: new Date(now.getTime() + LOCK_MS), lastStartedAt: now, runId })
    .where(and(eq(jobRun.name, name), or(isNull(jobRun.lockUntil), lt(jobRun.lockUntil, now))))
    .run();
  if (acquired.changes === 0) {
    logger.info({ job: name }, "job lock held elsewhere; skipping");
    return null;
  }

  const heartbeat = setInterval(() => {
    const extended = db
      .update(jobRun)
      .set({ lockUntil: new Date(Date.now() + LOCK_MS) })
      .where(and(eq(jobRun.name, name), eq(jobRun.runId, runId)))
      .run();
    // Lost the lease to a takeover: stop extending and let the other run own the row.
    if (extended.changes === 0) clearInterval(heartbeat);
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  let result: T | undefined;
  let error: unknown;
  try {
    result = await fn();
  } catch (err) {
    error = err;
  } finally {
    clearInterval(heartbeat);
  }

  const released = db
    .update(jobRun)
    .set({
      lockUntil: null,
      runId: null,
      lastFinishedAt: new Date(),
      lastResult: error ? { ok: false, error: error instanceof Error ? error.message : String(error) } : { ok: true, ...(result as object) },
    })
    .where(and(eq(jobRun.name, name), eq(jobRun.runId, runId)))
    .run();
  if (released.changes === 0) logger.warn({ job: name, runId }, "job finished after its lease was taken over; result not recorded");
  if (error) throw error;
  return result as T;
}

export function getJobStatus(name: string): JobRun | undefined {
  return getDb().select().from(jobRun).where(eq(jobRun.name, name)).get();
}

export async function runLifecycleJob(now: Date = new Date()) {
  return runJob(
    LIFECYCLE_JOB,
    async () => {
      const result = await runLifecycle(now);
      logger.info({ job: LIFECYCLE_JOB, ...result }, "lifecycle run finished");
      if (result.disabled.length || result.deleted.length || result.errors.length) {
        recordAudit({ actor: SYSTEM_ACTOR, action: "lifecycle.run", detail: result });
      }
      return result;
    },
    now,
  );
}

declare global {
  var __jellycrewScheduler: ReturnType<typeof setInterval> | undefined;
}

/** Starts the in-process 15-minute scheduler once per process. */
export function startScheduler(): void {
  if (globalThis.__jellycrewScheduler) return;
  const tick = () => {
    runLifecycleJob().catch((err) => logger.error({ err }, "lifecycle job failed"));
  };
  setTimeout(tick, START_DELAY_MS).unref();
  globalThis.__jellycrewScheduler = setInterval(tick, LIFECYCLE_INTERVAL_MS);
  globalThis.__jellycrewScheduler.unref();
  logger.info({ intervalMs: LIFECYCLE_INTERVAL_MS }, "scheduler started");
}

export function stopScheduler(): void {
  if (globalThis.__jellycrewScheduler) clearInterval(globalThis.__jellycrewScheduler);
  globalThis.__jellycrewScheduler = undefined;
}
