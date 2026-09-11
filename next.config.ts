import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Native / Node-only packages must not be bundled by Turbopack.
  serverExternalPackages: ["better-sqlite3", "pino", "pino-pretty", "nodemailer"],
};

export default nextConfig;
