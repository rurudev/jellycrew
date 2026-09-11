/**
 * Completes the first-run wizard of a running Jellyfin server and prints an API key.
 * Used by scripts/compose-check.sh against the docker-compose.ci.yml Jellyfin service.
 *
 *   pnpm tsx scripts/bootstrap-jellyfin.ts http://localhost:28096
 */
import { bootstrapJellyfin } from "../tests/integration/harness/jellyfin";

async function main() {
  const url = process.argv[2] ?? "http://localhost:28096";
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/System/Info/Public`);
      if (res.ok && (await res.text()).includes('"Version"')) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const server = await bootstrapJellyfin(url, "jellycrew-ci");
  process.stdout.write(server.apiKey + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
