import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { Time } from "@/components/time";
import type { DeviceView } from "@/lib/services/devices";
import { revokeDeviceAction } from "@/app/(admin)/sessions/actions";

export function DevicesTable({ devices, showUser = true, returnTo }: { devices: DeviceView[]; showUser?: boolean; returnTo: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Device</Th>
          <Th>App</Th>
          {showUser ? <Th>Last user</Th> : null}
          <Th>Last used</Th>
          <Th className="text-right">Actions</Th>
        </tr>
      </thead>
      <tbody>
        {devices.length === 0 ? <EmptyRow colSpan={showUser ? 5 : 4}>No devices.</EmptyRow> : null}
        {devices.map((d) => (
          <tr key={d.id}>
            <Td>
              {d.name}
              <div className="text-xs text-muted-foreground">
                <code>{d.id}</code>
              </div>
            </Td>
            <Td>
              {d.appName ?? "—"}
              {d.appVersion ? <span className="text-muted-foreground"> {d.appVersion}</span> : null}
            </Td>
            {showUser ? <Td>{d.lastUserId ? <Link href={`/users/${d.lastUserId}`}>{d.lastUserName ?? d.lastUserId}</Link> : "—"}</Td> : null}
            <Td>
              <Time date={d.lastActivity} />
            </Td>
            <Td className="text-right">
              <form action={revokeDeviceAction}>
                <input type="hidden" name="deviceId" value={d.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton size="sm" variant="destructive" title="Signs the device out and revokes its tokens">
                  Revoke
                </SubmitButton>
              </form>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
