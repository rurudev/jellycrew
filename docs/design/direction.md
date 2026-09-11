# Design direction

Status: draft for review (Phase 2, 2026-09-11). Built on `audit.md` and the brief: a calm, dense, self-hosted admin tool; dark-first with a real light mode; one accent; typography carries hierarchy; minimal motion; the invite flow is the one warm, simple surface.

## 1. What the product is, in design terms

Two surfaces, one system.

- **Console** (`/users`, `/profiles`, `/invites`, `/sessions`, `/audit`, `/settings`, `/login`). Mode: operate. One admin, mostly on a desktop, doing three things: scan everyone's state, fix one person, invite one person. It should read like a well-made infrastructure dashboard: dense tables, quiet chrome, keyboard reachable, nothing decorative.
- **Guest** (`/invite/*`, `/me`, `/reset*`). Mode: operate, warm variant. Non-technical family and friends on phones. Larger type, one column, generous targets, plain words, the server's name rather than ours.

Both use the same tokens and primitives; the guest surface changes scale and density, not identity.

## 2. Design system

### 2.1 Colour

Neutral ramp with a faint cool cast, one accent, four semantic tones. Everything is a CSS variable in `globals.css`, exposed to Tailwind through `@theme inline` so classes read as meaning (`bg-card`, `text-muted-foreground`, `border-border`) and never as palette (`zinc-800`).

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--background` | `#0c0d10` | `#f6f6f8` | page |
| `--card` (= `--popover`) | `#14161a` | `#ffffff` | tables, sections, dialogs |
| `--muted` (= `--secondary`, `--accent`) | `#1b1e24` | `#f1f2f5` | inputs, hover rows, alternate fills |
| `--border` | `#272b33` | `#e2e4e9` | hairlines |
| `--input` | `#626977` | `#868d98` | control borders and dividers that must be seen (≥ 3:1 on background and card) |
| `--foreground` | `#e8eaed` | `#15171c` | primary text |
| `--muted-foreground` | `#9aa2ad` | `#4f5663` | secondary text, labels (≥ 5.5:1 on every surface) |
| `--primary` (= `--ring`) | `#9d97ff` | `#5b4fe0` | links, primary buttons, focus ring, selected, active nav |
| `--primary-foreground` | `#0c0d10` | `#ffffff` | text on primary |
| `--success`, `--warning`, `--destructive` | `#4ade80`, `#fbbf24`, `#f87171` | `#11703a`, `#9a4707`, `#b91c1c` | status text and dots |
| soft fills | tone at 15 % (`bg-warning/15`) | tone at 10 % (`bg-warning/10`) | badge and alert fills |

The names are shadcn's, so every shadcn component works unchanged; `--secondary`, `--accent` (shadcn's hover fill, not the brand colour) and `--popover` are aliases of the tokens above. Two text levels only: `foreground` and `muted-foreground`.

Rules: colour means something or it is neutral. Status uses the semantic tones; labels are neutral chips; "admin" and "hidden" are muted mono tags, not purple badges. The primary colour appears in at most three places per screen (primary action, focus, current-nav). The zinc-400-style "subtle" grey is retired from informational text. Contrast of every token pair is enforced by `lib/ui/contrast.test.ts`, which reads the values out of `globals.css`; the table above shows the shipped values.

### 2.2 Typography

Geist Sans and Geist Mono stay (already loaded via `next/font`). Type does the hierarchy work, so the scale is small and strict:

| Step | Size / line | Weight | Where |
|---|---|---|---|
| `mono-xs` | 11 / 16 mono | 400 | raw field keys and ids, only behind an explicit "show field names" toggle |
| `xs` | 12 / 16 | 400–500 | table meta, chips, help text |
| `sm` | 13 / 18 | 400–500 | console body, table cells, inputs |
| `md` | 14 / 20 | 400–500 | console section titles; guest body |
| `lg` | 16 / 22 | 600 | console page titles |
| `xl` | 20 / 26 | 600 | guest headings |
| `2xl` | 26 / 32 | 600 | guest hero ("You're invited to Jellyfin at home") |

Console base is 13 px (Linear's density); guest base is 16 px. All numbers and timestamps use `tabular-nums`. Weight 600 is the only bold. No uppercase tracking on table headers; headers are `xs`, muted, weight 500.

### 2.3 Spacing, shape, elevation

- 4 px base. Console rhythm: 8 inside controls, 12 between fields, 16 inside sections, 24 between sections. Guest rhythm doubles the last two.
- Control heights: console 32 px (inputs, buttons, selects), compact 28 px inside table rows; guest 44 px.
- Table rows 36 px, sticky header, 12 px cell padding, hairline row separators, hover fill `surface-2`, selected fill `accent-soft`.
- Radius: 4 badges and chips, 6 controls, 8 sections and dialogs. Sections are `surface` with a 1 px `edge` border and no shadow. Only dialogs and popovers get one shadow.
- Page: 24 px gutter (16 on mobile), content max 1280 px, tables may use the full width.

### 2.4 Motion

Motion only where it explains a state change, never as decoration.

- Durations: 120 ms hover and focus, 160 ms dialog and popover enter, 200 ms toast enter and leave. One easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Allowed: dialog fade-and-lift, toast slide-in, a 600 ms background flash on a table row that was just changed, checkbox and toggle transitions. Skeletons are static blocks, no shimmer.
- `prefers-reduced-motion: reduce` collapses all of the above to instant, except opacity fades of 80 ms.

### 2.5 Dark and light

Dark is the default and the design target; light is a first-class mirror, not an inversion. A `data-theme` attribute on `<html>` with values `dark`, `light` or absent (follow system) is set from a `jellycrew_theme` cookie read in the root layout, so the server renders the right theme without a flash. The toggle in the console header cycles system → light → dark and writes the cookie from the browser itself, so switching is instant and never re-renders the page. The guest surface follows the same cookie and otherwise the OS.

### 2.6 Keyboard

- Visible focus on everything: 2 px `accent` ring with 2 px offset, `focus-visible` only.
- `/` focuses the search on list pages; `Esc` closes dialogs and clears a focused search; Enter on a focused table row opens it; sortable headers are real buttons with `aria-sort`.
- Skip link to main. Current nav item carries `aria-current="page"`.
- Typed confirmations remain the only guard on destructive actions; they live inside dialogs so they are not on the page until asked for.

## 3. Component strategy

### Shared primitives (`components/ui`)

shadcn/ui (Base UI, "nova" preset, lucide icons) is the primitive layer; its components are copied into `components/ui` by the CLI and owned by the project, so they are restyled through the tokens above and edited where the direction needs it (button sizes, tone variants). App-specific compositions wrap them rather than forking them. Icons come from `lucide-react` only; no hand-drawn SVGs.

From shadcn, restyled through the tokens:

- **Button** (`default | outline | ghost | destructive | link`; sizes `xs | sm | default | lg`, where `lg` is the 44 px guest size). `SubmitButton` wraps it with `useFormStatus` and a `Spinner`, so every plain server-action form shows pending state without local code. Navigation that looks like a button uses `render={<Link />}`; a button is never nested in a link.
- **Input, Textarea, NativeSelect, Label, Field** (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`); `FormField` composes them into one labelled control (`id`, `label`, `help`, `error`) that wires `aria-describedby` and `aria-invalid`.
- **Card** as the surface for `Section` (one real `h2`, description, action slot).
- **Table**, **Badge** (with `success | warning | destructive | outline` tones), **Alert**, **Empty**, **Skeleton**, **Kbd**, **Spinner**, **Tooltip**, **Dialog** and **AlertDialog**, **DropdownMenu**, **Tabs**, **Sonner** (toasts), added by the packages that need them.

App compositions:

- **PageHeader**: breadcrumb, title, count, actions. One `h1` per page at one size.
- **Section** over Card; **KeyValue** (`<dl>` grid, stacks on phones) for facts; **StatusBadge** (tone by meaning) and **Chip** over Badge; **Timestamp**; **CopyField**; **ThemeToggle**; **EmptyState** over Empty; **ConfirmDialog** over AlertDialog with the typed-phrase guard; **Toast** over Sonner that reads the `?ok=`/`?error=` params, shows them and strips them from the URL.

Deleted: the hand-written `Card`, `CardTitle`, `Label`, `Help`, `EmptyRow`, `Notice`, `ConfirmForm`, the hand-drawn icon set, the four hand-rolled public fetch forms (one `usePublicForm` hook), and the four copies of the `back()` redirect helper.

### Composition rules

- No boolean switches that change what a component *is*: `SessionsTable` and `DevicesTable` take a `columns` list or are split into user-scoped variants; `UsersTable` receives selection as a child slot rather than `selectable`.
- Tone and status props are meanings, never colours.
- Forms compose `Field`s; pages compose `Section`s; nothing reaches for raw `zinc-*` or `dark:` classes.
- Client components stay at the leaves: dialogs, toasts, the theme toggle, the policy editor, the bulk selection bar.

## 4. Screens

### Console shell

Top bar stays (it keeps the full width for tables): brand as a small wordmark, six links with `aria-current`, a server-status dot with name and version on the right, theme toggle, user name, sign out. On narrow screens the links become a horizontally scrolling row and the status collapses to the dot. Every console route gets a `loading.tsx` skeleton and the shared `error.tsx` styled with the system.

### Users list

- Header: "Users · 12", primary action **Invite** (there is no direct create, and this makes that honest).
- Toolbar: one search input (Enter submits, `/` focuses), filter selects that submit on change through `next/form` so the URL stays the source of truth without an Apply button, active filters shown as removable chips, Reset.
- Table, 7 columns: User (avatar, name, muted mono tags for admin and hidden) · Status · Profile (drift as a warn dot with tooltip) · Last seen (activity, login in the tooltip) · Expiry · Labels · Sessions (only rendered when > 0, as an accent dot and count). Devices moves to the detail page. Rows are links; sticky header; hover and selected fills.
- Selection: select-all in the header, a sticky bottom bar appears with "3 selected", the action select, its parameter, and **Preview**. Preview and results open in a dialog with the per-user diff table; the table underneath does not move.
- States: skeleton rows while loading; empty state with "Clear filters"; server-unreachable alert from the layout.

### User detail

- Header: avatar, name, tags, status badge, then **Edit access** (primary) and a **More** menu with Rename, Set password, Generate reset link, Email reset link, Copy policy from…, Enable/Disable, Schedule deletion, Delete now. Each opens a dialog; the destructive three use `ConfirmDialog`. The raw id moves into the facts list.
- Body, two columns on wide screens. Main: **Access** (only fields that differ from the assigned profile or from defaults, with "Show all 44 fields" and "Show field names" toggles), **Sessions**, **Devices**, **History**. Rail: **Profile** (assigned, drift diff, Apply and Adopt), **Lifecycle** (email, labels, expiry, inactivity, notes as `Field`s with one Save), **Facts** (id, first seen, last login, last activity, disabled-by-app, deletion schedule).
- Result: seven cards become five sections and three dialogs; nothing destructive is visible until asked for.

### Policy editor (`/users/[id]/policy`, profile page)

Same route and data flow. A sticky left index of the ten groups, fields as `Field`s with the raw key hidden behind the toggle, grouped/raw as real tabs, Preview and Confirm in a sticky bottom bar with the diff in a dialog. Stale-write alert stays inline where it is.

### Create / invite

- Invites page: header with **New invite** (primary) opening a dialog: label, profile, link expiry as a select (7 days · 30 days · never), uses (1 · 5 · unlimited), account expiry (days, "profile default" placeholder), require email, note. Defaults are the last used values so a repeat invite takes seconds.
- After creation the dialog turns into the link (`CopyField`) with "Copy" and "Done". The link is also copyable from the row later.
- Table: Label · Status · Profile · Uses · Expires · Signed up · actions (copy, revoke via `ConfirmDialog`). Empty state says what an invite is and offers the button.

### Invite acceptance (guest, warm)

- No "jellycrew" bar. Title: "You're invited to <Server name>", one sentence on what happens next, the admin's note as a plain quoted paragraph.
- Form in one column at 16 px with 44 px controls: username, password with show/hide and the minimum length as help, email with one line of why. Inline field errors from the existing API messages; the submit button shows pending.
- Success: a check icon, "Your account is ready", the username restated, **Open <Server name>** as the primary button, a secondary link to the Jellyfin app downloads, and the expiry sentence if any.
- Closed or invalid link: same layout, calm tone, one clear next step ("Ask the person who invited you for a new link").
- `/me`, `/reset` and the token pages inherit this scale and voice.

### Settings

One column of sections with a sticky in-page index on wide screens: **Server** (name, version, target, health, URL), **Automation** (last run as a sentence such as "Ran 12 minutes ago: 2 disabled, 0 deleted, 0 errors", details behind a disclosure, Run now), **Accounts** (grace period, minimum password length), **Links** (public base URL, Jellyfin URL for users), **Email** (configured or not, last test as a sentence, test form). Every form uses `SubmitButton`; results arrive as toasts.

### Profiles, sessions, audit, login

Inherit the primitives: create-profile becomes a dialog; the sessions summary becomes a small stat strip above the table; audit before/after/detail render in a disclosure instead of truncated JSON; login gets the accent primary button and the unreachable-server alert in the system style.

## 5. Open decisions

1. **Accent hue.** Recommend indigo-violet (`#9d97ff` dark, `#5b4fe0` light): it sits next to Jellyfin's purple-to-blue without copying it.
2. **Icons and primitives.** Decided by Rudi (2026-09-11): shadcn/ui components where they fit and `lucide-react` for icons, instead of hand-written primitives and SVGs.
3. **Shell.** Recommend keeping the top bar over a sidebar: six sections fit, and tables get the width.
4. **Users table columns.** Recommend dropping Devices and merging Last login into Last seen: recency and status are what the admin acts on; counts are one click away.
5. **Theme persistence.** Recommend a plain `jellycrew_theme` cookie read in the root layout over `localStorage` plus a pre-hydration script: no flash, no inline script, and it is a UI preference, not session handling.

## 6. Assumptions

- No i18n layer exists and none is added; copy is centralised in components rather than scattered, in English.
- Server actions, redirect-with-notice and URL-state filters remain the mutation and state model; only their presentation changes.
- Progressive enhancement of console forms is preserved (they still submit without JavaScript); dialogs degrade to their content rendered inline behind a details element only where cheap, otherwise they require JavaScript, which is acceptable for the admin console but not for the guest forms.
- The public route handlers keep their request and response shapes; guest forms only change how they render.
- The Docker image is unchanged in shape; shadcn adds `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css` and the `shadcn` package as regular dependencies. Fonts stay with `next/font`.
- Dev sign-in for screenshots uses the credentials documented in the README.

## 7. Proposals that touch off-limits layers (not done without approval)

- Wrap `getServerStatus`, `listDevices`, `listSessions` and `getReferenceData` in `React.cache()` inside `lib/services` to remove the duplicate Jellyfin calls per request found in the audit.
- Replace the sequential invite-link unsealing in `listInvites`/`inviteLink` with `Promise.all`.
- Return structured field errors (`{ field, message }`) from the public route handlers so guest forms can show inline errors beyond the first; until then the UI shows the single message returned today.
- Add a `jellycrew_theme` cookie to the list of cookies the proxy passes through untouched, if the proxy ever strips unknown cookies (it does not today; noted for completeness).
