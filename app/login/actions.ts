"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setAdminSession } from "@/lib/auth/session";
import { currentRequestId } from "@/lib/request-context";
import { LoginError, loginAdmin } from "@/lib/services/auth";

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
  try {
    const identity = await loginAdmin(username, password, await currentRequestId());
    await setAdminSession({ userId: identity.userId, userName: identity.userName });
  } catch (err) {
    if (err instanceof LoginError) return { error: err.message };
    throw err;
  }
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
