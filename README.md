# jellycrew

Self-hosted user management for a single [Jellyfin](https://jellyfin.org) server. It replaces the Jellyfin dashboard for everything about users: who has access, to what, on what terms, for how long, and what they are doing right now.

Jellyfin stays the source of truth for users, policies, sessions, devices and libraries. jellycrew owns only what Jellyfin cannot: profiles, lifecycle rules, invites, contact details, reset tokens and an audit trail. One container, one SQLite file, one API key.

## What it does

- **Users**: sortable, filterable table with status (enabled, disabled, disabled-by-app with reason, expiring, scheduled for deletion), profile and drift, last login/activity, live sessions and device counts, labels. Multi-select bulk actions with a per-user preview and per-user results.
- **Access editing**: every `UserPolicy` field in a grouped editor with plain-language labels, help text and the raw field name, plus a raw JSON fallback. Saves show a diff first and refuse stale writes (the policy changed on the server meanwhile).
- **Profiles**: reusable sets of profile-managed policy fields (libraries, parental controls, playback, remote access, live TV, content management). Create blank, from a user, or by cloning; assign, apply, adopt; drift shown per field; apply to all members with preview.
- **Safeguards**: administrators are never touched by automation or bulk disable/delete; the last enabled administrator and the signed-in admin cannot be disabled, demoted or deleted; destructive actions need typed confirmation; deletion is two-step (disable now, delete after a grace period).
- **Lifecycle**: expiry dates, inactivity rules (per user or inherited from the profile), scheduled deletion, a 15-minute in-process scheduler with a database lock, every automated change audited as `system`.
- **Sessions**: all live sessions refreshed every 10 s with play method (direct / remux / transcode and why), stop playback, send a message, revoke devices.
- **Invites**: links with expiry, max uses, profile, account expiry and an optional note; public signup page with rate limiting and rollback if the profile cannot be applied.
- **Self-service** (`/me`): sign in with Jellyfin credentials, change password (current password verified first), see sessions and devices, revoke devices, add and verify an email address.
- **Password reset**: `/reset` sends a single-use one-hour link to a verified address (identical response whether or not the account exists); admins can generate links by hand without SMTP.
- **Audit**: every write, by admin, self-service user, invite or the scheduler, with before/after values, filters and CSV/JSON export.

Tested against Jellyfin **10.11.11**. The UI warns when the live server runs another major.minor.

## First run

1. Create an API key in Jellyfin: *Dashboard → API Keys → +*. This key has administrator rights; keep it in the environment only.
2. Copy `docker-compose.example.yml` to `docker-compose.yml`, set the hostnames, and provide the environment (an `.env` file next to it works):

   ```env
   JELLYFIN_API_KEY=...            # from step 1
   SESSION_SECRET=$(openssl rand -hex 32)
   SMTP_URL=smtp://user:pass@mail.example.com:587   # optional
   SMTP_FROM="Jellyfin <noreply@example.com>"       # required when SMTP_URL is set
   ```

3. `docker compose up -d`. The app migrates its database on start and reports `GET /healthz`. If it exits with `Invalid environment`, the log lists exactly which variables are missing or malformed.
4. Open the **admin** hostname and sign in with any Jellyfin administrator account (jellycrew has no password store of its own).
5. Create a profile, assign users, create an invite. Check *Settings* for the scheduler status, grace period, minimum password length and the SMTP test.

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `JELLYFIN_URL` | yes | Jellyfin as reachable from the container, e.g. `http://jellyfin:8096` |
| `JELLYFIN_API_KEY` | yes | Administrator API key. Never logged, never sent to the browser |
| `PUBLIC_BASE_URL` | yes | Public URL of jellycrew, used in invite and reset links (`https://users.example.com`) |
| `SESSION_SECRET` | yes | ≥ 32 random characters; signs session cookies and invite links |
| `DATA_DIR` | no | Directory of `app.db`; `/data` in the image |
| `SMTP_URL` | no | `smtp://` or `smtps://` URL; enables verification and reset mail |
| `SMTP_FROM` | with SMTP | Sender address |
| `LOG_LEVEL` | no | `fatal`…`trace`, default `info` |

## Exposure model

jellycrew serves two audiences from one container and the example compose file gives them two Traefik routers:

- **Admin UI** (`/`, `/users`, `/profiles`, `/sessions`, `/invites`, `/audit`, `/settings`, `/login`): only on an internal hostname that resolves on your LAN or VPN. Do not publish it.
- **Public self-service** on the public hostname, limited to `/invite/*`, `/reset*`, `/me*`, `/api/public/*`, `/healthz` and the static assets under `/_next/static`. Every other path on that hostname is simply not routed.

The public endpoints are rate-limited per IP and per token inside the app; the example adds a Traefik rate limit as a second layer. Session cookies are `HttpOnly`, `SameSite=Lax` and `Secure` when `PUBLIC_BASE_URL` is `https`. Admin sessions last 12 hours, self-service sessions 30 days.

## Backup and restore

All state is `app.db` (plus `app.db-wal` / `app.db-shm` while running) in the `/data` volume. Either:

```bash
# consistent online copy with the sqlite3 CLI (WAL-safe)
docker compose exec jellycrew node -e "require('better-sqlite3')('/data/app.db').backup('/data/backup.db').then(()=>console.log('ok'))"
docker compose cp jellycrew:/data/backup.db ./jellycrew-$(date +%F).db
```

or stop the container and snapshot the volume. Restore by putting the file back as `/data/app.db` (remove stale `-wal`/`-shm` files) and starting the container. Losing the database loses profiles, invites, lifecycle settings and the audit log; Jellyfin's users and policies are unaffected.

`SESSION_SECRET` is part of the state too: invite links stored in the database are sealed with it, so keep it with the backup.

## Upgrades

1. Read `DECISIONS.md` and the release notes for the target version.
2. Back up (above).
3. Pull the new image and `docker compose up -d`. Migrations run automatically at start; there is no downgrade path, so keep the backup until you are happy.

When the pinned Jellyfin version changes (`lib/jellyfin/version.ts`), the OpenAPI snapshot and generated client are regenerated with `pnpm jellyfin:gen`, and the policy field catalog test fails if `UserPolicy` gained or lost fields.

## Development

Requirements: Node 22, pnpm 12, Docker (integration tests start real Jellyfin and Mailpit containers).

```bash
pnpm install
pnpm jellyfin:dev          # disposable Jellyfin 10.11 on :8096; writes .env.local (API key, secret) if missing
pnpm dev                   # http://localhost:3000, sign in as admin / admin-password-1
```

```bash
pnpm test               # unit + integration (integration needs Docker)
pnpm test:unit
pnpm test:integration
pnpm lint && pnpm typecheck
pnpm build
pnpm ops:check          # builds the image and checks the container healthcheck against Jellyfin in compose
pnpm db:generate        # after editing lib/db/schema.ts
pnpm jellyfin:gen       # regenerate lib/jellyfin/openapi.json + generated types
```

Layout: `app/` routes (server components and server actions), `components/` UI, `lib/services/` the only code that talks to Jellyfin and audits every write, `lib/policy/` pure policy logic (catalog, merge, diff, protection), `lib/lifecycle/` the scheduler's decision function, `tests/integration/` container-backed tests, `drizzle/` migrations. Design choices are recorded one line each in `DECISIONS.md`.
