import pino, { type Logger } from "pino";

const level = process.env.LOG_LEVEL ?? "info";

function build(): Logger {
  const pretty = process.env.LOG_PRETTY === "1";
  return pino({
    level,
    base: { app: "jellycrew" },
    redact: {
      paths: [
        "req.headers.authorization",
        "headers.authorization",
        "*.authorization",
        "*.password",
        "*.Pw",
        "*.NewPw",
        "*.CurrentPw",
        "*.token",
        "*.apiKey",
        "*.AccessToken",
      ],
      censor: "[redacted]",
    },
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
  });
}

declare global {
  var __jellycrewLogger: Logger | undefined;
}

export const logger: Logger = globalThis.__jellycrewLogger ?? (globalThis.__jellycrewLogger = build());

export function logWithRequest(requestId: string | undefined): Logger {
  return requestId ? logger.child({ requestId }) : logger;
}
