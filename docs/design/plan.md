# Implementation plan

Status: draft for approval (Phase 3, 2026-09-11). Executes `direction.md` (approved) and folds in the code-quality findings from `audit.md`. No code is written until this plan is approved.

## Status

| # | Package | Branch | State |
|---|---------|--------|-------|
| 1 | Foundation: tokens, theme, type scale | `design/foundation` | done (2026-09-11, on branch) |
| 2 | Fields, buttons, sections, page header | `design/fields-and-sections` | done (2026-09-11, on branch) |
| 3 | Table kit, status badges, chips, empty states | `design/tables-badges-empty` | planned |
| 4 | Dialogs, toast, loading and error states | `design/dialogs-toast-loading` | planned |
| 5 | Console shell (header, nav, status) | `design/shell` | planned |
| 6 | Users list | `design/users-list` | planned |
| 7 | User detail layout | `design/user-detail-layout` | planned |
| 8 | User actions menu and dialogs | `design/user-actions` | planned |
| 9 | Policy editor | `design/policy-editor` | planned |
| 10 | Invites | `design/invites` | planned |
| 11 | Invite acceptance and guest forms | `design/invite-acceptance` | planned |
| 12 | Settings | `design/settings` | planned |
| 13 | Profiles | `design/profiles` | planned |
| 14 | Sessions and audit | `design/sessions-and-audit` | planned |
| 15 | Self-service and login | `design/self-service-and-login` | planned |
| 16 | Polish, sweep, document | `design/polish` | planned |

Update the State column (planned → in progress → done, with the merge commit) as packages land.

## Conventions for every package

- **One package per session** on a branch named as above, cut from `main` after the previous package merged. Work in the package's order of steps; stop when its verification passes.
- **Before touching a screen**, screenshot it with the Playwright MCP at 1440×900 and 390×844 in the theme(s) the package affects. After, screenshot again and compare against `direction.md`. Screenshots live in the session scratchpad and are described in the review summary; they are not committed.
- **Dev sign-in** uses the README credentials (`admin` / `admin-password-1`) against the disposable Jellyfin started by `pnpm jellyfin:dev`.
- **Definition of done**: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` pass; `pnpm test:integration` also passes when the package touches anything under `lib/`; `/code-review` run and findings addressed; no `zinc-*` or `dark:` classes remain in files the package touched; one line per design decision added to `DECISIONS.md` under a new "Design" heading; the Status table above updated.
- **No new dependencies.** Everything below is buildable with what is installed. If a step turns out to need one, stop and ask.
- **Off-limits layers** (`lib/jellyfin`, auth and session handling, DB schema and migrations, env and config, API route contracts) are never edited. Findings that need them are in the Proposals section and stay there until approved separately.
- **Prefer deleting.** When a component cannot be made consistent with the system, replace it; do not patch it.

### One-time prerequisite (before package 1)

1. Restart the session so `.mcp.json` (`--browser chromium`) takes effect; confirm `browser_navigate` works.
2. Seed the dev instance through the app itself so screenshots show real states: sign in, create a profile "Family" (blank), create an invite "Friends" with unlimited uses, sign up three users through the invite link on a phone-sized viewport, assign the profile to two of them and apply it to one, set an expiry inside seven days and two labels on one, disable one from the user page. This exercises the existing flows once more and produces audit rows, drift, statuses and labels.

## Packages

### 1. Foundation — `design/foundation`

**Files.** `app/globals.css`, `app/layout.tsx`, new `lib/theme.ts` and `lib/theme.test.ts`, new `lib/theme-server.ts`, new `lib/ui/contrast.test.ts`, new `components/ui/theme-toggle.tsx` (client), one-line insertions of the toggle in `app/(admin)/layout.tsx`, `app/(public)/layout.tsx` and `app/login/page.tsx`, `DECISIONS.md`.

**What changes.**
- Replace the two existing tokens with the full set from direction §2.1–2.4 as CSS variables, written once with `light-dark()` and switched by `color-scheme`: `:root` is dark, `[data-theme="light"]` is light, and `:root:not([data-theme])` follows `prefers-color-scheme`. Names: `--color-canvas` (page), `--color-surface`, `--color-surface-2`, `--color-edge`, `--color-edge-strong`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`, `--color-accent`, `--color-accent-fg`, `--color-accent-soft`, `--color-ok`/`-soft`, `--color-warn`/`-soft`, `--color-danger`/`-soft`; `--radius-*`; `--ease-standard`; `--duration-fast|base|slow`. Exposed through `@theme inline` so utilities read as meaning (`bg-surface`, `text-fg-muted`, `border-edge`, `ring-accent`).
- Redefine Tailwind's `--text-*` scale to the direction's seven steps with paired line heights, so existing `text-sm` becomes 13/18 without touching call sites; `font-variant-numeric: tabular-nums` on `body`.
- Global `:focus-visible` outline (2 px accent, 2 px offset), `::selection`, `prefers-reduced-motion` rule per direction §2.4.
- `@custom-variant dark` bound to `[data-theme="dark"]` and to `prefers-color-scheme` when no attribute is set, so the 70 existing `dark:` classes follow the toggle during the migration. Removed in package 16.
- Root layout reads the `jellycrew_theme` cookie (validated by `lib/theme.ts`) and sets `data-theme` on `<html>`. `ThemeToggle` cycles system → light → dark by writing the cookie from the browser and switching the attribute in place (no server action: it would re-render every layout per click). The toggle is also mounted on `/login`, which sits outside both route groups.

**Verified by.** `lib/ui/contrast.test.ts` parses `globals.css` and asserts WCAG ratios for every text/background pair in both themes (fg ≥ 7:1, fg-muted ≥ 5.5:1, fg-subtle ≥ 4.5:1, accent-fg on accent ≥ 4.5:1, semantic tones on every surface ≥ 4.5:1). `lib/theme.test.ts` covers cookie parsing. Lint, typecheck, unit. Playwright: `/login` and `/users` in system, light and dark; reload keeps the theme with no flash; existing `dark:` styling follows the toggle.

**Out of scope.** Any component or page change beyond mounting the toggle. Pages still look like today.

### 2. Fields, buttons, sections, page header — `design/fields-and-sections`

**Files.** Rework `components/ui/button.tsx`, `components/ui/input.tsx`. New `components/ui/submit-button.tsx` (client, `useFormStatus`), `field.tsx`, `section.tsx`, `page-header.tsx`, `key-value.tsx`, `icon.tsx`, `kbd.tsx`. Delete `components/ui/card.tsx`, `components/ui/label.tsx`. Call sites: `app/(admin)/users/[id]/page.tsx`, `components/users/lifecycle-card.tsx`, `app/(admin)/invites/page.tsx`, `app/(admin)/settings/page.tsx`, `app/(admin)/profiles/page.tsx`, `app/(admin)/profiles/[id]/page.tsx`, `app/(public)/me/page.tsx`, `app/(public)/invite/[token]/signup-form.tsx`, `app/login/login-form.tsx`, `app/(public)/me/login-form.tsx`, both reset forms, `components/policy/policy-editor.tsx`, `components/users/users-filters.tsx`, `components/users/bulk-form.tsx`, `components/sessions/*`, `app/(admin)/error.tsx`.

**What changes.**
- `Button`: token-based variants `primary | secondary | ghost | danger`, sizes `sm` 28 / `md` 32 / `lg` 44, optional `icon`, no `className` width overrides (a `block` prop instead). `SubmitButton` renders a spinner and optional `pendingLabel` from `useFormStatus`; every plain server-action form uses it.
- `Input`, `Select`, `Textarea`: sizes `md` 32 / `lg` 44, `invalid` → `aria-invalid` and danger border, `mono`, `width="auto" | "full"`.
- `Field` compound (`Field`, `Field.Label`, `Field.Control`, `Field.Help`, `Field.Error`) wiring `id`, `aria-describedby` and `aria-invalid` through context.
- `Section` (`<section aria-labelledby>`, title, description, `actions`) replaces `Card`/`CardTitle`; `PageHeader` (breadcrumb, title, count, description, actions) gives every page one `h1` at one size; `KeyValue` replaces the five hand-built `<dl>` grids.
- `Icon`: ten inline SVG paths (search, sort-asc, sort-desc, check, close, copy, external, warning, chevron, sun, moon, spinner), `aria-hidden` unless `label` is given.
- Mechanical migration of every call site listed above. Page structure and order are unchanged; only primitives and titles are.

**Verified by.** Lint, typecheck, unit. Playwright: every console page, `/login`, `/me`, `/reset`, an invite page, before and after; forms still submit; focus rings visible on buttons and inputs; one `h1` per page (snapshot).

**Out of scope.** Tables, badges, dialogs, notices, page layouts.

**Also fixed while verifying.** Saving settings with the optional URL fields blank crashed on a NOT NULL constraint (`setSetting(null)` now deletes the row), and six server actions swallowed their own `redirect()` inside `try/catch` and reported "NEXT_REDIRECT" as an error; every action `catch` now starts with `unstable_rethrow`.

### 3. Table kit, status badges, chips, empty states — `design/tables-badges-empty`

**Files.** Rework `components/ui/table.tsx` (`Table`, `Th` with `sort`, `Td`, `Row` with `href`/`selected`, `SelectAll`), `components/ui/alert.tsx` (tokens). New `components/ui/status-badge.tsx`, `chip.tsx`, `tag.tsx` (muted mono for admin/hidden), `empty-state.tsx`, `timestamp.tsx`, `copy-field.tsx`. Delete `components/ui/badge.tsx`, `EmptyRow`, `components/time.tsx`, `components/invites/copy-button.tsx`, `components/users/status-badge.tsx`. Change `lib/users/status.ts` (`tone` becomes `ok | warn | danger | neutral`) and `lib/users/status.test.ts`. Call sites: `components/users/users-table.tsx`, `components/users/avatar.tsx`, `components/sessions/sessions-table.tsx`, `devices-table.tsx`, `components/policy/policy-view.tsx`, `diff-table.tsx`, `policy-editor.tsx`, `components/users/bulk-form.tsx`, `app/(admin)/invites/page.tsx`, `profiles/page.tsx`, `profiles/[id]/page.tsx`, `audit/page.tsx`, `users/[id]/page.tsx`, `app/(public)/me/page.tsx`.

**What changes.**
- Table: 36 px rows, sticky header, hairline separators, hover and selected fills, header cells at `xs` muted 500 with no uppercase; `Th sort={{ key, active, dir, href }}` renders a real link with `aria-sort` and an icon; `Row href` makes the whole row clickable via a stretched first-cell link (keyboard focus lands on the link, no JS).
- `StatusBadge` (dot + label, tone by meaning), `Chip` (neutral label), `Tag` (mono, muted). `Alert` keeps four tones on soft fills.
- `EmptyState` (title, one line, one action) with an `EmptyState.Row colSpan` wrapper for tables.
- `Timestamp` replaces `Time`: relative text, absolute in `title`, and an `absolute` prop to render it visibly on detail pages.
- `CopyField` replaces the `<code>` + `CopyButton` pairs; the copied state timeout is cleared on unmount.
- `Avatar` gets `loading="lazy"` and `decoding="async"`.
- Booleans in `PolicyView` and `DiffTable` render as text ("Yes" / muted "No") instead of green and grey badges.

**Verified by.** `status.test.ts` updated and passing; lint, typecheck, unit. Playwright: `/users`, `/invites`, `/profiles`, `/audit`, `/sessions`, `/users/[id]` before and after in both themes; Tab reaches sort links and row links; accessibility snapshot shows `aria-sort`.

**Out of scope.** Users toolbar, columns and selection (package 6); dialogs.

### 4. Dialogs, toast, loading and error states — `design/dialogs-toast-loading`

**Files.** New `components/ui/dialog.tsx` (client; native `<dialog>`; `Dialog`, `Dialog.Title`, `Dialog.Body`, `Dialog.Footer`, `ConfirmDialog` with typed phrase), `components/ui/toast.tsx` (client), `components/ui/skeleton.tsx`, `app/(admin)/loading.tsx` plus `loading.tsx` in `users`, `users/[id]`, `users/[id]/policy`, `invites`, `settings`, `profiles`, `profiles/[id]`, `sessions`, `audit` (three skeleton shapes: list, detail, form), `app/(admin)/users/[id]/not-found.tsx`, `app/(admin)/profiles/[id]/not-found.tsx`. Rework `app/(admin)/error.tsx`. `lib/notice.ts` gains `redirectWithNotice(path, notice)`; new `app/(admin)/users/[id]/shared.ts` holds the one `backToUser` helper replacing the four `back()` copies in `users/[id]/actions.ts`, `lifecycle-actions.ts`, `reset-actions.ts` and `app/(public)/me/actions.ts`. Delete `components/notice.tsx`, `components/confirm-form.tsx`. Mount `Toast` once in `app/(admin)/layout.tsx` and `app/(public)/layout.tsx` inside a `Suspense`; remove `<Notice params>` from every page.

**What changes.**
- `Dialog` opens via a client trigger, traps focus natively, closes on Esc and backdrop, returns focus, animates per direction §2.4. Server-rendered form content is passed as children, so existing server actions keep working inside dialogs.
- `ConfirmDialog` embeds the typed-phrase guard; the three existing `ConfirmForm` uses (two in `lifecycle-card.tsx`, one in `profiles/[id]/page.tsx`) become buttons that open it.
- `Toast` reads `?ok=`/`?error=` on mount, shows a dismissible toast (`role="status"` for ok, `role="alert"` for error), and strips the params with `history.replaceState`. The server-action redirect mechanism is unchanged.
- Skeletons are static blocks matching each page's shape; `error.tsx` and the new `not-found.tsx` files use `EmptyState` and the system styles.

**Verified by.** Lint, typecheck, unit. Playwright: save settings and observe the toast and a clean URL; open a confirm dialog with the keyboard, type the phrase, Esc closes and focus returns; click a nav link and screenshot immediately to see the skeleton; visit `/users/nope` for the not-found state.

**Out of scope.** Moving actions into menus; page restructuring.

### 5. Console shell — `design/shell`

**Files.** `app/(admin)/layout.tsx`, new `components/shell/nav-link.tsx` (client, `usePathname` → `aria-current`), `components/shell/server-status.tsx`, `components/shell/skip-link.tsx`.

**What changes.** Wordmark, six links with `aria-current` and accent underline, status dot with server name and version (tooltip carries the error when unreachable), theme toggle, user name, sign-out as ghost; links become a horizontally scrolling row under 768 px and the status collapses to the dot; skip link to `main`; the version-mismatch and unreachable alerts keep their place under the header. 24 px gutters, 1280 px content width.

**Verified by.** Lint, typecheck. Playwright at 1440 and 390 in both themes; Tab order starts at the skip link; `aria-current` on the active link (snapshot); simulate unreachable by pointing at the status dot's tooltip only (no config change).

**Out of scope.** Guest layout (package 11).

### 6. Users list — `design/users-list`

**Files.** `app/(admin)/users/page.tsx`, `app/(admin)/users/loading.tsx`, `components/users/users-table.tsx`, `components/users/users-filters.tsx` → `users-toolbar.tsx`, new `components/ui/search-field.tsx` (client: `/` focuses, Esc clears), `components/ui/auto-submit-select.tsx` (client: `onChange` → `form.requestSubmit()`), `components/users/bulk-form.tsx` → `bulk-bar.tsx` (client), `components/users/filter-chips.tsx`. `lib/users/query.ts` is unchanged (sort keys stay so URLs remain valid).

**What changes.**
- `PageHeader` with count and an **Invite** primary action linking to `/invites?new=1`.
- Toolbar built on `next/form`: search submits on Enter, selects submit on change, no Apply button; active filters as removable chips; Reset.
- Seven columns per direction: User (avatar, name, `Tag`s) · Status · Profile with a warn dot for drift · Last seen (activity; login in the tooltip) · Expiry · Labels · Sessions (rendered only when > 0). Devices column removed. Rows are links; sticky header.
- Selection: `SelectAll` in the header; a sticky bottom bar appears with the count, the action select, its parameter and **Preview**; preview and per-user results open in a `Dialog` reusing the existing `bulkAction` state machine. `selectable` prop removed; the table receives the checkbox column as a slot.
- `EmptyState` with a "Clear filters" action; skeleton shaped like the table.

**Verified by.** `lib/users/query.test.ts` untouched and passing; lint, typecheck, unit. Playwright before and after at 1440 and 390 in both themes; `/` focuses search; changing a select updates the URL through a client navigation (network log shows an RSC request, not a document load); Tab reaches sort links, row links and checkboxes; run a bulk "Add label" preview and execute on two test users and confirm the dialog shows per-user results.

**Out of scope.** Bulk service logic; detail page; the invite dialog itself (package 10 handles `?new=1`).

### 7. User detail layout — `design/user-detail-layout`

**Files.** `app/(admin)/users/[id]/page.tsx`, `app/(admin)/users/[id]/loading.tsx`, new `components/users/access-summary.tsx`, `components/users/lifecycle-form.tsx`, `components/users/user-facts.tsx`, new `lib/policy/summary.ts` and `summary.test.ts` (pure: fields that differ from the assigned profile or from `lib/policy/defaults.ts`), rework `components/policy/policy-view.tsx`, `components/sessions/sessions-table.tsx` and `devices-table.tsx` (`columns` prop replaces `showUser`). Delete `components/users/lifecycle-card.tsx`.

**What changes.**
- Header: avatar, name, tags, status badge, **Edit access** primary; the other action forms move temporarily into an "Actions" section at the bottom of the rail (package 8 turns them into the menu and dialogs). The raw id moves to the facts list.
- Two columns from 1024 px. Main: Access summary (non-default and drifted fields only, "Show all 44 fields" and "Show field names" client toggles), Sessions, Devices, History. Rail: Profile (assigned, drift diff, Apply and Adopt), Lifecycle (`Field`s with one `SubmitButton`), Facts (`KeyValue`), Actions (temporary), Danger (the two `ConfirmDialog` buttons).
- `previewAdopt` and the copy-policy preview move into the page's `Promise.all`.

**Verified by.** `summary.test.ts`; lint, typecheck, unit. Playwright before and after at 1440 and 390 in both themes; assign, apply, adopt and lifecycle save still work on a test user; keyboard reaches both toggles.

**Out of scope.** Menu and dialogs (package 8); policy editor route (package 9).

### 8. User actions menu and dialogs — `design/user-actions`

**Files.** New `components/ui/menu.tsx` (client; Popover API with roving focus, arrow keys, Esc), `components/users/action-dialogs.tsx` (Rename, Set password, Generate reset link, Email reset link, Copy policy from…, Enable/Disable, Schedule deletion, Delete now). `app/(admin)/users/[id]/actions.ts` (`copyPolicyAction` returns state instead of redirecting with `?copyFrom=`), `reset-actions.ts` (`createResetLinkAction` returns the URL in state instead of `?resetLink=`), `page.tsx` (drop the temporary Actions section and the `copyFrom`/`resetLink` param reads).

**What changes.** A **More** menu in the header lists every secondary action with a one-line hint where it is unavailable (self, last administrator, no email, no SMTP). Each item opens a dialog: `useActionState` forms for rename, password, reset link (result shown as `CopyField`) and copy policy (select source → diff preview → confirm); `ConfirmDialog` for disable, schedule deletion and delete now. Nothing destructive is rendered until asked for; secrets never enter the URL.

**Verified by.** Lint, typecheck, unit. Playwright: exercise each action once on test users, including delete-now on a throwaway user; keyboard: Enter opens the menu, arrows move, Esc closes; screenshots of the header and one dialog in both themes; audit rows confirm actions still record.

**Out of scope.** Policy editor; bulk actions.

### 9. Policy editor — `design/policy-editor`

**Files.** `components/policy/policy-editor.tsx`, `components/policy/diff-table.tsx`, new `components/policy/group-index.tsx`, `components/policy/id-checkboxes.tsx` (client search when more than ten options), `components/ui/tabs.tsx` (client, `role="tablist"`, arrow keys), `app/(admin)/users/[id]/policy/page.tsx`, `app/(admin)/users/[id]/policy/loading.tsx`, the policy section of `app/(admin)/profiles/[id]/page.tsx`. `lib/policy/*` logic untouched.

**What changes.** Sticky left index of the ten groups (anchor links, `scroll-margin`); each field is a `Field` with the raw key behind a toggle; grouped and raw as `Tabs`; a sticky bottom bar with **Preview changes** and Cancel, which after a preview becomes **Confirm and save** and "Keep editing" with the diff in a `Dialog`; the stale-write alert stays inline. `PolicyEditor` props collapse to `{ action, policy, hash, refData, target: { kind: "user" | "profile", id } }`; scope, hidden fields and cancel link derive from `target`.

**Verified by.** `lib/policy` unit tests and `tests/integration/policies.itest.ts` pass unchanged; lint, typecheck. Playwright: preview then confirm on a test user; provoke a stale write from a second tab and confirm the alert and re-seeded form; tabs respond to arrow keys; screenshots at 1440 and 390 in both themes.

**Out of scope.** Field catalogue, defaults, merge and diff semantics.

### 10. Invites — `design/invites`

**Files.** `app/(admin)/invites/page.tsx`, `app/(admin)/invites/loading.tsx`, `app/(admin)/invites/actions.ts` (`createInviteAction` returns state for the dialog; `revalidatePath` refreshes the table), new `components/invites/new-invite-dialog.tsx` (client, `useActionState`), `components/invites/invites-table.tsx`, new `lib/invites/defaults.ts` and `defaults.test.ts` (last-used defaults from the newest invite), new `lib/forms/zod.ts` (shared `optionalInt`, replacing the copies in `invites/actions.ts` and `profiles/actions.ts`).

**What changes.** `PageHeader` with **New invite**; `/invites?new=1` opens the dialog on load. Dialog fields: label, profile, link expiry select (7 days · 30 days · never), uses (1 · 5 · unlimited), account expiry with a "profile default" placeholder, require email, note; defaults from the newest invite. On success the dialog shows the link in a `CopyField` with Copy and Done. Table: Label · Status · Profile · Uses · Expires · Signed up · actions (copy, revoke via `ConfirmDialog`); `EmptyState` explains invites and offers the button. The sequential `await inviteLink()` loop in the page becomes `Promise.all`.

**Verified by.** `defaults.test.ts`; `tests/integration/invites.itest.ts` passes; lint, typecheck, unit. Playwright: create an invite from the dialog, copy the link, revoke it; arrive via `/invites?new=1`; screenshots in both themes.

**Out of scope.** Invite service and token handling; the public signup page.

### 11. Invite acceptance and guest forms — `design/invite-acceptance`

**Files.** `app/(public)/layout.tsx` (guest scale, server name instead of the jellycrew bar; one `getServerStatus` call here and removed from the pages), `app/(public)/invite/[token]/page.tsx`, `signup-form.tsx`, new `lib/public/use-public-form.ts` (client hook: JSON submit, pending, error text, 429 mapping), `lib/public/form-errors.ts` and `form-errors.test.ts` (pure message mapping), new `components/ui/password-field.tsx` (client, show/hide), `app/(public)/reset/page.tsx`, `reset-request-form.tsx`, `reset/[token]/page.tsx`, `reset-form.tsx`, `app/(public)/me/verify/[token]/page.tsx`, `app/(public)/me/login-form.tsx` (hook only; the `/me` page itself is package 15). The four hand-rolled fetch implementations are deleted.

**What changes.** Per direction §4: "You're invited to <Server name>", one sentence on what happens, the admin's note as a quoted paragraph; one-column form at 16 px with 44 px controls, password show/hide with the minimum length as help, email with one line of why; inline error under the form from the handler's message; `SubmitButton`-style pending. Success: check icon, "Your account is ready", username, **Open <Server name>**, a link to the Jellyfin app downloads, the expiry sentence. Closed and invalid states share the layout and give one next step. Reset and verify pages adopt the same voice and scale.

**Verified by.** `form-errors.test.ts`; `tests/integration/invites.itest.ts` and `self-service.itest.ts` pass (handlers untouched); lint, typecheck, unit. Playwright at 390 in light and dark: full signup through a fresh invite, mismatched passwords, a taken username; measured control heights ≥ 44 px and no unlabeled inputs (`browser_evaluate`); desktop screenshot at 1440 for the layout.

**Out of scope.** Route handler request and response shapes (structured field errors are a proposal); the `/me` account page.

### 12. Settings — `design/settings`

**Files.** `app/(admin)/settings/page.tsx`, `app/(admin)/settings/loading.tsx`, `settings/actions.ts` (unchanged contracts; `SubmitButton`), new `components/settings/server-section.tsx`, `automation-section.tsx`, `lib/lifecycle/summary.ts` and `summary.test.ts` (pure: last result → "Ran 12 minutes ago: 2 disabled, 0 deleted, 0 errors").

**What changes.** One column of five `Section`s (Server, Automation, Accounts, Links, Email) with a sticky in-page index from 1024 px; facts as `KeyValue`; scheduler result as a sentence with details behind a native `<details>`; SMTP state as a sentence; every form uses `SubmitButton` and reports through the toast.

**Verified by.** `summary.test.ts`; lint, typecheck, unit. Playwright: save settings, run lifecycle now, test SMTP in the not-configured state; screenshots at 1440 and 390 in both themes.

**Out of scope.** Settings keys, env handling, scheduler.

### 13. Profiles — `design/profiles`

**Files.** `app/(admin)/profiles/page.tsx`, `profiles/[id]/page.tsx`, both `loading.tsx`, `profiles/actions.ts` (`createProfileAction` returns state for the dialog; `applyToMembersAction` preview opens a dialog instead of `?applyAll=1`), new `components/profiles/new-profile-dialog.tsx`, `members-table.tsx`.

**What changes.** `PageHeader` with **New profile** opening a dialog (name, description, defaults, start from blank / user snapshot / clone); table with `Row` links, drift as a warn badge; detail page: Details and Members in the rail, policy editor (package 9) in the main column, apply-to-all preview in a `Dialog`, delete in the Danger section via `ConfirmDialog`; `EmptyState` on first run.

**Verified by.** Lint, typecheck, unit. Playwright: create blank, from user and clone; apply to all with preview; delete a throwaway profile; screenshots in both themes.

**Out of scope.** Profile service.

### 14. Sessions and audit — `design/sessions-and-audit`

**Files.** `app/(admin)/sessions/page.tsx`, `audit/page.tsx`, both `loading.tsx`, `components/sessions/sessions-table.tsx`, `devices-table.tsx`, new `components/sessions/summary-strip.tsx`, `message-dialog.tsx`, rework `components/auto-refresh.tsx` (live indicator, unchanged refresh mechanism), `audit/export/route.ts` untouched.

**What changes.** Sessions: stat strip (streams, transcodes, users, sessions), `next/form` filters that submit on change, per-row Stop and Message (message in a `Dialog`), device revoke via `ConfirmDialog`, `EmptyState`s. Audit: filters on `next/form` with auto-submit, actor and user as names with ids in tooltips, before/after/detail behind a `<details>` with formatted JSON instead of truncated cells, "Older entries" as a button-styled link, export links in the header.

**Verified by.** Lint, typecheck, unit. Playwright: play something in the dev Jellyfin web UI to get a live session, stop it and send a message; audit filters update the URL through client navigation; screenshots in both themes.

**Out of scope.** Session cache, export format.

### 15. Self-service and login — `design/self-service-and-login`

**Files.** `app/(public)/me/page.tsx`, `me/actions.ts` (`SubmitButton`, toast), `app/login/page.tsx`, `login-form.tsx`.

**What changes.** `/me` at guest scale: greeting, status alert when disabled, Overview as `KeyValue`, Password and Email as `Section`s with `Field`s and 44 px controls, Sessions and Devices as compact tables with revoke via `ConfirmDialog`. Login: centred card on the canvas, accent primary button, server name, unreachable alert in system style.

**Verified by.** `tests/integration/self-service.itest.ts` passes; lint, typecheck, unit. Playwright at 390 and 1440 in both themes: sign in as a test user, change password, add an email in the not-configured state; admin login.

**Out of scope.** Session cookies and login logic.

### 16. Polish, sweep, document — `design/polish`

**Files.** Whatever the sweep finds; `app/globals.css` (remove `@custom-variant dark`), `docs/design/audit.md` (re-score), `DESIGN.md` (generated), `DECISIONS.md`.

**What changes.** Grep for leftover `zinc-*`, `dark:`, `text-[11px]`, raw `<code>` ids and `title`-only affordances and fix them; run `impeccable detect --json app components` and `/impeccable polish`; run `/impeccable document` to write `DESIGN.md` from the shipped code; re-run the audit measurements (targets, unlabeled inputs, focus, `aria-sort`, `aria-current`, contrast test) and record the new score.

**Verified by.** Everything in the definition of done plus a full screenshot set of every screen in both themes at both widths, compared against `direction.md`.

**Out of scope.** New features.

## Where audit findings land

| Finding | Package |
|---|---|
| No focus styles, sub-AA grey, 11 px text | 1, 2, 16 |
| Two tokens, hard-coded palette, dark surfaces without hierarchy | 1, then every package as it touches files |
| No loading, error or pending feedback | 2 (`SubmitButton`), 4 (`loading.tsx`, toast) |
| Destructive actions always expanded and mixed with routine ones | 4, 8, 13 |
| Result messages and reset link in the URL | 4 (toast strips params), 8 (reset link and copy preview via action state) |
| Small touch targets on guest pages | 2 (sizes), 11 |
| Header overflow, no `aria-current` | 5 |
| No `aria-sort`, unicode arrows, colour-named badge tones | 3 |
| Users table density and filters | 6 |
| Seven-card detail page | 7, 8 |
| Invite form placement and numeric conventions | 10 |
| Invite acceptance tone and states | 11 |
| Raw JSON in settings | 12 |
| Four copies of `back()`, two of `optionalInt`, four fetch forms | 4, 10, 11 |
| Sequential invite-link loop, detail-page previews outside `Promise.all` | 10, 7 |
| Boolean and mode props (`selectable`, `showUser`, `scope`) | 6, 7, 9 |
| `CopyButton` timer, avatar lazy loading, `cn` conflicts | 3, 2 |

## Proposals that touch off-limits layers (not in any package)

1. Wrap `getServerStatus`, `listDevices`, `listSessions` and `getReferenceData` in `React.cache()` in `lib/services` to remove the duplicate Jellyfin calls per request.
2. Return `{ field, message }` errors from the public route handlers so guest forms can show inline, per-field errors; until then the UI shows the single message returned today.
3. Unseal invite links in parallel inside `lib/services/invites.ts` if `listInvites` ever returns links itself (the page-level loop is fixed in package 10 without touching the service).

## Risks and how they are handled

- `light-dark()`, native `<dialog>` and the Popover API are used without polyfills; they are supported by every browser released since early 2024, which matches a homelab audience. Package 1 and 4 note the baseline in `DECISIONS.md`.
- `useSearchParams` in the toast requires a `Suspense` boundary in the layouts; package 4 adds it.
- `next/form` with auto-submitting selects is verified by the network log in package 6 before the pattern is reused in 14.
- There are no component tests and no dependency budget for them; verification stays with unit tests for pure logic, integration tests for services and Playwright captures for the UI.
