import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Timestamp } from "@/components/ui/timestamp";
import type { DeviceView } from "@/lib/services/devices";
import { revokeDeviceAction } from "@/app/(admin)/sessions/actions";

export type DeviceColumn = "device" | "app" | "lastUser" | "lastUsed" | "actions";
export const DEVICE_COLUMNS: readonly DeviceColumn[] = ["device", "app", "lastUser", "lastUsed", "actions"];

export function DevicesTable({ devices, columns = DEVICE_COLUMNS, returnTo, variant = "card" }: { devices: DeviceView[]; /** Which columns to show; a user's own page leaves out `lastUser`. */ columns?: readonly DeviceColumn[]; returnTo: string; /** `plain` inside a Section. */ variant?: "card" | "plain" }) {
  const showUser = columns.includes("lastUser");
  return (
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          <TableHead>Device</TableHead>
          <TableHead>App</TableHead>
          {showUser ? <TableHead>Last user</TableHead> : null}
          <TableHead>Last used</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.length === 0 ? <EmptyState.Row colSpan={showUser ? 5 : 4} title="No devices" description="Devices are recorded the first time a client signs in." /> : null}
        {devices.map((d) => (
          <TableRow key={d.id}>
            <TableCell>
              {d.name}
              <div className="text-xs text-muted-foreground">
                <code>{d.id}</code>
              </div>
            </TableCell>
            <TableCell>
              {d.appName ?? "—"}
              {d.appVersion ? <span className="text-muted-foreground"> {d.appVersion}</span> : null}
            </TableCell>
            {showUser ? <TableCell>{d.lastUserId ? <Link href={`/users/${d.lastUserId}`}>{d.lastUserName ?? d.lastUserId}</Link> : "—"}</TableCell> : null}
            <TableCell>
              <Timestamp date={d.lastActivity} />
            </TableCell>
            <TableCell className="text-right">
              <form action={revokeDeviceAction}>
                <input type="hidden" name="deviceId" value={d.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton size="sm" variant="destructive" title="Signs the device out and revokes its tokens">
                  Revoke
                </SubmitButton>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
