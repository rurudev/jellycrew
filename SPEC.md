# Goal

Build a self-hosted user management app for a single Jellyfin server. Working name `jfusers` (rename freely; keep the name consistent across package, image, cookie prefix). It replaces the Jellyfin dashboard for everything about users: who has access, to what, on what terms, for how long, and what they are doing right now.

Jellyfin stays the source of truth for users, policies, sessions, devices and libraries. This app owns only what Jellyfin cannot: profiles, lifecycle rules, invites, contact details, reset tokens and an audit trail.

"Done well" means: every action is safe by default (preview, confirm, rollback, audit), nothing in the policy is unreachable from the UI, bulk operations are first-class, automation never touches administrators, and the app is boring to operate (one container, one SQLite file, one API key).

# Hard constraints

- Next.js (latest stable, App Router, standalone output), TypeScript strict, React Server Components, server actions for mutations, Tailwind, shadcn/ui allowed. Node 22, pnpm.
- Drizzle ORM on better-sqlite3. One database file at `$DATA_DIR/app.db`, WAL mode. Migrations generated with drizzle-kit, committed, applied at startup.
- Jellyfin is called only from the server. Generate a typed client from the running server's `/api-docs/openapi.json` (openapi-typescript + openapi-fetch), or use `@jellyfin/sdk` if its version matches the target. Never hand-write endpoint paths or payload shapes from memory. Endpoints named in this spec are hints; verify each against the OpenAPI spec before use.
- Target Jellyfin 10.11.x. Pin the version in one constant, run integration tests against the same image tag, show a warning in the UI when the live server's major.minor differs.
- Auth header: `Authorization: MediaBrowser Client="jfusers", Device="server", DeviceId="<stable id stored in the setting table>", Version="<app version>", Token="<api key>"`. API keys are administrator-level: env only, never logged, never sent to the browser.
- App login: administrators authenticate with their own Jellyfin admin credentials (POST /Users/AuthenticateByName, require Policy.IsAdministrator). Non-admins log into the self-service area with their Jellyfin credentials. No separate password store. Signed HttpOnly cookie sessions (iron-session or equivalent): 12 h admin TTL, 30 d self-service TTL, origin check on every mutation.
- zod at every boundary (env, forms, the Jellyfin responses you depend on). pino structured logs with request ids. `GET /healthz` returns app status, Jellyfin reachability and version.
- Tests: vitest for pure logic. Integration tests run against a real `jellyfin/jellyfin` container (testcontainers-node), bootstrapped through the /Startup endpoints (Configuration, User, RemoteAccess, Complete), API key created with POST /Auth/Keys using the admin session token. Email is tested against a Mailpit container. GitHub Actions runs both suites. Docker is required locally.
- No Jellyfin data is cached across requests, except the session list (10 s).

# Domain rules

## Policies

- POST /Users/{id}/Policy replaces the entire UserPolicy. Every write is read-modify-write on the object just fetched. Fields the app does not know are passed through untouched.
- Classify every UserPolicy field in code as either profile-managed (library access, parental controls, playback and transcoding, remote access and bitrate, downloads, media conversion, SyncPlay, live TV, session limits, content management) or per-user (IsAdministrator, IsDisabled, IsHidden, EnableAllDevices, EnabledDevices, AuthenticationProviderId, PasswordResetProviderId, InvalidLoginAttemptCount, LoginAttemptsBeforeLockout). A test must fail if the OpenAPI UserPolicy schema contains a field the code has not classified. Applying a profile touches only profile-managed fields.
- Drift is the per-field diff between a user's live profile-managed fields and the assigned profile. Computed on demand, never stored.
- Stale-write protection: the editor carries a hash of the policy it was rendered from. On save, refetch; if the hash differs, refuse, show what changed in the meantime, and let the admin reapply.
- Library access uses folder ids. Resolve names via GET /Library/MediaFolders; flag ids that no longer exist. Parental ratings come from GET /Localization/ParentalRatings. Device allowlists resolve names via GET /Devices.

## Safeguards

- Users with IsAdministrator are excluded from all automation (expiry, inactivity, deletion) and from bulk disable and delete. The app refuses to disable, delete, or remove admin rights from the last enabled administrator or from the currently logged-in admin.
- Destructive single actions require typed confirmation. Bulk actions show a per-user preview of the exact changes, then execute sequentially with per-user results. Partial failure is reported, never hidden.
- Deletion is two-step: disable now, delete after a grace period (default 14 days, configurable). Immediate deletion exists as a separately labelled action.
- Invite signup: if applying the profile fails after the user was created, delete the user and report the error. Never leave an account sitting on Jellyfin's default policy.
- Public endpoints (invite signup, reset request, reset consume, self-service login) are rate-limited per IP and per token. Tokens are 128-bit random, stored as SHA-256, single-use, compared in constant time. Defaults: invite links expire after 7 days, reset links after 1 hour, email verification after 24 hours.
- Usernames are validated by Jellyfin; check for an existing name first and surface Jellyfin's error verbatim. Minimum password length is configurable (default 8). Invites never create passwordless accounts.
- With the API key, setting a new password for another user does not require the current password. The self-service change-password flow must verify the current password via AuthenticateByName first.

## Lifecycle

- Per user: `expires_at` (null = never), `inactivity_disable_days` (null = inherit from profile; profile null = never), `delete_after` (set when deletion is scheduled).
- Inactivity is measured from UserDto.LastActivityDate, falling back to LastLoginDate, falling back to the app's `first_seen_at` for users that have never logged in.
- Existing users: on first contact the app lists all Jellyfin users and creates meta rows lazily (`first_seen_at` = now). Nothing changes in Jellyfin until an admin acts.
- The scheduler runs every 15 minutes in-process with a DB lock: disable expired users, disable inactive users, delete users past their grace period. Every automated change is audited with actor `system`. The settings page shows last run, result, and a run-now button.

## App data (SQLite)

- `user_meta`: jellyfin_user_id PK, email, email_verified_at, notes, labels (json), profile_id, expires_at, inactivity_disable_days, disabled_by_app_at, disabled_reason (expired | inactive | manual), delete_after, created_via_invite_id, first_seen_at, updated_at.
- `profile`: id, name (unique), description, policy (json, profile-managed fields only), default_expiry_days, inactivity_disable_days, created_at, updated_at.
- `invite`: id, token_hash (unique), label, profile_id, expires_at, max_uses, uses, account_expiry_days, require_email, note_for_invitee, created_by, created_at, revoked_at.
- `invite_use`: id, invite_id, jellyfin_user_id, ip, user_agent, created_at.
- `token`: id, kind (password_reset | email_verify), jellyfin_user_id, token_hash, expires_at, used_at, created_by (self | admin), created_at.
- `audit`: id, ts, actor_type (admin | self | system | invite), actor_id, action, target_user_id, before (json), after (json), detail (json), request_id.
- `job_run`: name PK, lock_until, last_started_at, last_finished_at, last_result (json).
- `setting`: key PK, value (json). Holds device id, grace days, min password length, public base URL, SMTP test result.

# Features, in priority order

## 1. Users (the core)

List: name, avatar, admin badge, status (enabled, disabled, disabled-by-app with reason, expiring within 7 days, scheduled for deletion), profile with drift marker, last login, last activity (relative, absolute on hover), active sessions, device count, expiry, labels. Sort on every column; filter by status, profile, label, drift, and inactive-for-N-days; text search; all state in the URL. Multi-select with bulk actions: assign profile, apply profile, enable, disable, set or extend expiry, schedule or cancel deletion, add or remove label, send reset link. Preview, then execute.

Detail page. Header with status and quick actions (enable/disable, reset password, apply profile, delete), then sections:

- Access: grouped policy editor. Libraries (checkbox list with names, all-libraries toggle). Parental controls (MaxParentalRating from the server's rating list, BlockedTags, AllowedTags if present in the schema, BlockUnratedItems, AccessSchedules). Playback (media playback, audio and video transcoding, remuxing, force remote transcoding, downloads, media conversion, SyncPlay access). Remote (EnableRemoteAccess, RemoteClientBitrateLimit, MaxActiveSessions). Live TV (access, management). Content management (deletion and per-folder deletion, collections, subtitles, lyrics). Devices (all devices vs allowlist with names). Admin and danger (IsAdministrator, IsHidden, IsDisabled). Every field has a plain-language label, help text, and the raw field name visible. A raw JSON editor covers anything the groups do not, so nothing is unreachable. Save shows a diff before committing.
- Profile: assigned profile, per-field drift diff, Apply (profile to user), Adopt (user to profile, showing how many other members will then drift).
- Lifecycle: email with verified state and resend verification, notes, labels, expiry, inactivity rule, deletion schedule, disabled-by-app reason.
- Sessions and devices: live sessions (client, device, now playing, play method direct/remux/transcode with transcode reasons, bitrate), stop playback, send message. Devices with app and last-used; revoke device.
- History: audit entries for this user.
- Actions: rename, set password directly, generate a reset link (works without SMTP), email a reset link, copy policy from another user, disable, schedule deletion, delete now.

## 2. Profiles

List with member and drift counts. Create blank (Jellyfin defaults), from an existing user (snapshot of profile-managed fields), or clone. Same grouped editor as the user page. Apply to all members with preview. Deleting a profile unassigns members and changes nothing in Jellyfin. Optional `default_expiry_days` and `inactivity_disable_days`.

## 3. Sessions (global)

All live sessions polled every 10 s, same columns as the user section, filter by user, client, play method. Stop and message. Summary line: active streams, transcodes, distinct users.

## 4. Lifecycle automation, audit, settings

Scheduler as described. Audit page with filters (actor, action, user, date range) and CSV/JSON export. Settings page: server name and version with mismatch warning, SMTP configuration test, grace days, minimum password length, public base URL, scheduler status and run-now, integration health.

## 5. Invites

Create: label, profile, link expiry, max uses, account expiry days, require email, note for invitee. List active, expired, exhausted, revoked, with uses and who signed up; copy link; revoke. Public `/invite/{token}`: shows server name and the note, asks username, password twice, email if required; creates the user, applies the profile, writes user_meta (expiry from the invite), records the use, audits with actor `invite`, then shows the server URL and next steps. Rate-limited, Jellyfin username errors surfaced, rollback on failure.

## 6. Self-service (`/me`)

Login with Jellyfin credentials. Shows profile name, expiry, and disabled reason if any. Change password (verify current via AuthenticateByName, then update). Sessions and devices with revoke. Set email, receive verification link; only a verified email can be used for reset. `/reset`: username or email, always the same generic response, a link is sent only when a verified email exists. `/reset/{token}`: new password, single-use token, audited with actor `self`. If SMTP is not configured, `/reset` says to contact the admin; admins can always generate a link by hand.

## 7. Ops

Multi-stage Dockerfile (node:22-alpine, non-root, standalone build), `/data` volume as the only state, HEALTHCHECK on `/healthz`. `docker-compose.example.yml` with Traefik labels showing two routers: the admin UI on an internal hostname, and a public router that matches only `/invite`, `/reset`, `/me`, `/healthz` and their assets. Env: JELLYFIN_URL, JELLYFIN_API_KEY, PUBLIC_BASE_URL, DATA_DIR, SESSION_SECRET, SMTP_URL, SMTP_FROM, LOG_LEVEL. README covers first run, the exposure model, backup (copy `app.db` with `sqlite3 .backup` or snapshot the volume), and upgrades. DECISIONS.md is kept current.

# Out of scope for v1

Notifications beyond transactional email (no expiry warnings, no Discord or Telegram), announcements, SSO/OIDC linking, Jellyseerr or Ombi sync, Emby or Plex, multiple servers, playback history and statistics, library or server settings, per-user display preferences (UserConfiguration) beyond reading them.

# Working rules

- Build in the stages given in the goal. A stage is done when its exit criteria pass under `pnpm test` and `pnpm build`.
- Every Jellyfin write goes through one service module that audits. No route or action calls the Jellyfin client directly.
- Prefer server components and server actions. Client components only where interactivity demands it.
- Keep the UI plain and fast: tables, forms, diffs. No dashboards, no charts.
- Make reasonable choices without asking; record each in DECISIONS.md in one line.