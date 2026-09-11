import "server-only";
import { cookies } from "next/headers";
import { sealData, unsealData } from "iron-session";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

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

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return unsealSession<AdminSession>(store.get(ADMIN_COOKIE)?.value, "admin", ADMIN_TTL_SECONDS);
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
