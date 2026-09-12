import { Hint } from "@/components/ui/form-field";
import { KeyValue } from "@/components/ui/key-value";
import { Section } from "@/components/ui/section";
import { StatusDot } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Timestamp } from "@/components/ui/timestamp";
import { lifecycleSummary } from "@/lib/lifecycle/summary";
import { isJobRunning } from "@/lib/services/scheduler";
import type { JobRun } from "@/lib/db/schema";
import { runLifecycleNowAction } from "@/app/(admin)/settings/actions";

/** What the scheduler last did, as a sentence. The full result stays one disclosure away. */
export function AutomationSection({ job, intervalMs, id }: { job: JobRun | undefined; intervalMs: number; id: string }) {
  const summary = lifecycleSummary(job?.lastResult);
  const running = isJobRunning(job);
  const touched = summary ? summary.disabled.length + summary.deleted.length + summary.errors.length : 0;
  return (
    <Section
      id={id}
      title="Automation"
      description={`Every ${Math.round(intervalMs / 60000)} minutes, jellycrew disables accounts that expired or went quiet and deletes the ones past their grace period. Administrators are never touched.`}
    >
      <div className="space-y-4">
        <p className="flex flex-wrap items-center gap-1.5">
          <StatusDot tone={summary ? (summary.tone === "warning" ? "warning" : "success") : "neutral"} />
          {job?.lastFinishedAt && summary ? (
            <span>
              Ran <Timestamp date={job.lastFinishedAt} />: {summary.sentence}.
            </span>
          ) : running ? (
            <span>Running now.</span>
          ) : (
            <span className="text-muted-foreground">It has not run yet. It runs on its own, or you can start it here.</span>
          )}
        </p>

        {touched > 0 && summary ? (
          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer text-muted-foreground">What it touched</summary>
            <div className="mt-2">
              <KeyValue>
                {summary.disabled.length ? <KeyValue.Item label="Disabled">{summary.disabled.map((u) => `${u.name}${u.reason ? ` (${u.reason})` : ""}`).join(", ")}</KeyValue.Item> : null}
                {summary.deleted.length ? <KeyValue.Item label="Deleted">{summary.deleted.map((u) => u.name).join(", ")}</KeyValue.Item> : null}
                {summary.errors.length ? (
                  <KeyValue.Item label="Errors">
                    <ul className="space-y-0.5">
                      {summary.errors.map((e) => (
                        <li key={e.name}>
                          {e.name}: <span className="text-destructive">{e.error}</span>
                        </li>
                      ))}
                    </ul>
                  </KeyValue.Item>
                ) : null}
                {summary.skippedAdmins ? (
                  <KeyValue.Item label="Skipped">
                    {summary.skippedAdmins} administrator{summary.skippedAdmins === 1 ? "" : "s"}
                  </KeyValue.Item>
                ) : null}
              </KeyValue>
            </div>
          </details>
        ) : null}

        <form action={runLifecycleNowAction} className="space-y-1.5">
          <SubmitButton variant="outline" disabled={running} pendingLabel="Running…">
            Run it now
          </SubmitButton>
          {running ? <Hint>A run is already in progress.</Hint> : null}
        </form>
      </div>
    </Section>
  );
}
