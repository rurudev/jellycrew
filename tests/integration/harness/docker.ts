import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * testcontainers reads DOCKER_HOST or the default socket paths; it does not consult
 * `docker context`. Fill DOCKER_HOST in from the active context (Colima, Docker Desktop,
 * Podman) so the suite works wherever the docker CLI works.
 */
export function resolveDockerHost(): void {
  if (process.env.DOCKER_HOST || process.env.TESTCONTAINERS_HOST_OVERRIDE) return;
  if (fs.existsSync("/var/run/docker.sock")) return;
  try {
    const host = execFileSync("docker", ["context", "inspect", "-f", "{{.Endpoints.docker.Host}}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (host) {
      process.env.DOCKER_HOST = host;
      // Ryuk (the reaper) bind-mounts the daemon socket. With a VM-based runtime such as
      // Colima the host path is a tunnel; inside the VM the socket lives at the default path.
      if (host.startsWith("unix://") && !process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE) {
        process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
      }
    }
  } catch {
    // Leave it to testcontainers' own strategies.
  }
}
