/**
 * Regenerates lib/jellyfin/openapi.json and lib/jellyfin/generated/schema.d.ts from a
 * running Jellyfin server: JELLYFIN_URL if set, otherwise a throw-away container of the
 * pinned image. Run after bumping JELLYFIN_TARGET_VERSION.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { JELLYFIN_IMAGE, JELLYFIN_TARGET_VERSION } from "../lib/jellyfin/version";
import { resolveDockerHost } from "../tests/integration/harness/docker";
import { containerUrl, startJellyfinContainer } from "../tests/integration/harness/jellyfin";

async function main() {
  let url = process.env.JELLYFIN_URL;
  let stop: (() => Promise<unknown>) | undefined;
  if (!url) {
    resolveDockerHost();
    console.log(`starting ${JELLYFIN_IMAGE}…`);
    const container = await startJellyfinContainer();
    url = containerUrl(container);
    stop = () => container.stop();
  }
  try {
    const res = await fetch(`${url}/api-docs/openapi.json`);
    if (!res.ok) throw new Error(`spec download failed: HTTP ${res.status}`);
    const spec = (await res.json()) as { info: { version: string } };
    if (spec.info.version !== JELLYFIN_TARGET_VERSION) {
      console.warn(`warning: server reports ${spec.info.version}, target is ${JELLYFIN_TARGET_VERSION}`);
    }
    const specPath = path.join("lib", "jellyfin", "openapi.json");
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
    const outPath = path.join("lib", "jellyfin", "generated", "schema.d.ts");
    execFileSync("pnpm", ["exec", "openapi-typescript", specPath, "-o", outPath], { stdio: "inherit" });
    console.log(`wrote ${specPath} and ${outPath} (Jellyfin ${spec.info.version})`);
  } finally {
    await stop?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
