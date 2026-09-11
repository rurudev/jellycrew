import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { currentRequestId } from "@/lib/request-context";
import type { Actor } from "@/lib/services/audit";

/** The audit actor for the signed-in admin of the current request. Redirects to /login when absent. */
export async function adminActor(): Promise<Actor & { userName: string }> {
  const session = await requireAdmin();
  return { type: "admin", id: session.userId, requestId: await currentRequestId(), userName: session.userName };
}
