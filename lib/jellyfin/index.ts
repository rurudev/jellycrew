import { env } from "@/lib/env";
import { ensureDeviceId } from "@/lib/settings";
import { JellyfinError, buildAuthHeader, call, createJellyfinClient, type JellyfinClient } from "./client";
import {
  AuthenticationResultSchema,
  DeviceListSchema,
  MediaFolderListSchema,
  ParentalRatingListSchema,
  SessionListSchema,
  SystemInfoSchema,
  UserDtoSchema,
  UserListSchema,
  type PlaystateCommand,
  type UserDto,
  type UserPolicy,
  type ValidatedAuthResult,
  type ValidatedDevice,
  type ValidatedMediaFolder,
  type ValidatedParentalRating,
  type ValidatedSession,
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

/** Sessions seen by the server within the last `activeWithinSeconds` (Jellyfin's dashboard uses 960). */
export async function fetchSessions(activeWithinSeconds = 960): Promise<ValidatedSession[]> {
  const data = await call("GetSessions", () =>
    jellyfin().GET("/Sessions", { params: { query: { activeWithinSeconds } } }),
  );
  return SessionListSchema.parse(data);
}

export async function fetchDevices(userId?: string): Promise<ValidatedDevice[]> {
  const data = await call("GetDevices", () =>
    jellyfin().GET("/Devices", { params: { query: userId ? { userId } : {} } }),
  );
  return DeviceListSchema.parse(data).Items ?? [];
}

export async function fetchMediaFolders(): Promise<ValidatedMediaFolder[]> {
  const data = await call("GetMediaFolders", () => jellyfin().GET("/Library/MediaFolders"));
  return MediaFolderListSchema.parse(data).Items ?? [];
}

export async function fetchParentalRatings(): Promise<ValidatedParentalRating[]> {
  const data = await call("GetParentalRatings", () => jellyfin().GET("/Localization/ParentalRatings"));
  return ParentalRatingListSchema.parse(data);
}

/** Proxies a user's primary image. Returns null when the user has none. */
export async function fetchUserImage(userId: string, tag?: string): Promise<Response | null> {
  const e = env();
  const url = new URL(`${e.JELLYFIN_URL}/UserImage`);
  url.searchParams.set("userId", userId);
  if (tag) url.searchParams.set("tag", tag);
  const res = await fetch(url, {
    headers: { Authorization: buildAuthHeader({ deviceId: ensureDeviceId(), token: e.JELLYFIN_API_KEY }) },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new JellyfinError("GetUserImage", res.status, await res.text());
  return res;
}

// ---- Writes. Only lib/services/* may call these, and each caller audits. ----

export async function sendPlaystateCommand(sessionId: string, command: PlaystateCommand): Promise<void> {
  await call("SendPlaystateCommand", () =>
    jellyfin().POST("/Sessions/{sessionId}/Playing/{command}", { params: { path: { sessionId, command } } }),
  );
}

export async function sendMessageCommand(
  sessionId: string,
  message: { text: string; header?: string; timeoutMs?: number },
): Promise<void> {
  await call("SendMessageCommand", () =>
    jellyfin().POST("/Sessions/{sessionId}/Message", {
      params: { path: { sessionId } },
      body: { Text: message.text, Header: message.header ?? null, TimeoutMs: message.timeoutMs ?? null },
    }),
  );
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await call("DeleteDevice", () => jellyfin().DELETE("/Devices", { params: { query: { id: deviceId } } }));
}

/** Replaces the whole policy. Callers must have fetched it first (read-modify-write). */
export async function updateUserPolicy(userId: string, policy: Record<string, unknown>): Promise<void> {
  await call("UpdateUserPolicy", () =>
    jellyfin().POST("/Users/{userId}/Policy", { params: { path: { userId } }, body: policy as unknown as UserPolicy }),
  );
}

/** Updates the user DTO (name and other top-level fields). Send the object just fetched, modified. */
export async function updateUser(userId: string, dto: ValidatedUser): Promise<void> {
  await call("UpdateUser", () =>
    jellyfin().POST("/Users", { params: { query: { userId } }, body: dto as unknown as UserDto }),
  );
}

/** Sets a new password. With the API key no current password is needed. */
export async function setUserPasswordRaw(userId: string, newPassword: string): Promise<void> {
  await call("UpdateUserPassword", () =>
    jellyfin().POST("/Users/Password", { params: { query: { userId } }, body: { NewPw: newPassword, ResetPassword: false } }),
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await call("DeleteUser", () => jellyfin().DELETE("/Users/{userId}", { params: { path: { userId } } }));
}

/** Creates a user with a password. Jellyfin validates the name and returns 400 on conflicts. */
export async function createUserRaw(name: string, password: string): Promise<ValidatedUser> {
  const data = await call("CreateUserByName", () => jellyfin().POST("/Users/New", { body: { Name: name, Password: password } }));
  return UserDtoSchema.parse(data);
}
