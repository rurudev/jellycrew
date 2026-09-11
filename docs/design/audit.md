# UI audit (Phase 1, 2026-09-11)

Read-only findings. No proposals here; see `direction.md`.

Evidence: full read of `app/` and `components/` (about 4,400 lines), `impeccable detect` (0 mechanical findings), Playwright screenshots of the unauthenticated pages in light, dark, desktop and mobile (`/login`, `/me`, `/reset`, invalid invite, reset and verify tokens). Admin screens could not be captured this session: the Playwright MCP has no Chrome to launch and the auto-mode permission classifier refused a scripted sign-in. Admin-screen findings below are derived from the code and marked *(code)*.

## 1. Current UI architecture

- **Routing.** App Router. Route groups `(admin)` (users, profiles, invites, sessions, audit, settings; `layout.tsx` calls `requireAdmin` and `getServerStatus`) and `(public)` (invite, me, reset, verify). `/login` sits outside both groups with its own `<main>`. `/api/public/*` route handlers back the public forms. `/` redirects to `/users`.
- **Layout.** Root layout loads Geist Sans and Geist Mono and sets `text-sm` on `<body>`. Admin layout: single top bar (brand, six links, server status, user name, sign-out) over a `max-w-7xl` main. Public layout: brand bar over `max-w-2xl`. No `loading.tsx`, no `Suspense`, no `not-found.tsx`; one `error.tsx` for the admin group.
- **Component tree.** Pages are async server components that compose seven hand-written primitives in `components/ui` (Button, Input/Select/Textarea, Label/Help, Card/CardTitle, Table/Th/Td/EmptyRow, Badge, Alert) and domain components (`users/*`, `policy/*`, `sessions/*`, `invites/copy-button`). No component library, no icons (0 SVGs; sort arrows are `▲▼` text). Eleven client components: three `useActionState` forms (login, bulk, policy editor), four hand-rolled `fetch` forms (signup, self-login, reset request, reset), `ConfirmForm`, `CopyButton`, `AutoRefresh`, `error.tsx`.
- **Styling and tokens.** Tailwind 4.3.3 via `@tailwindcss/postcss`. `globals.css` defines exactly two tokens (`--background`, `--foreground`) plus a `prefers-color-scheme` override. Every other colour is a hard-coded palette utility: 191 `zinc-*` uses and 70 `dark:` variants across 20 files. Dark mode is OS-preference only; no `data-theme`, no toggle. `cn()` is `filter(Boolean).join(" ")`, so `className` overrides such as `w-auto` on a `w-full` Select depend on stylesheet order.
- **State and data.** Everything renders per request on the server. List filter and sort state live in the URL (`lib/users/query.ts`). Mutations are server actions that `redirect()` back with `?ok=`/`?error=` query params rendered by `components/notice.tsx` (8 callers). `AutoRefresh` calls `router.refresh()` every 10 s on the sessions page. No client data library.
- **Form handling.** Three coexisting patterns: plain `<form action={serverAction}>` with redirect-and-notice (most admin forms); `useActionState` with a state object (login, bulk preview/execute, policy preview/confirm); client `onSubmit` + `fetch` to `/api/public` with local `pending`/`error` state (four public forms, near-identical code). Validation is zod inside actions; only the first issue is surfaced, as a page-level alert, and the form re-renders from server data so typed values are lost.
- **Self-inconsistencies.** Page titles are `text-lg` on list pages, `text-xl` on detail pages, `text-2xl` on public pages. Breadcrumbs are ad-hoc `text-xs` spans. Cancel is a `<Link>` in one place and a raw `<a>` in another. "Disable" is a red danger button in the user header while "Delete now" is a secondary button. Badge tones are palette names (`purple`, `blue`) chosen per call site; `lib/users/status.ts` returns colour names, coupling domain code to the palette. Create forms sit below the list on Profiles and Invites, so a first-run admin sees an empty table first. Help text appears sometimes above and sometimes below the submit button. Five hand-built `<dl>` grids with different column widths (`8rem`, `10rem`).

## 2. Impeccable audit (technical)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | No `focus-visible` styles anywhere (0 uses); sort headers lack `aria-sort`; nav lacks `aria-current`; `zinc-400` on white is about 2.5:1 in light mode (it passes on the dark background) and is used for "never", "—", "none", ids and hints; five `text-[11px]` uses; absolute timestamps only in `title`, unreachable by keyboard or touch. |
| 2 | Performance | 3 | Server-rendered with small client bundles, but no streaming: each navigation blocks on every Jellyfin call. Duplicate fetches per request (see §4). `<img>` avatars without `loading="lazy"`. |
| 3 | Responsive | 2 | Public pages verified fine at 390 px (no overflow). Controls measure 34 px (inputs), 36 px (buttons), 28 px (`size="sm"`), 18 px (text links), all under the 44 px touch floor. *(code)* Admin header is a non-wrapping flex row with nine items; the 10-column users table scrolls horizontally with no sticky name column. |
| 4 | Theming | 1 | Two tokens; all other colour hard-coded with paired `dark:` classes. Dark cards (`zinc-950`) on a `#0a0a0a` body have almost no surface separation. Alerts and badges use bright pastel fills in both themes. No theme choice beyond the OS. |
| 5 | Implementation integrity | 3 | Detector: 0 findings. Primitives are used consistently and copy is careful. Visually it is an unbranded Tailwind starter: zinc, Geist, black primary button, no accent, no icon language. |
| **Total** | | **11/20** | **Acceptable: significant work needed** |

### Findings by severity

- **[P1] Keyboard focus is browser-default only.** `Button`, links, checkboxes and sort headers have no `focus-visible` treatment; inputs set `outline-none` and rely on a 1 px ring. Category: Accessibility. Impact: keyboard users cannot reliably see where they are. `components/ui/button.tsx`, `components/ui/input.tsx`, `components/users/users-table.tsx`.
- **[P1] Sub-AA contrast on informational text in light mode.** `text-zinc-400` (about 2.5:1 on white) is used for values ("never", "none", "—", ids, help), not decoration. Category: Accessibility (WCAG 1.4.3). 20+ call sites.
- **[P1] No loading or error feedback inside pages.** No `loading.tsx`, no `Suspense`, no pending state on plain server-action forms (only the three `useActionState` forms show "Working…"). Category: Performance/UX. Impact: clicks feel dead for the duration of Jellyfin round trips. `app/(admin)/**`.
- **[P1] Destructive actions are always-expanded, mixed with routine ones.** Schedule-deletion and delete-now typed-confirm forms are permanently visible on the user page; "Disable" is a red button in the primary header next to "Edit access". Category: Integrity/UX. `components/users/lifecycle-card.tsx`, `app/(admin)/users/[id]/page.tsx`.
- **[P2] Result messages travel in the URL.** `?ok=`/`?error=` persist on reload, bookmark and back-navigation, and a reset link is placed in `?resetLink=` (browser history). Category: Integrity. `lib/notice.ts`, `app/(admin)/users/[id]/reset-actions.ts`.
- **[P2] Touch targets under 44 px on the invitee flow.** Measured: inputs 34 px, button 36 px, links 18 px. Category: Responsive. `components/ui/input.tsx`, `components/ui/button.tsx`.
- **[P2] Dark theme lacks surface hierarchy.** Body `#0a0a0a`, cards `zinc-950` (#09090b), inputs `zinc-900`. Category: Theming. `app/globals.css`, `components/ui/card.tsx`.
- **[P2] Sort and current-page state not exposed to assistive tech.** Category: Accessibility. `users-table.tsx`, `(admin)/layout.tsx`.
- **[P2] Header overflow on narrow viewports.** *(code)* `flex items-center gap-6` with no wrap. Category: Responsive. `app/(admin)/layout.tsx`.
- **[P3] 11 px text** for field keys and ids (5 uses). Category: Accessibility.
- **[P3] Unicode sort arrows and `code` tags for ids** stand in for an icon and type system. Category: Integrity.

### Positive findings

Server components by default; every action authenticates inside itself (`adminActor`, `requireSelf`); URL-state filters; progressive-enhancement-friendly forms; consistent ternary conditionals; explicit `aria-label`s on unlabeled filter inputs (0 unlabeled controls found on public pages); all typed-confirm patterns and preview-then-confirm flows already exist and only need better presentation; copy is plain and honest.

## 3. Screens: concrete UX problems

**Users list** *(code)*. Ten columns including two relative-time columns and two live-count columns; five differently coloured badge kinds in one row (admin, hidden, status, drift, labels). Filters require an "Apply" button and a full navigation; sorting is a full navigation; no select-all, no selection count; bulk controls sit above the table and their preview and results render as blue alerts pushing the table down. Empty state is one line with no reset action. No loading state.

**User detail and edit** *(code)*. Seven stacked cards (Profile, Lifecycle, Access with all 44 fields, Sessions, Devices, Actions, History) with no in-page navigation. Header shows the raw user id in `<code>`. Rename, set-password and copy-policy are three side-by-side forms in an "Actions" card; reset-link buttons sit above them. Lifecycle mixes an editable form with a read-only facts list and the two destructive confirms. The Access read-only view shows every field with its raw key, so a homelab admin reads 44 rows to find the two that matter. Editing is a separate route with the same 44 fields in a two-column grid; grouped/raw switch is two unstyled text buttons.

**Create/invite** *(code)*. There is no direct "create user"; invites are the path, but the form is below the invites table and the primary action is at the bottom of the page. Three numeric inputs use three conventions ("0 = never", "0 = unlimited", "blank = profile default"). The link appears once in a success alert. Eight-column table.

**Invite acceptance.** Verified: invalid-token state is a bare red alert under a "jellycrew" brand bar with no next step; invitees do not know what jellycrew is. *(code)* Valid state: title "Join <server>", the admin's note in a blue info alert, four stacked fields, no show-password, success is an alert with a numbered list and a raw URL. Layout holds at 390 px; targets are small (see P2).

**Settings** *(code)*. Four cards in a two-column grid. "Jellyfin server" mixes health facts and env config; scheduler shows the last result as raw JSON in a `<pre>`; SMTP shows the raw test string. Save feedback only via URL notice.

**Public pages (verified).** Login is centred and legible in both themes; the dark primary button is a white slab. `/me` logged-out and `/reset` are clear. All token-error pages are a lone alert with a single underlined link.

## 4. Vercel best-practices and composition review

`vercel-react-best-practices` is installed; `composition-patterns` is not installed in this environment, so those checks were applied from the pattern set (compound components, no boolean-prop switches, lift shared state, prefer children over config).

1. **Duplicate and sequential fetches (async-parallel, server-cache-react).** `getServerStatus()` is called in the admin layout and again by `/login`, `/invite`, `/reset`, `getHealth` and `getSelfOverview`, with no `React.cache`. `listDevices()` is fetched twice on the user detail page (`getUserDetail` and `getReferenceData`) and twice on the sessions page. `previewAdopt` and the copy-policy preview run after the page's `Promise.all` instead of inside it. `listInvites` links are unsealed in a sequential `for … await` loop.
2. **No streaming (async-suspense-boundaries).** Zero Suspense boundaries and no `loading.tsx`; the sessions page re-renders the entire tree every 10 s.
3. **Duplicated form logic.** Four public forms re-implement `pending`/`error`/`fetch`/429 handling; four action files copy the same `back()` helper; two files define the same `optionalInt` preprocess; every action repeats `issues[0]?.message ?? "Invalid input."`.
4. **Boolean and mode props.** `SessionsTable showUser`, `DevicesTable showUser`, `UsersTable selectable`, `PolicyEditor scope: PolicyScope | "all"` plus `hidden` record and `cancelHref` (seven props). `Badge`/`Alert` tones are colours rather than meanings.
5. **Client components** are already minimal; no effect chains beyond `AutoRefresh`. `CopyButton` leaves a `setTimeout` uncleared on unmount (minor).
6. **Serialization** is modest; the policy editor sends the full policy twice (props and hidden input), acceptable at 44 fields.
7. **Auth in actions** is correct throughout (server-auth-actions).

## 5. Environment notes for the next session

- Dev server on :3000 and the disposable Jellyfin container are running; the dev database holds only the seed admin, no profiles, no invites.
- Chromium (Playwright build 1200) is now in `~/Library/Caches/ms-playwright`; the MCP still launches the `chrome` channel. Adding `"--browser", "chromium"` to the Playwright args in `.mcp.json` fixes it.
- Screenshots from this session: session scratchpad `shots/` (24 public-page captures).
