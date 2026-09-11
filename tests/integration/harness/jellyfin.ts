import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { JELLYFIN_IMAGE } from "@/lib/jellyfin/version";
import { call, createJellyfinClient } from "@/lib/jellyfin/client";

export interface JellyfinTestServer {
  url: string;
  apiKey: string;
  admin: { name: string; password: string; id: string };
}

export const TEST_ADMIN = { name: "admin", password: "admin-password-1" };
const HARNESS_DEVICE_ID = "jellycrew-test-harness";

/** Starts the pinned Jellyfin image and waits for /health. */
export async function startJellyfinContainer(): Promise<StartedTestContainer> {
  return new GenericContainer(JELLYFIN_IMAGE)
    .withExposedPorts(8096)
    // /health answers 200 while the server still runs its startup migrations and serves an
    // HTML placeholder; the public info endpoint only returns JSON once the API is live.
    .withWaitStrategy(
      Wait.forHttp("/System/Info/Public", 8096)
        .forStatusCode(200)
        .forResponsePredicate((body) => body.includes('"Version"')),
    )
    .withStartupTimeout(180_000)
    .start();
}

export function containerUrl(container: StartedTestContainer): string {
  return `http://${container.getHost()}:${container.getMappedPort(8096)}`;
}

/**
 * Drives the first-run wizard through the /Startup endpoints, then creates an API key
 * with the admin's session token, exactly as an operator would.
 */
export async function bootstrapJellyfin(url: string, serverName = "jellycrew-test"): Promise<JellyfinTestServer> {
  const anon = createJellyfinClient({ baseUrl: url, deviceId: HARNESS_DEVICE_ID });

  await call("UpdateInitialConfiguration", () =>
    anon.POST("/Startup/Configuration", {
      body: { ServerName: serverName, UICulture: "en-US", MetadataCountryCode: "US", PreferredMetadataLanguage: "en" },
    }),
  );
  // Jellyfin requires the GET before the POST to initialise the first user.
  await call("GetFirstUser", () => anon.GET("/Startup/User"));
  await call("UpdateStartupUser", () =>
    anon.POST("/Startup/User", { body: { Name: TEST_ADMIN.name, Password: TEST_ADMIN.password } }),
  );
  await call("SetRemoteAccess", () =>
    anon.POST("/Startup/RemoteAccess", { body: { EnableRemoteAccess: true, EnableAutomaticPortMapping: false } }),
  );
  await call("CompleteWizard", () => anon.POST("/Startup/Complete"));

  const auth = await call("AuthenticateUserByName", () =>
    anon.POST("/Users/AuthenticateByName", { body: { Username: TEST_ADMIN.name, Pw: TEST_ADMIN.password } }),
  );
  if (!auth.AccessToken || !auth.User?.Id) throw new Error("admin authentication returned no token");

  const asAdmin = createJellyfinClient({ baseUrl: url, deviceId: HARNESS_DEVICE_ID, token: auth.AccessToken });
  const appName = "jellycrew-integration";
  await call("CreateKey", () => asAdmin.POST("/Auth/Keys", { params: { query: { app: appName } } }));
  const keys = await call("GetKeys", () => asAdmin.GET("/Auth/Keys"));
  const key = keys.Items?.find((k) => k.AppName === appName)?.AccessToken;
  if (!key) throw new Error("API key was not created");

  return { url, apiKey: key, admin: { ...TEST_ADMIN, id: auth.User.Id } };
}
