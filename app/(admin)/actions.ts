"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, getAdminSession } from "@/lib/auth/session";
import { currentRequestId } from "@/lib/request-context";
import { recordAudit } from "@/lib/services/audit";

export async function logoutAction(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    recordAudit({ actor: { type: "admin", id: session.userId, requestId: await currentRequestId() }, action: "admin.logout", targetUserId: session.userId });
  }
  await clearAdminSession();
  redirect("/login");
}
