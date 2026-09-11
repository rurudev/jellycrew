import { fetchUsers } from "@/lib/jellyfin";
import { assertAllowed, checkProtection, type ProtectedAction, type ProtectionSubject } from "@/lib/policy/protection";
import type { Actor } from "./audit";

export function toSubject(u: { Id: string; Name?: string | null; Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean } | null }): ProtectionSubject {
  return { id: u.Id, name: u.Name ?? u.Id, isAdmin: u.Policy?.IsAdministrator ?? false, isDisabled: u.Policy?.IsDisabled ?? false };
}

/** Throws ProtectionError when the action would hit the last enabled admin or the actor themselves. */
export async function assertProtected(actor: Actor, targetId: string, action: ProtectedAction): Promise<void> {
  const users = await fetchUsers();
  assertAllowed(checkProtection(users.map(toSubject), targetId, actor.type === "admin" ? actor.id : null, action));
}
