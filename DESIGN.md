# Design system

What jellycrew's interface is made of, written from the code that shipped. The reasoning behind
each choice is in `DECISIONS.md`; the brief it was built against is in `docs/design/direction.md`.

## Two surfaces

**The console** (`app/(admin)`) is for one person who runs the server. It is dense, tabular and
keyboard-friendly: 14 px text, 32 px controls, a 44 px top bar, tables over cards.

**The guest surface** (`app/(public)`) is for people who were invited. It is one column at 16 px
with 44 px controls, carries the *server's* name rather than the tool's, and never mentions
jellycrew. Both share the same tokens and components.

## Tokens

All of them live in `app/globals.css` as CSS custom properties, mapped into Tailwind with
`@theme inline`. Dark is the default on `:root`; `[data-theme="light"]` switches, and the
choice is stored in the `jellycrew_theme` cookie so the server renders the right one.

| Token | Use |
| --- | --- |
| `--background`, `--foreground` | the page and its text |
| `--card`, `--popover` | raised surfaces: sections, dialogs, menus |
| `--muted`, `--muted-foreground` | secondary text, help, fills |
| `--accent` | hover fill, never brand |
| `--primary` (= `--ring`) | the one accent: primary buttons, focus, current nav |
| `--border`, `--input` | hairlines, and control borders at 3:1 |
| `--destructive`, `--success`, `--warning` | status tones |
| `--radius` | 0.5 rem, with cards one step larger |
| `--duration-fast/base/slow/fade`, `--ease-standard` | motion, zeroed under reduced motion |

`lib/ui/contrast.test.ts` reads the stylesheet and fails the build if a token pair drops below
its floor: 7:1 for body text, 5.5:1 for muted text, 4.5:1 for status tones, 3:1 for control
borders, in both themes.

Type scale: 12, 13, 14, 16, 20, 26 px. Hierarchy comes from size and weight, not from colour or
rules. Numbers are `tabular-nums` everywhere they line up.

## Components

`components/ui` holds shadcn/ui pieces (Base UI under the hood, `nova` preset) and the app's own
compositions. The pieces are owned, not vendored: they are edited freely.

**Form and layout**: `FormField` (label, control, help, error, with the control's `id` and
`aria-describedby` wired up, and `controlClassName` to narrow a control without narrowing its
help), `Section` (a card with one real heading, at `h2` or `h3`), `PageHeader` (breadcrumb, title,
count, description, actions), `KeyValue` (facts as a definition list), `SectionIndex` (the sticky
jump list used by the policy editor and settings).

**Tables**: `Table` with `card` and `plain` variants, `SortHead` (a full-cell link with
`aria-sort`), `LinkRow` (a row that navigates on a non-interactive click while the first cell
keeps a real link), `EmptyState.Row` (a title, one line, at most one action).

**Status**: `StatusBadge` and `StatusDot` over five tones, `Chip` and `Tag` for labels and
metadata, `Callout` for persistent notices, `Timestamp` (relative text, absolute in the tooltip).

**Dialogs and feedback**: `DialogHost` (one dialog per page, many triggers, remounted on each
open, openable by a query parameter), `ConfirmDialog` (destructive confirmation, with an optional
type-to-confirm phrase), `NoticeToast` and sonner for results, `Spinner` and `SubmitButton` for
pending state, `page-skeleton` for `loading.tsx`.

**Guest**: `PasswordField` (show/hide), `GuestMessage` (a whole page that is one message),
`usePublicForm` and `publicErrorMessage` for the public API.

## Patterns that repeat

- **Write in two steps.** Anything that changes Jellyfin previews first: the diff or the affected
  list appears in a dialog, and only the confirm button writes. Editing after a preview retires it.
- **State lives in the URL** for lists: filters are a GET form that submits on change, keyed on the
  query so fields never hold stale values. Chips show what is active; Clear removes it.
- **Results come back, not around.** Dialog actions return an `ActionState`, so links and previews
  never travel in the URL. Plain forms still redirect with a notice that becomes a toast.
- **Nothing destructive is rendered until asked for.** Deletions live behind menus and dialogs,
  never as a button in a row or a permanent danger panel.
- **An unavailable action stays visible** with the reason under it, rather than disappearing.
- **Say what is true.** Copy describes what a button does and what it does not: disabling blocks
  sign-in and does not end sessions; revoking a device signs it out and changes nothing else.

## Accessibility floor

Checked on every screen, in both themes, at 1440 and 390 px: one `h1` and a sensible heading
order, every control labelled, focus visible as a 2 px primary outline offset from the control,
`aria-current` on the current nav item and jump-list entry, `aria-sort` on sortable headers, no
horizontal page scroll, 44 px controls on the guest surface, and colour never the only signal (a
dot always sits next to words).
