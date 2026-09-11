export interface ProtectionSubject {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
}

export type ProtectedAction = "disable" | "delete" | "demote";

export type ProtectionVerdict = { allowed: true } | { allowed: false; reason: string };

const verbs: Record<ProtectedAction, string> = {
  disable: "disable",
  delete: "delete",
  demote: "remove administrator rights from",
};

/**
 * The app refuses to disable, delete, or demote the currently signed-in admin, and refuses
 * the same for an administrator when no other enabled administrator would remain.
 */
export function checkProtection(all: ProtectionSubject[], targetId: string, actorId: string | null, action: ProtectedAction): ProtectionVerdict {
  const target = all.find((u) => u.id === targetId);
  if (!target) return { allowed: true };
  if (actorId !== null && target.id === actorId) {
    return { allowed: false, reason: `You cannot ${verbs[action]} your own account.` };
  }
  if (target.isAdmin) {
    const otherEnabledAdmins = all.filter((u) => u.isAdmin && !u.isDisabled && u.id !== target.id);
    if (otherEnabledAdmins.length === 0) {
      return { allowed: false, reason: `Refusing to ${verbs[action]} ${target.name}: no other enabled administrator would remain.` };
    }
  }
  return { allowed: true };
}

export class ProtectionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProtectionError";
  }
}

export function assertAllowed(verdict: ProtectionVerdict): void {
  if (!verdict.allowed) throw new ProtectionError(verdict.reason);
}
