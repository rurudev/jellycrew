# Authorization audit — jellycrew (Next.js 16 App Router, RSC + server actions)

> **Status, 2026-09-12.** Every finding below was verified against the code and fixed, except
> where noted in the repository's `DECISIONS.md`: the N+1 Jellyfin round trips (finding 4) and
> audit-table retention (finding 7, tokens are pruned, audit rows are kept on purpose) are open.
> This document is kept as the record of what was found and why the code looks the way it does.

Scope: **is authorization checked inside every state-mutating or sensitive-code-path server action and API route
handler?** Plus two secondary questions: (5) admin session re-validation against Jellyfin, (6) whether self-service
and `app/api/public/**` can touch another user.

`proxy.ts:19-20` only checks that the `jellycrew_admin` cookie *exists* (its own comment says full validation
happens in the layout and every action), so it is not authorization and is not counted as a guard below. A layout
(`app/(admin)/layout.tsx:25`) protects only the pages beneath it — not route handlers, not server actions — so
each entry point was checked on its own.

Method: `grep '"use server"'` (all extensions, whole repo), `glob app/**/route.ts`, `glob app/**/actions.ts`, plus
`find app -type f` to catch actions with non-standard names (`bulk-actions.ts`, `reset-actions.ts`,
`lifecycle-actions.ts`). Every exported async function was read and checked for a guard relative to its first
mutation/sensitive read. Export list cross-checked mechanically (`grep -nE "^export (async )?function|<guards>"`).

Guards in play:

- `lib/auth/session.ts:61` `requireAdmin()` — unseals the admin cookie; `redirect("/login")` when absent.
- `lib/auth/actor.ts:7` `adminActor()` — calls `requireAdmin()`; redirects to `/login` when absent.
- `lib/auth/session.ts:55` `getAdminSession()` — unseals the admin cookie, `null` when absent; callers must check it.
- `lib/auth/session.ts:78` `getSelfSession()`; `app/(public)/me/actions.ts:12` local `requireSelf()` — self cookie.
- `lib/public/http.ts:18` `originAllowed()` — CSRF origin check on public POSTs. It is **not** an auth guard (it
  returns `true` when no `Origin` header is present, i.e. for any non-browser client).
- Next.js itself rejects cross-origin server-action POSTs (`node_modules/next/dist/server/app-render/action-handler.js:438-460`),
  so server actions do not need `originAllowed`.

## Inventory — server actions (12 files, 36 exported actions)

| file | exported function | guard called | guarded before mutation? (yes/no/after) |
| --- | --- | --- | --- |
| `app/login/actions.ts` | `loginAction` | none by design; `loginAdmin` → `verifyCredentials` requires Jellyfin `Policy.IsAdministrator` (`lib/services/auth.ts:52-58`) | n/a — the unauthenticated entry point; session is set only after Jellyfin confirms admin |
| `app/(admin)/actions.ts` | `logoutAction` | `getAdminSession()` L9 (not `requireAdmin`) | n/a — clears only the caller's own cookie; audit row written only if a session exists |
| `app/(admin)/invites/actions.ts` | `createInviteAction` | `adminActor()` L23 | yes |
| `app/(admin)/invites/actions.ts` | `revokeInviteAction` | `adminActor()` L53 | yes |
| `app/(admin)/profiles/actions.ts` | `createProfileAction` | `adminActor()` L35 | yes |
| `app/(admin)/profiles/actions.ts` | `updateProfileAction` | `adminActor()` L54 | yes |
| `app/(admin)/profiles/actions.ts` | `deleteProfileAction` | `adminActor()` L69 | yes |
| `app/(admin)/profiles/actions.ts` | `saveProfilePolicyAction` | `adminActor()` L83 | yes |
| `app/(admin)/profiles/actions.ts` | `applyToMembersAction` | `adminActor()` L114 | yes (incl. the preview branch, L119) |
| `app/(admin)/sessions/actions.ts` | `stopPlaybackAction` | `adminActor()` L15 | yes |
| `app/(admin)/sessions/actions.ts` | `sendMessageAction` | `adminActor()` L29 | yes |
| `app/(admin)/sessions/actions.ts` | `revokeDeviceAction` | `adminActor()` L46 | yes |
| `app/(admin)/settings/actions.ts` | `saveSettingsAction` | `adminActor()` L28 | yes |
| `app/(admin)/settings/actions.ts` | `runLifecycleNowAction` | `adminActor()` L44 | yes |
| `app/(admin)/settings/actions.ts` | `testSmtpAction` | `adminActor()` L57 | yes |
| `app/(admin)/users/bulk-actions.ts` | `bulkAction` | `adminActor()` L34 | yes (L60 mutation is after the L34 guard) |
| `app/(admin)/users/[id]/actions.ts` | `setEnabledAction` | `adminActor()` L19 | yes |
| `app/(admin)/users/[id]/actions.ts` | `assignProfileAction` | `adminActor()` L33 | yes |
| `app/(admin)/users/[id]/actions.ts` | `applyProfileAction` | `adminActor()` L45 | yes |
| `app/(admin)/users/[id]/actions.ts` | `adoptIntoProfileAction` | `adminActor()` L59 | yes |
| `app/(admin)/users/[id]/actions.ts` | `renameUserAction` | `adminActor()` L74 | yes |
| `app/(admin)/users/[id]/actions.ts` | `setPasswordAction` | `adminActor()` L89 | yes |
| `app/(admin)/users/[id]/actions.ts` | `copyPolicyAction` | `adminActor()` L104 | yes |
| `app/(admin)/users/[id]/lifecycle-actions.ts` | `updateMetaAction` | `adminActor()` L19 | yes |
| `app/(admin)/users/[id]/lifecycle-actions.ts` | `scheduleDeletionAction` | `adminActor()` L49 | yes |
| `app/(admin)/users/[id]/lifecycle-actions.ts` | `cancelDeletionAction` | `adminActor()` L61 | yes |
| `app/(admin)/users/[id]/lifecycle-actions.ts` | `deleteNowAction` | `adminActor()` L72 | yes |
| `app/(admin)/users/[id]/policy/actions.ts` | `saveUserPolicyAction` | `adminActor()` L13 | yes |
| `app/(admin)/users/[id]/reset-actions.ts` | `createResetLinkAction` | `adminActor()` L12 | yes |
| `app/(admin)/users/[id]/reset-actions.ts` | `emailResetLinkAction` | `adminActor()` L26 | yes |
| `app/(admin)/users/[id]/reset-actions.ts` | `sendVerificationAction` | `adminActor()` L40 | yes |
| `app/(public)/me/actions.ts` | `logoutSelfAction` | `getSelfSession()` L19 | n/a — clears only the caller's own cookie |
| `app/(public)/me/actions.ts` | `changePasswordAction` | local `requireSelf()` L26 | yes |
| `app/(public)/me/actions.ts` | `setEmailAction` | local `requireSelf()` L42 | yes |
| `app/(public)/me/actions.ts` | `resendVerificationAction` | local `requireSelf()` L55 | yes |
| `app/(public)/me/actions.ts` | `revokeOwnDeviceAction` | local `requireSelf()` L66 | yes |

Result: **every admin action guards as its first statement; no action mutates before guarding, and no guard sits
only inside a bypassable branch.** No exported action was found unguarded.

## Inventory — route handlers (8 files)

| file | exported function | guard called | guarded before mutation/sensitive read? |
| --- | --- | --- | --- |
| `app/healthz/route.ts` | `GET` | none — intentionally public (`proxy.ts:7` `PUBLIC_PREFIXES`) | n/a — read-only status, no secrets (see observations) |
| `app/(admin)/audit/export/route.ts` | `GET` | `getAdminSession()` L10 | **yes** — first statement, before filters are parsed and before `iterateAudit` streams rows |
| `app/(admin)/users/[id]/avatar/route.ts` | `GET` | `getAdminSession()` L8 | **yes** — first statement, before `getUserImage(id, tag)` uses the server API key |
| `app/api/public/invite/[token]/route.ts` | `GET` | token is the credential; rate-limited L24; exposes only that invite | n/a — read-only |
| `app/api/public/invite/[token]/route.ts` | `POST` | `originAllowed` L45 + rate limit L47; creates account only through `redeemInvite(token, …)` | n/a — no caller identity; no user id accepted from the body |
| `app/api/public/me/login/route.ts` | `POST` | `originAllowed` L15 + per-IP and per-username limits L20-23; identity from Jellyfin credentials | n/a |
| `app/api/public/me/logout/route.ts` | `POST` | `originAllowed` L7 | n/a — clears only the caller's own cookie |
| `app/api/public/reset/route.ts` | `POST` | `originAllowed` L14 + limits L20-23; generic response | n/a |
| `app/api/public/reset/[token]/route.ts` | `GET` | token is the credential; rate-limited L20 | n/a — read-only status |
| `app/api/public/reset/[token]/route.ts` | `POST` | `originAllowed` L34 + rate limit L36; consumes the token, not a body user id | n/a |

The two `app/(admin)/**/route.ts` handlers — the highest-risk files, since the layout does not cover them — are
both guarded correctly.

## FINDINGS

### 1. Admin authorization is a 12-hour cookie that is never re-validated against Jellyfin — Medium

`lib/auth/session.ts:55-65`, `lib/auth/actor.ts:7-10`, `lib/auth/session.ts:8` (`ADMIN_TTL_SECONDS = 12 * 60 * 60`).

The admin cookie is a sealed iron-session blob holding `{kind, userId, userName, issuedAt}`. `getAdminSession()`
and `requireAdmin()` only unseal it; nothing re-checks Jellyfin. The only `Policy.IsAdministrator` test in the whole
codebase is at login time (`lib/services/auth.ts:52-58`), and there is no server-side session store or revocation
list (`setAdminSession`/`clearAdminSession` are the only writers).

Why it matters: demote an admin in Jellyfin (`IsAdministrator = false`) or delete the account, and the holder of an
already-issued cookie keeps **full** admin authority for up to 12 hours — account deletion (`deleteNowAction`,
`bulkAction`), password reset for any user (`setPasswordAction`), invite creation, settings changes, and the complete
audit export (`app/(admin)/audit/export/route.ts:10` accepts any unexpired cookie). Signing the user out in Jellyfin
does not end the jellycrew session either.

Fix: re-validate on each request (or at least on each mutation) — `fetchUser(session.userId)` and require
`Policy.IsAdministrator === true && Policy.IsDisabled !== true`, with a short in-process cache (30-60 s) to bound
Jellyfin load; fail closed on a Jellyfin error for mutations. Cheaper alternative: keep a per-user `authVersion`
in the DB and refuse when it changes.

### 2. Self-service cookie is never re-validated, and `/me` actions ignore the account's disabled state — Low

`lib/auth/session.ts:10` (`SELF_TTL_SECONDS = 30 days`), `lib/auth/session.ts:78-81`,
`app/(public)/me/actions.ts:12-16`, `lib/services/self.ts:108-112` and `:124-134`.

`requireSelf()` only unseals the 30-day self cookie. A user who is **disabled after** signing in keeps `/me` for the
rest of that window, and two of the mutating paths never look at the Jellyfin account state:

- `setEmailAction` → `setOwnEmail` (`lib/services/self.ts:124-134`) calls `fetchUser` (which still succeeds for a
  disabled account) and writes `userMeta.email`, then mails a verification link; `verifyEmailToken`
  (`lib/services/self.ts:155-162`) marks it verified. That address is exactly what the reset flow mails
  (`lib/services/reset.ts:61,74,118-130`), so the disabled user controls the address of record for their account.
- `revokeOwnDeviceAction` → `revokeOwnDevice` (`lib/services/self.ts:108-112`) checks device ownership but not
  account state, so a disabled user can still revoke devices.

`changePasswordAction` is *not* affected: `changeOwnPassword` re-verifies the current password with Jellyfin
(`lib/services/self.ts:91-105`) and Jellyfin answers 403 for disabled accounts (`lib/services/auth.ts:30-32`), so it
fails. Deleted accounts also fail these paths because `fetchUser` 404s. Impact is therefore limited to accounts
disabled mid-session, and the Jellyfin account stays disabled regardless.

Fix: in `requireSelf()`, fetch the Jellyfin user and reject + clear the cookie when `Policy.IsDisabled` is true (or
that the user no longer exists); or add the same check at the top of `setOwnEmail`/`revokeOwnDevice`.

### 3. Admin login has no rate limiting — Medium (authentication control, adjacent to authorization)

`app/login/actions.ts:19-34`.

`loginAction` calls `loginAdmin` directly: no `enforceLimits`, no attempt counter, no delay. The lower-privilege
public self-service login *is* limited per IP and per username (`app/api/public/me/login/route.ts:20-23`), and the
limiter is already available (`lib/ratelimit.ts:74-81`); nothing else in the repo limits admin login attempts
(`grep loginPerIp` → only the public route and the `/me` password change). Whether Jellyfin applies its own lockout
is outside this codebase and was not assumed.

Fix: wrap the `loginAdmin` call in `enforceLimits` with `login:ip:<ip>` and `login:user:<hash(username)>` keys,
reading the address from `headers()` the way `app/(public)/me/verify/[token]/page.tsx:21` does.

## Verified sound

- All 30 admin-area actions (`grep -c "^export (async )?function"` over the 10 files under `app/(admin)/`) call
  `adminActor()`/`getAdminSession()` as their first statement; no mutation, and no
  sensitive read (audit log, other users' data) happens before it.
- Both `app/(admin)/**/route.ts` handlers check `getAdminSession()` before doing any work — the layout gap the task
  flagged is real but is correctly compensated inside each handler.
- Admin-area **pages** perform no mutations during render: no `recordAudit`, `setSetting`, `getDb().update/insert/delete`,
  `deleteDevice`, or `setUserPasswordRaw` appears in any `app/**/*.tsx` (grep over `app`, non-action files). So the
  layout gate is adequate for them.
- Self-service actions cannot touch another user: every one derives the subject from the sealed cookie
  (`session.userId`); none reads a `userId` from `FormData`. `revokeOwnDeviceAction` passes only `deviceId` and
  `revokeOwnDevice` re-verifies `d.lastUserId === userId` (`lib/services/self.ts:109`); `changeOwnPassword` verifies
  the current password and asserts `identity.userId === userId` (`lib/services/self.ts:97-102`); `sessionsForUser`
  filters by `userId` (`lib/services/sessions.ts:36-38`); `getSelfOverview` filters devices by `lastUserId`
  (`lib/services/self.ts:86`).
- `app/api/public/**` handlers take no user identifier from the request body. Login derives identity from Jellyfin
  credentials; reset/invite/verify act through single-use tokens bound to a user row. Every public POST applies
  `originAllowed` before parsing the body and is rate-limited per IP and per token/username.
- A public invite signup cannot mint an administrator: `IsAdministrator` is `scope: "user"` in the policy catalog
  (`lib/policy/fields.ts:117`, `PROFILE_MANAGED_FIELDS` at `:129` is `scope === "profile"` only), and `redeemInvite`
  applies the invite's profile through `applyProfilePolicy`, which ignores non-managed keys
  (`lib/policy/merge.ts:19-25`).
- Admin actions cannot be CSRF'd: Next.js rejects cross-origin server-action POSTs
  (`node_modules/next/dist/server/app-render/action-handler.js:438-460`).
- `loginAction`'s `next` redirect target is sanitized (`app/login/actions.ts:34`), and admin return paths go through
  `safeReturnTo` (`lib/notice.ts:23-26`) — no open redirect found.
- The audit-export handler's only authorization is the cookie check, which is the issue in Finding 1 rather than a
  separate missing guard.

## Observations (not authorization defects)

- `app/(public)/me/verify/[token]/page.tsx:28` consumes the single-use email-verification token during a GET render
  (`consumeToken` + DB write + audit in `lib/services/self.ts:155-162`), so a mail scanner or prefetcher burns the
  link before the user clicks it. The token is itself the credential and the route is rate-limited, so this is a
  robustness issue, not an authz bypass.
- `app/healthz/route.ts` is public by design and reports app/Jellyfin version, uptime and DB reachability
  (`lib/services/system.ts:47-62`). Error strings are the `Error.message` of a failed fetch or `JellyfinError`, whose
  message contains operation + HTTP status + response body but no URL or API key (`lib/jellyfin/client.ts:33-48`).
  No secret disclosure found; listed only because it is an unauthenticated endpoint.
