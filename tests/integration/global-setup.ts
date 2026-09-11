import type { TestProject } from "vitest/node";
import type { StartedTestContainer } from "testcontainers";
import { resolveDockerHost } from "./harness/docker";
import { bootstrapJellyfin, containerUrl, startJellyfinContainer, type JellyfinTestServer } from "./harness/jellyfin";

declare module "vitest" {
  export interface ProvidedContext {
    jellyfin: JellyfinTestServer;
  }
}

export default async function setup(project: TestProject) {
  resolveDockerHost();
  const started = Date.now();
  let container: StartedTestContainer | undefined;
  let server: JellyfinTestServer;
  if (process.env.TEST_JELLYFIN_URL && process.env.TEST_JELLYFIN_API_KEY && process.env.TEST_JELLYFIN_ADMIN_ID) {
    // Reuse an already-bootstrapped server (local iteration).
    server = {
      url: process.env.TEST_JELLYFIN_URL,
      apiKey: process.env.TEST_JELLYFIN_API_KEY,
      admin: {
        name: process.env.TEST_JELLYFIN_ADMIN ?? "admin",
        password: process.env.TEST_JELLYFIN_ADMIN_PASSWORD ?? "admin-password-1",
        id: process.env.TEST_JELLYFIN_ADMIN_ID,
      },
    };
  } else {
    container = await startJellyfinContainer();
    server = await bootstrapJellyfin(containerUrl(container));
  }
  console.log(`[integration] Jellyfin ready at ${server.url} in ${Date.now() - started}ms`);
  project.provide("jellyfin", server);
  return async () => {
    await container?.stop();
  };
}
