# Decisions

One line per decision, newest at the bottom. See SPEC.md for the requirements these serve.

## Stage 1 — Foundation

- App name is `jellycrew` (package, image, cookie prefix `jellycrew_`, MediaBrowser `Client="jellycrew"`); the spec's working name `jfusers` is not used.
- Jellyfin target is pinned to `10.11.11` in `lib/jellyfin/version.ts`; the OpenAPI snapshot (`lib/jellyfin/openapi.json`) and generated types are committed and regenerated with `pnpm jellyfin:gen`, which starts the pinned image if `JELLYFIN_URL` is not set.
- Typed client is `openapi-typescript` + `openapi-fetch` (not `@jellyfin/sdk`) so the types always come from the exact server version we test against.
- All Jellyfin access lives in `lib/jellyfin/*` (transport + zod validation) and `lib/services/*` (behaviour + audit); an ESLint `no-restricted-imports` rule forbids `app/**` and `components/**` from importing `lib/jellyfin` directly.
- Zod response schemas are loose objects: only the fields the app relies on are validated, everything else passes through untouched for read-modify-write.
- Timestamps are stored as integer epoch milliseconds (`timestamp_ms`) so drizzle returns `Date` objects; JSON columns use drizzle's `json` mode.
- The `token` table has an extra `email` column (not in the spec's list) so an email-verification token remembers which address it verifies.
- Admin login verifies credentials with `AuthenticateByName` and immediately logs that Jellyfin session out again; the app never stores user tokens, only the API key from the environment.
- Sessions are `iron-session` sealed cookies (`jellycrew_admin` 12 h, `jellycrew_me` 30 d), `HttpOnly`, `SameSite=Lax`, `Secure` when `PUBLIC_BASE_URL` is https.
- Request ids are minted in `proxy.ts` (`x-request-id`, honouring an incoming header) and read via `next/headers` where needed; audit rows store them.
- `proxy.ts` only checks for the presence of the admin cookie and redirects to `/login`; real session validation happens in the admin layout and inside every server action.
- `/healthz` returns 200 whenever the app and its database work, and reports Jellyfin reachability/version in the body (`status: degraded` when Jellyfin is down) so a Jellyfin outage does not make Docker restart this container.
- Env is validated lazily with zod on first use (`lib/env.ts`), never at module load, so `next build` needs no environment.
- Startup work (migrations, device id, Jellyfin check) runs from `instrumentation.ts` → `lib/bootstrap.ts`; migrations also run on first `getDb()` so tests and scripts need no extra step.
- Integration tests share one Jellyfin container per run (vitest `globalSetup` + `provide`/`inject`), run files sequentially, and give every file its own temporary `DATA_DIR`. Set `TEST_JELLYFIN_URL`, `TEST_JELLYFIN_API_KEY`, `TEST_JELLYFIN_ADMIN_ID` to reuse a running server instead.
- The Jellyfin readiness wait uses `/System/Info/Public` returning JSON (not `/health`, which answers 200 while startup migrations still serve an HTML placeholder).
- `tests/integration/harness/docker.ts` derives `DOCKER_HOST` from the active `docker context` and sets `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` for VM-based runtimes (Colima, Docker Desktop, Podman), since testcontainers does not read contexts.
- UI primitives are hand-written Tailwind components in `components/ui` instead of the shadcn CLI, to keep the dependency surface small; shadcn remains allowed if a richer widget is needed later.
- `pnpm test` runs both vitest projects (`unit`, `integration`); the integration project needs Docker.
- Development machine runs Node 24; the project targets Node 22 (`.nvmrc`, `engines`, Docker image). No Node-24-only APIs are used.

## Stage 2 — Users read path and sessions

- The users table, filters and sort live entirely in the URL (`lib/users/query.ts`); filtering and sorting happen in memory after one `GET /Users` because Jellyfin offers no server-side query for these fields.
- Session and device counts come from `GET /Sessions?activeWithinSeconds=960` (the same window Jellyfin's dashboard uses) and `GET /Devices`; sessions from the app's own device id or with the all-zero user id (API-key calls) are filtered out.
- The session list is the only cross-request cache (10 s, in-process, `lib/services/sessions.ts`); mutations invalidate it.
- User avatars are proxied through `/users/[id]/avatar` with the API key server-side; the browser never talks to Jellyfin.
- The policy field catalog (`lib/policy/fields.ts`) is the single source for grouping, labels, help text, value kind and profile/user scope; a unit test fails when the OpenAPI `UserPolicy` schema gains or loses a field.
- Result messages after server-action forms travel as `?ok=`/`?error=` query params (rendered by `components/notice.tsx`), which keeps forms progressive-enhancement friendly without client state.
- The global sessions page re-renders through `router.refresh()` every 10 s from a tiny client component that pauses while the tab is hidden; no JSON API is exposed for it.
- `/` redirects to `/users`; server and app health details will live on the settings page (stage 4) rather than a dashboard.
