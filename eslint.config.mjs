import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Routes, pages and actions never talk to Jellyfin directly: every call goes
    // through lib/services so that writes are audited in one place.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/jellyfin/*", "@/lib/jellyfin", "**/lib/jellyfin/*"],
              message: "Use lib/services/* instead of calling the Jellyfin client directly.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/jellyfin/generated/**",
    "drizzle/**",
  ]),
]);

export default eslintConfig;
