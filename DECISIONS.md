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

## Stage 3 — Policy editing, profiles and safeguards

- Field classification lives in the catalog (`scope: "profile" | "user"` in `lib/policy/fields.ts`); `EnableUserPreferenceAccess`, `EnablePublicSharing`, `EnableRemoteControlOfOtherUsers` and `EnableSharedDeviceControl` are treated as profile-managed "other permissions", channels (`EnableAllChannels`, `EnabledChannels`, `BlockedChannels`) as library access.
- "Blank" profiles use a hardcoded copy of Jellyfin 10.11's new-user defaults (`lib/policy/defaults.ts`); an integration test compares it with a freshly created user so an upgrade that changes defaults fails loudly.
- Stale-write protection carries the base policy and its SHA-256 (canonical JSON) in hidden form fields; a mismatch on save returns the diff of what changed server-side and re-seeds the editor from the live policy with the operator's edits reapplied.
- The policy editor is a two-step form (Preview → Confirm) driven by `useActionState`; because React resets forms after an action, the parsed edit is echoed back in the action state and the form re-keys itself with those values as defaults.
- Raw JSON edits are merged onto the live policy (omitted keys keep their value); values are type-checked against the catalog before preview and unknown keys are preserved.
- Jellyfin refuses `IsDisabled=true` for administrators (HTTP 403 "Administrators cannot be disabled"); the app checks first and tells the operator to remove admin rights before disabling.
- Protection rules (`lib/policy/protection.ts`): never disable/delete/demote yourself; never disable/delete/demote an administrator unless another *enabled* administrator remains.
- "Assign profile" only records the link (drift becomes visible); "Apply profile" pushes managed fields and records the link; "Adopt" overwrites the profile from the user's live managed fields and reports how many other members drift.
- Copy-policy-from-user copies profile-managed fields only, so admin rights, device allowlists and lockout counters never travel between accounts.
- Bulk actions run through one service (`lib/services/bulk.ts`): preview per user, sequential execution, a result row per user, plus one `bulk.<kind>` audit row with counts. Administrators are skipped by bulk disable.
- Password minimum length is a setting (`minPasswordLength`, default 8) enforced for admin-set passwords and reused by later stages.
- Route-level constants shared with client components live in pure modules (`lib/bulk/kinds.ts`, `lib/policy/*`) so no client bundle can pull in the database or the Jellyfin client.

## Stage 4 — Lifecycle and audit

- The lifecycle decision is a pure function (`lib/lifecycle/decide.ts`) evaluated per user with an explicit clock: administrators → nothing; deletion past grace → delete; else expiry → disable; else inactivity → disable. Already-disabled users and users inside their grace period are left alone.
- The effective inactivity rule is the user's own value, else the assigned profile's, else never; `0` also means never.
- "Schedule deletion" disables the user immediately (reason `manual`) and stamps `delete_after = now + grace`; "Cancel deletion" clears the stamp and re-enables the account. "Delete now" is a separately labelled action with its own typed confirmation (`delete <name>`).
- Deleting a user removes the `user_meta` row and any tokens; audit rows are kept (the `user.delete` row records name, email, labels and profile). If Jellyfin no longer knows the user, the app still cleans up its own rows.
- The scheduler is an in-process `setInterval` (15 min, first run 30 s after start) guarded by a `job_run` row lock (`lock_until`, 10 min) taken with a conditional UPDATE, so several instances or an HMR-restarted dev server never run the pass concurrently. `JELLYCREW_DISABLE_SCHEDULER=1` turns it off (used in tests).
- Every automated change is audited by the underlying action with the `system` actor; a run that changed anything (or errored) also writes one `lifecycle.run` summary row.
- Bulk expiry actions skip administrators (an expiry would never be enforced); bulk schedule-deletion skips administrators and protected users; set/extend/clear expiry, add/remove label, schedule/cancel deletion reuse the same preview → execute → per-user result flow.
- Changing a user's email clears `email_verified_at`; labels are trimmed, de-duplicated and sorted on save.
- The audit page paginates newest-first by id (100 rows, "older entries" link); exports stream the same filters as CSV or JSON from `/audit/export`.
- Settings stored in the `setting` table: `graceDays` (14), `minPasswordLength` (8), `publicBaseUrl` (optional override of `PUBLIC_BASE_URL` for links), `smtpTestResult`; the settings page also shows server/app health and the scheduler status with a run-now button.

## Stage 5 — Invites

- Invite tokens are 128-bit base64url; the database stores the SHA-256 hash for lookup plus the token sealed with `SESSION_SECRET` (`invite.token_sealed`, an extra column) so "copy link" works later without storing the plain token; a leaked database alone cannot reproduce links.
- Public endpoints (`/api/public/*`) are Route Handlers rather than server actions so they can be rate-limited by IP and token, return proper 429/410/404 codes, and be exercised directly in integration tests; the public pages are thin client forms that call them.
- Rate limiting is an in-process sliding window (`lib/ratelimit.ts`): 20 requests per minute per IP and 30 per hour per token on invite endpoints. Single-container deployments need nothing more; a multi-instance setup would need a shared store.
- Public POSTs check the `Origin` header against the request host, `X-Forwarded-Host` and the public base URL when present; cross-site posts get 403.
- Signup order: validate → check name is free → create user → apply profile → claim a use with a conditional `UPDATE ... WHERE uses < max_uses` → write metadata → audit. Any failure after creation deletes the user again (`user.delete` audited with the invite actor) and writes `invite.signup_failed`; the exhausted check is re-run atomically at claim time so parallel signups cannot exceed `max_uses`.
- Account expiry after signup: the invite's `account_expiry_days`, else the profile's `default_expiry_days`, else never. Invitee-provided emails are stored unverified.
- Jellyfin rejects names it does not like with a bare "Error processing request."; the app pre-checks case-insensitive name clashes itself and otherwise surfaces Jellyfin's message verbatim.
- The URL shown to invitees after signup is the `jellyfinPublicUrl` setting (new, on the settings page), falling back to `JELLYFIN_URL`, because the internal URL is usually not reachable from outside.
- Link expiry defaults to 7 days; `0` means the link never expires. `max_uses` blank/0 means unlimited.

## Stage 6 — Self-service and password reset

- Jellyfin answers `403` to `AuthenticateByName` for a disabled account (whatever the password) and `401` otherwise, so the self-service login can honestly say "this account is disabled" and add the app-side reason (expired / inactive / by an administrator) without leaking anything Jellyfin does not already reveal.
- The self-service cookie (`jellycrew_me`, 30 days) is set by the public login Route Handler; logged-in `/me` mutations (change password, set email, revoke device, sign out) are ordinary server actions protected by Next's origin check and the cookie.
- Change-password always calls `AuthenticateByName` with the current password first and only then sets the new one with the API key; the check is rate-limited per user (10/min) to keep it from becoming a password oracle.
- Tokens (`token` table) are 128-bit, stored as SHA-256, single-use (consumed with an `UPDATE ... WHERE used_at IS NULL`), and issuing a new token of the same kind for a user invalidates older unused ones. Reset links live 60 minutes, verification links 24 hours.
- Verification tokens remember the address they were issued for (`token.email`); verifying only succeeds while that address is still the one on file, so changing the address after requesting a link invalidates the link.
- `/reset` matches a verified email first, then a username whose account has a verified email; the response body is identical either way (`RESET_GENERIC_MESSAGE`) and unmatched requests are audited without a target. No mail is ever sent for unverified addresses. When SMTP is not configured the page says to contact the admin and the route answers 503.
- Admins can always create a one-hour reset link by hand (shown once, copyable) and, when SMTP is set up, email one to the address on file even if it is unverified (the admin vouches for it); both are audited (`user.reset_link.create` / `user.reset_link.email`). Consuming any reset link is audited as the `self` actor with `tokenCreatedBy` in the detail.
- Mail goes through nodemailer with `SMTP_URL` as the transport URL; every template is plain text with a light HTML twin. The settings page can verify the SMTP connection and optionally send a test mail; the result is stored in the `smtpTestResult` setting.
- Integration tests run a Mailpit container alongside Jellyfin and read messages through its HTTP API; the `server-only` marker is aliased to a stub in vitest so server modules can be imported by tests.
- Public pages that read runtime configuration but use no request APIs (`/reset`) are marked `force-dynamic` so `next build` never tries to prerender them without an environment.

## Stage 7 — Ops

- The image is a three-stage `node:22-alpine` build (deps → build → runtime) that runs the Next.js standalone server as uid 1001 with `/data` as the only writable state; `drizzle/` is copied explicitly so migrations run at start regardless of output tracing.
- `HEALTHCHECK` calls `/healthz` with busybox `wget`; the endpoint returns 200 whenever the app and database work, so a Jellyfin outage shows as `status: degraded` in the body instead of restarting the container.
- Build tools (`python3 make g++`) are installed only in the deps stage in case `better-sqlite3` has no prebuilt binary for the platform; the runtime stage carries no compilers.
- `docker-compose.example.yml` documents the two-router exposure model with Traefik: the admin router on an internal hostname, the public router restricted to `/invite`, `/reset`, `/me`, `/healthz`, `/api/public`, `/_next/static` and `/favicon.ico`, plus an optional Traefik rate limit.
- `docker-compose.ci.yml` + `scripts/compose-check.sh` (`pnpm ops:check`) build the image, bootstrap a Jellyfin container through the app's own harness, and assert the container's healthcheck is `healthy`, `/healthz` reports Jellyfin reachable at the pinned version, and the process is not root. GitHub Actions runs it alongside the unit and integration jobs.
- The README's online backup uses better-sqlite3's `backup()` from inside the container (the image has no `sqlite3` CLI); stopping and snapshotting the volume is the alternative.

## Design

- Colour tokens live in `app/globals.css` as CSS variables written once with `light-dark()` and switched by `color-scheme`: dark is the default on `:root`, `data-theme="light"` on `<html>` forces light, and no attribute follows the OS. Tailwind exposes them through `@theme inline` as meaning-named utilities (`bg-surface`, `text-fg-muted`, `border-edge`); palette classes such as `zinc-*` are being phased out package by package.
- The theme choice is a plain `jellycrew_theme` cookie (`light` or `dark`, absent means system; one year, `SameSite=Lax`, `Secure` on https) read in the root layout so the server renders the right theme without a flash. The toggle writes it from the browser (`document.cookie`) rather than through a server action: it holds only a display preference, so `HttpOnly` buys nothing, and a server action would re-render every layout and wait on the Jellyfin status probe for each click.
- `lib/ui/contrast.test.ts` reads the token values out of `globals.css` (hex and translucent `rgb()` alike, composited over each background) and fails the unit suite when a text token drops below its WCAG floor on canvas, surface or surface-2 in either theme (fg 7:1, fg-muted 5.5:1, everything else 4.5:1), when a semantic tone or `fg` is unreadable on that tone's soft fill, or when `edge-strong` (control borders) falls under 3:1. Palette edits cannot regress contrast silently.
- Tailwind's default type scale is redefined to 12 / 13 / 14 / 16 / 20 / 26 px with fixed line heights; the console body is `text-sm` (13 px) and numerals are tabular everywhere. Radii are Tailwind's defaults (4 / 6 / 8 px), not redefined.
- Motion durations are CSS variables (`--duration-fast|base|slow` = 120 / 160 / 200 ms) with one easing (`--ease-standard`); `prefers-reduced-motion` zeroes them except the 80 ms `--duration-fade`.
- A transitional `@custom-variant dark` keeps the existing `dark:` utilities working under `data-theme` until every component uses tokens; the final design package deletes it together with the last `dark:` classes.
- Browser baseline for the design work is `light-dark()`, native `<dialog>` and the Popover API (browsers from early 2024 on); no polyfills.
- `FormField` takes `id`, `label`, `help` and `error` as props, composes shadcn's `Field`/`FieldLabel`/`FieldDescription`/`FieldError`, and clones `id`, `aria-describedby` and `aria-invalid` onto its single control, so call sites only name the field; it works identically in server and client forms.
- Buttons, inputs, textareas and native selects share the sizes `sm` 28 / default 32 / `lg` 44 px (`lg` is the guest touch size with 16 px text). Navigation styled as a button is a `next/link` with `buttonVariants(...)` classes, never a button rendered as a link (Base UI would stamp `role="button"` on it). `SubmitButton` reads `useFormStatus`, so plain server-action forms get pending state without local code. shadcn's `disabled:pointer-events-none` is dropped from Button so the `title` on a disabled button can still explain why.
- `cn` is the `cn` package (clsx plus Tailwind class merging), so a `className` such as `w-40` or `w-full` overrides a primitive's default width; `Input` and `Textarea` default to full width, `NativeSelect` to fit.
- Saving a setting as `null` deletes its row (the `setting.value` column is NOT NULL); before this, saving the settings form with the two optional URL fields blank crashed with a constraint error.
- Server actions call `redirect()` only outside `try/catch`: `redirect()` works by throwing, and eight actions were catching their own redirect and surfacing "NEXT_REDIRECT" as an error notice after a successful create-profile, apply-to-members, adopt, copy, schedule-deletion, reset-link or lifecycle run. The `try` now wraps only the service call.
- Primitives are shadcn/ui (Base UI, "nova" preset, added with the CLI and owned in `components/ui`) with `lucide-react` icons, replacing the hand-written components and the hand-drawn icon set: Rudi's call on 2026-09-11, superseding the Stage 1 decision to avoid the CLI. Tokens use shadcn's vocabulary (`background`, `card`, `muted`, `primary`, `border`, `input`, `destructive`, plus `success` and `warning`) so every added component works unchanged; `--accent` is shadcn's hover fill and the brand colour is `--primary`.
- App-level compositions (`FormField`, `Section`, `SubmitButton`, `PageHeader`, `KeyValue`) wrap shadcn parts instead of forking them; shadcn files are edited only where the direction needs it (the 44 px `lg` button size).
