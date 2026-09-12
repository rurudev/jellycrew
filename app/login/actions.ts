"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setAdminSession } from "@/lib/auth/session";
import { PUBLIC_LIMITS, RateLimitedError, UNKNOWN_IP, checkLimits, ipLimit, recordAttempts } from "@/lib/ratelimit";
import { currentRequestId } from "@/lib/request-context";
import { LoginError, loginAdmin } from "@/lib/services/auth";
import { hashToken } from "@/lib/tokens";

const LoginForm = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginForm.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { username, password, next } = parsed.data;
  const head = await headers();
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() || head.get("x-real-ip")?.trim() || UNKNOWN_IP;
  // The console is the highest-privilege door in the app, so it gets the guard the self-service
  // login has had. Only failures count: an attacker hammering a known username must not be able
  // to lock the real administrator out of the one way back in.
  const limits = [
    ...ipLimit(`admin-login:ip:${ip}`, ip, PUBLIC_LIMITS.loginPerIp),
    { key: `admin-login:user:${hashToken(username.toLowerCase())}`, ...PUBLIC_LIMITS.loginPerIp },
  ];
  try {
    checkLimits(limits);
    const identity = await loginAdmin(username, password, await currentRequestId());
    await setAdminSession({ userId: identity.userId, userName: identity.userName });
  } catch (err) {
    if (err instanceof RateLimitedError) return { error: "Too many attempts. Wait a minute and try again." };
    if (err instanceof LoginError) {
      recordAttempts(limits);
      return { error: err.message };
    }
    throw err;
  }
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
