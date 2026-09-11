import { inject } from "vitest";
import { call, createJellyfinClient } from "@/lib/jellyfin/client";
import type { JellyfinTestServer } from "./harness/jellyfin";

export function testServer(): JellyfinTestServer {
  return inject("jellyfin");
}

/** Raw API-key client for test setup and assertions that bypass the app's service layer. */
export function rawClient() {
  const jf = testServer();
  return createJellyfinClient({ baseUrl: jf.url, deviceId: "jellycrew-test-raw", token: jf.apiKey });
}

let counter = 0;
export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

/** Creates a plain Jellyfin user directly (test fixture, not through the app). */
export async function createRawUser(name: string, password = "password-1234") {
  const user = await call("CreateUserByName", () => rawClient().POST("/Users/New", { body: { Name: name, Password: password } }));
  if (!user.Id) throw new Error("user creation returned no id");
  return { id: user.Id, name, password };
}

export async function deleteRawUser(userId: string): Promise<void> {
  await call("DeleteUser", () => rawClient().DELETE("/Users/{userId}", { params: { path: { userId } } }));
}
