import { KeyValue } from "@/components/ui/key-value";
import { Section } from "@/components/ui/section";
import { Timestamp } from "@/components/ui/timestamp";
import type { UserRow } from "@/lib/users/types";

/** Read-only facts: the id, when the user was seen, and what the automation did. */
export function UserFacts({ row }: { row: UserRow }) {
  return (
    <Section title="Facts">
      <KeyValue>
        <KeyValue.Item label="Jellyfin id">
          <code className="text-xs">{row.id}</code>
        </KeyValue.Item>
        <KeyValue.Item label="Last login">
          <Timestamp date={row.lastLogin} absolute />
        </KeyValue.Item>
        <KeyValue.Item label="Last activity">
          <Timestamp date={row.lastActivity} absolute />
        </KeyValue.Item>
        <KeyValue.Item label="First seen by app">
          <Timestamp date={row.meta.firstSeenAt} absolute />
        </KeyValue.Item>
        {row.meta.disabledByAppAt ? (
          <KeyValue.Item label="Disabled by app">
            <Timestamp date={row.meta.disabledByAppAt} absolute /> ({row.meta.disabledReason})
          </KeyValue.Item>
        ) : null}
        <KeyValue.Item label="Deletion">
          {row.meta.deleteAfter ? (
            <>
              scheduled <Timestamp date={row.meta.deleteAfter} absolute />
            </>
          ) : (
            <span className="text-muted-foreground">not scheduled</span>
          )}
        </KeyValue.Item>
      </KeyValue>
    </Section>
  );
}
