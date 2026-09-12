import "server-only";
import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isStillActiveUser, isStillAdmin } from "./still-valid";

export const ADMIN_COOKIE = "jellycrew_admin";
export const ADMIN_TTL_SECONDS = 12 * 60 * 60;
export const SELF_COOKIE = "jellycrew_me";
export const SELF_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AdminSession {
  kind: "admin";
  userId: string;
  userName: string;
  issuedAt: number;
}

export interface SelfSession {
  kind: "self";
  userId: string;
  userName: string;
  issuedAt: number;
}

function cookieOptions(ttl: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env().PUBLIC_BASE_URL.startsWith("https://"),
    path: "/",
    maxAge: ttl,
  };
}

export async function sealSession(data: AdminSession | SelfSession, ttl: number): Promise<string> {
  return sealData(data, { password: env().SESSION_SECRET, ttl });
}

export async function unsealSession<T extends AdminSession | SelfSession>(
  value: string | undefined,
  kind: T["kind"],
  ttl: number,
): Promise<T | null> {
  if (!value) return null;
  try {
    const data = await unsealData<Partial<T>>(value, { password: env().SESSION_SECRET, ttl });
    if (!data || data.kind !== kind || typeof data.userId !== "string") return null;
    return data as T;
  } catch {
    return null;
  }
}

/**
 * The signed-in administrator, or null. The cookie is only the claim: Jellyfin is asked whether
 * that account is still an enabled administrator, so demoting or deleting someone there ends
 * their access here too. The answer is cached briefly, and a short grace period covers a
 * Jellyfin that is momentarily unreachable.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const claim = await unsealSession<AdminSession>(store.get(ADMIN_COOKIE)?.value, "admin", ADMIN_TTL_SECONDS);
  if (!claim) return null;
  return (await isStillAdmin(claim.userId)) ? claim : null;
}

/** For server components and actions in the admin area. Redirects to /login when not signed in. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}

export async function setAdminSession(session: Omit<AdminSession, "kind" | "issuedAt">): Promise<void> {
  const store = await cookies();
  const value = await sealSession({ kind: "admin", issuedAt: Date.now(), ...session }, ADMIN_TTL_SECONDS);
  store.set(ADMIN_COOKIE, value, cookieOptions(ADMIN_TTL_SECONDS));
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** The signed-in user, or null. An account disabled since sign-in no longer has a session. */
export async function getSelfSession(): Promise<SelfSession | null> {
  const store = await cookies();
  const claim = await unsealSession<SelfSession>(store.get(SELF_COOKIE)?.value, "self", SELF_TTL_SECONDS);
  if (!claim) return null;
  return (await isStillActiveUser(claim.userId)) ? claim : null;
}

export async function setSelfSession(session: Omit<SelfSession, "kind" | "issuedAt">): Promise<void> {
  const store = await cookies();
  const value = await sealSession({ kind: "self", issuedAt: Date.now(), ...session }, SELF_TTL_SECONDS);
  store.set(SELF_COOKIE, value, cookieOptions(SELF_TTL_SECONDS));
}

export async function clearSelfSession(): Promise<void> {
  const store = await cookies();
  store.delete(SELF_COOKIE);
}

/** Cookie attributes for route handlers that set the self-service cookie on a Response. */
export function selfCookieHeader(value: string): string {
  const o = cookieOptions(SELF_TTL_SECONDS);
  return `${SELF_COOKIE}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
}

export function clearSelfCookieHeader(): string {
  return `${SELF_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
