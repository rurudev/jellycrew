"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setAdminSession } from "@/lib/auth/session";
import { PUBLIC_LIMITS, RateLimitedError, UNKNOWN_IP, enforceLimits, ipLimit } from "@/lib/ratelimit";
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
  try {
    // The console is the highest-privilege door in the app; it gets the same guard the
    // self-service login has had, per address and per username.
    enforceLimits([
      ...ipLimit(`admin-login:ip:${ip}`, ip, PUBLIC_LIMITS.loginPerIp),
      { key: `admin-login:user:${hashToken(username.toLowerCase())}`, ...PUBLIC_LIMITS.loginPerIp },
    ]);
    const identity = await loginAdmin(username, password, await currentRequestId());
    await setAdminSession({ userId: identity.userId, userName: identity.userName });
  } catch (err) {
    if (err instanceof RateLimitedError) return { error: "Too many attempts. Wait a minute and try again." };
    if (err instanceof LoginError) return { error: err.message };
    throw err;
  }
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
