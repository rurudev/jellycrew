import { z } from "zod";
import pkg from "../package.json";

export const APP_NAME = "jellycrew";
export const APP_VERSION: string = pkg.version;

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const stripSlash = (s: string) => s.replace(/\/+$/, "");

export const EnvSchema = z
  .object({
    JELLYFIN_URL: z.url().transform(stripSlash),
    JELLYFIN_API_KEY: z.string().min(1, "JELLYFIN_API_KEY is required"),
    PUBLIC_BASE_URL: z.url().transform(stripSlash),
    DATA_DIR: z.string().min(1).default("./data"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    SMTP_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .refine((e) => !e.SMTP_URL || !!e.SMTP_FROM, {
    message: "SMTP_FROM is required when SMTP_URL is set",
    path: ["SMTP_FROM"],
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parse and validate the process environment once. Throws a readable error on the first bad key. */
export function env(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Test helper: forget the cached environment so the next env() call re-reads process.env. */
export function resetEnv(): void {
  cached = undefined;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
