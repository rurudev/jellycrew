import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Timestamp } from "@/components/ui/timestamp";
import type { DeviceView } from "@/lib/services/devices";
import { revokeDeviceAction } from "@/app/(admin)/sessions/actions";

export type DeviceColumn = "device" | "app" | "lastUser" | "lastUsed" | "actions";
export const DEVICE_COLUMNS: readonly DeviceColumn[] = ["device", "app", "lastUser", "lastUsed", "actions"];

const COLUMNS: Record<DeviceColumn, { head: string; className?: string; cell: (d: DeviceView, returnTo: string) => ReactNode }> = {
  device: {
    head: "Device",
    className: "max-w-64",
    cell: (d) => (
      <>
        <div className="truncate">{d.name || <span className="text-muted-foreground">unnamed</span>}</div>
        {/* Some clients report an id hundreds of characters long, so it is shown in one line. */}
        <code className="block truncate text-xs text-muted-foreground" title={d.id}>
          {d.id}
        </code>
      </>
    ),
  },
  app: {
    head: "App",
    cell: (d) => (
      <>
        {d.appName ?? "—"}
        {d.appVersion ? <span className="text-muted-foreground"> {d.appVersion}</span> : null}
      </>
    ),
  },
  lastUser: {
    head: "Last user",
    cell: (d) => (d.lastUserId ? <Link href={`/users/${d.lastUserId}`}>{d.lastUserName ?? d.lastUserId}</Link> : "—"),
  },
  lastUsed: {
    head: "Last used",
    cell: (d) => <Timestamp date={d.lastActivity} />,
  },
  actions: {
    head: "Actions",
    className: "text-right",
    cell: (d, returnTo) => (
      <ConfirmDialog
        label="Revoke"
        size="sm"
        variant="outline"
        title={`Revoke ${d.name}?`}
        description="Signs this device out and invalidates its tokens. Whoever uses it has to sign in again; nothing else changes."
        confirmLabel="Revoke device"
        action={revokeDeviceAction}
        hidden={{ deviceId: d.id, returnTo }}
      />
    ),
  },
};

export function DevicesTable({ devices, columns = DEVICE_COLUMNS, returnTo, variant = "card" }: { devices: DeviceView[]; /** Which columns to show, in order; a user's own page leaves out `lastUser`. */ columns?: readonly DeviceColumn[]; returnTo: string; /** `plain` inside a Section. */ variant?: "card" | "plain" }) {
  return (
    <Table variant={variant}>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c} className={COLUMNS[c].className}>
              {COLUMNS[c].head}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.length === 0 ? <EmptyState.Row colSpan={columns.length} title="No devices" description="Devices are recorded the first time a client signs in." /> : null}
        {devices.map((d) => (
          <TableRow key={d.id}>
            {columns.map((c) => (
              <TableCell key={c} className={COLUMNS[c].className}>
                {COLUMNS[c].cell(d, returnTo)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
