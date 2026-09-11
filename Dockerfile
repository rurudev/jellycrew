# syntax=docker/dockerfile:1.7
# ---- deps: install with the exact lockfile; build tools only for native modules (better-sqlite3)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ && npm install -g pnpm@12.3.4
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: standalone Next.js output (no env needed at build time)
FROM node:22-alpine AS build
RUN npm install -g pnpm@12.3.4
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runtime: minimal, non-root, /data is the only state
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat && addgroup -S -g 1001 jellycrew && adduser -S -u 1001 -G jellycrew jellycrew
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data
COPY --from=build --chown=jellycrew:jellycrew /app/.next/standalone ./
COPY --from=build --chown=jellycrew:jellycrew /app/.next/static ./.next/static
COPY --from=build --chown=jellycrew:jellycrew /app/public ./public
COPY --from=build --chown=jellycrew:jellycrew /app/drizzle ./drizzle
RUN mkdir -p /data && chown jellycrew:jellycrew /data
USER jellycrew
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "server.js"]
