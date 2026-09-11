import { env } from "@/lib/env";
import { ensureDeviceId } from "@/lib/settings";
import { call, createJellyfinClient, type JellyfinClient } from "./client";
import {
  AuthenticationResultSchema,
  SystemInfoSchema,
  UserDtoSchema,
  UserListSchema,
  type ValidatedAuthResult,
  type ValidatedSystemInfo,
  type ValidatedUser,
} from "./schemas";

export * from "./client";
export * from "./schemas";
export * from "./version";

declare global {
  var __jellycrewJellyfin: JellyfinClient | undefined;
}

/** Server-wide client authenticated with the API key. */
export function jellyfin(): JellyfinClient {
  if (!globalThis.__jellycrewJellyfin) {
    const e = env();
    globalThis.__jellycrewJellyfin = createJellyfinClient({
      baseUrl: e.JELLYFIN_URL,
      token: e.JELLYFIN_API_KEY,
      deviceId: ensureDeviceId(),
    });
  }
  return globalThis.__jellycrewJellyfin;
}

/** Client with no token, for AuthenticateByName and public info. */
export function jellyfinAnonymous(): JellyfinClient {
  const e = env();
  return createJellyfinClient({ baseUrl: e.JELLYFIN_URL, deviceId: ensureDeviceId() });
}

export function resetJellyfinClient(): void {
  globalThis.__jellycrewJellyfin = undefined;
}

// ---- Typed, validated reads used by the service layer ----

export async function fetchSystemInfo(): Promise<ValidatedSystemInfo> {
  const data = await call("GetSystemInfo", () => jellyfin().GET("/System/Info"));
  return SystemInfoSchema.parse(data);
}

export async function fetchPublicSystemInfo(): Promise<ValidatedSystemInfo> {
  const data = await call("GetPublicSystemInfo", () => jellyfinAnonymous().GET("/System/Info/Public"));
  return SystemInfoSchema.parse(data);
}

export async function fetchUsers(): Promise<ValidatedUser[]> {
  const data = await call("GetUsers", () => jellyfin().GET("/Users"));
  return UserListSchema.parse(data);
}

export async function fetchUser(userId: string): Promise<ValidatedUser> {
  const data = await call("GetUserById", () =>
    jellyfin().GET("/Users/{userId}", { params: { path: { userId } } }),
  );
  return UserDtoSchema.parse(data);
}

/**
 * Authenticates a user with their own credentials. Returns the session token Jellyfin
 * issued; callers that only need identity verification should log that session out again.
 */
export async function authenticateByName(username: string, password: string): Promise<ValidatedAuthResult> {
  const data = await call("AuthenticateUserByName", () =>
    jellyfinAnonymous().POST("/Users/AuthenticateByName", { body: { Username: username, Pw: password } }),
  );
  return AuthenticationResultSchema.parse(data);
}

/** Ends the session belonging to a user token obtained from authenticateByName. */
export async function logoutSession(sessionToken: string): Promise<void> {
  const e = env();
  const client = createJellyfinClient({ baseUrl: e.JELLYFIN_URL, deviceId: ensureDeviceId(), token: sessionToken });
  await call("ReportSessionEnded", () => client.POST("/Sessions/Logout"));
}
