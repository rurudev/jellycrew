/**
 * Starts a disposable Jellyfin container for local development, runs the first-time
 * wizard and creates an API key. Prints the env lines to put in .env.local.
 *
 *   pnpm tsx scripts/dev-jellyfin.ts            # port 8096
 *   PORT=18096 pnpm tsx scripts/dev-jellyfin.ts
 *
 * Stop it with `docker rm -f jellycrew-dev-jellyfin`.
 */
import { execFileSync } from "node:child_process";
import { JELLYFIN_IMAGE } from "../lib/jellyfin/version";
import { bootstrapJellyfin } from "../tests/integration/harness/jellyfin";

const NAME = "jellycrew-dev-jellyfin";
const port = Number(process.env.PORT ?? 8096);

async function waitForApi(url: string) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/System/Info/Public`);
      if (res.ok && (await res.text()).includes('"Version"')) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Jellyfin did not become ready");
}

async function main() {
  execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
  execFileSync("docker", ["run", "-d", "--name", NAME, "-p", `${port}:8096`, JELLYFIN_IMAGE], { stdio: "ignore" });
  const url = `http://localhost:${port}`;
  await waitForApi(url);
  const server = await bootstrapJellyfin(url, "jellycrew-dev");
  console.log(`# Jellyfin ${JELLYFIN_IMAGE} running as ${NAME}`);
  console.log(`# admin login: ${server.admin.name} / ${server.admin.password}`);
  console.log(`JELLYFIN_URL=${server.url}`);
  console.log(`JELLYFIN_API_KEY=${server.apiKey}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
