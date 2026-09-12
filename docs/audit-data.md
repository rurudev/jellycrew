# Data-Layer & Concurrency Audit — jellycrew

> **Status, 2026-09-12.** Every finding below was verified against the code and fixed, except
> where noted in the repository's `DECISIONS.md`: the N+1 Jellyfin round trips (finding 4) and
> audit-table retention (finding 7, tokens are pruned, audit rows are kept on purpose) are open.
> This document is kept as the record of what was found and why the code looks the way it does.

Scope: Drizzle ORM on better-sqlite3 (single SQLite file), the 15-minute in-process scheduler
(`lib/services/scheduler.ts`), and the Jellyfin HTTP boundary. Focus: correctness bugs with user
impact, concurrency, schema/index reality, external-call robustness.

Method: read of `lib/db/*`, `lib/services/*`, `lib/lifecycle/*`, `lib/jellyfin/*`, `lib/users/*`,
`lib/policy/protection.ts`, the callers in `app/`, plus empirical checks against the shipped
migrations (index inventory and `EXPLAIN QUERY PLAN` for every query the app actually issues) and a
two-connection test of the scheduler lock SQL. Claims that are inference rather than verified are
marked **(unverified)**.

## Summary

The data layer is mostly careful: date/grace math is right, the indexes that exist are real and
mostly used, and the two riskiest atomic operations (token single-use, invite use-count) are
correctly guarded by conditional UPDATEs. The serious problems are all around **the scheduler lock**
and **read-modify-write against Jellyfin**:

1. The lifecycle lock is a 10-minute lease with **no owner check on release** and no renewal. A pass
   that takes longer than 10 minutes is not merely overlapped — it can also clear the lock of the
   run that replaced it (verified with a two-connection test). `DECISIONS.md:60` claims this
   prevents concurrent passes across instances; it does not.
2. The pass decides from a snapshot, and `deleteUserNow` never re-checks `deleteAfter`, so an admin
   cancelling a scheduled deletion can still lose the account to an in-flight pass. Irreversible.
3. Bulk and lifecycle paths issue **2–5 sequential Jellyfin round trips per user**, which is both a
   hang risk in the server action and the mechanism that pushes a pass past the 10-minute lease.
4. Admin policy writes that are *not* the editor (`setUserEnabled`, `applyProfileToUser`,
   `renameUser`, `copyPolicyFromUser`) replace the whole Jellyfin policy with no stale-write
   protection, while the editor path is protected. A concurrent lifecycle disable and admin edit can
   silently revert each other, with both audited as successful.
5. `audit`, `token` and `invite_use` have **no retention or pruning anywhere** in the codebase, and
   the audit page/export are written in a way that scans or materializes all of it.

## Findings

### 1. Scheduler lock: 10-minute lease is shorter than a slow pass, and release clobbers the new owner
`lib/services/scheduler.ts:10,17-29,37-44` — severity **high**

`LOCK_MS = 10 min` while `LIFECYCLE_INTERVAL_MS = 15 min`. Two independent defects:

- **(a) Lease expires while the pass runs.** `collectLifecycleInputs` + the loop do 1 `GET /Users`
  per protected user plus per-user calls (see finding 4): 100 due users ≈ 300 sequential HTTP
  round trips. At the 20 s per-request timeout (`lib/jellyfin/client.ts:56`) a pass can run far
  longer than 10 minutes even on a healthy server. When `lock_until` falls behind `now`, the next
  tick's acquire (`scheduler.ts:21-25`, `or(isNull(lockUntil), lt(lockUntil, now))`) succeeds and a
  second pass starts over the same snapshot. Both disable and delete the same users, and both write
  `lifecycle.run` audit rows. With `deleteAfter` due, two passes can race two `DELETE /Users/{id}`
  calls.
- **(b) Release is not owner-scoped.** `scheduler.ts:37-44` releases with
  `where(eq(jobRun.name, name))` only. The stale run's finish clears the lock held by run B, so run C
  starts immediately — a third concurrent pass.

Verified with two connections to one file and the exact acquire/release SQL: A acquires → 1 change;
B while held → 0 changes; B after lease expiry → 1 change; A's unconditional release then clears
B's lock and C acquires → 1 change. So mutual exclusion holds **only at acquire time**; the
invariant in `DECISIONS.md:60` ("several instances … never run the pass concurrently") is not
enforced beyond 10 minutes.

Fix: take a `run_id` (uuid) with the lock and release with
`and(eq(name), eq(runId, mine))`; renew `lock_until` periodically during the pass (or set the lease
from `LOCK_MS = 2 × interval` and assert `LOCK_MS > LIFECYCLE_INTERVAL_MS` at module load); add a
deadline that aborts a pass that overruns.

### 2. Kill mid-run: the lock self-heals, but only because 10 min < 15 min, and the UI lies meanwhile
`lib/services/scheduler.ts:20-29` + `components/settings/automation-section.tsx:11-19` — severity **medium**

If the process dies after acquiring the lock, the row keeps `lock_until = start + 10 min`; the
release path never runs (and `closeDb()`/`stopScheduler()` are never called — there is no SIGTERM
handler anywhere, so nothing can run on shutdown). The next tick is at +15 min > +10 min, so the
job resumes by itself: **self-healing works today**. Consequences and fragility:

- The self-heal depends entirely on `LOCK_MS < LIFECYCLE_INTERVAL_MS`. Raising `LOCK_MS` (or
  shortening the interval) silently wedges the job forever with no error anywhere.
- For up to 10 minutes after a crash the settings page reports **"Running now."** and disables the
  "Run it now" button (`automation-section.tsx:12` computes `running` from `lockUntil > now`), and
  `runLifecycleNowAction` returns "A lifecycle run is already in progress."
  (`app/(admin)/settings/actions.ts:53`). Nothing is running. The last completed run's
  `last_finished_at`/`last_result` also stay stale (the killed run wrote neither), so the operator
  cannot tell "crashed mid-run" from "in progress".
- A pass killed mid-loop leaves partial effects: some users disabled/deleted in Jellyfin with no
  per-user audit row and no `lifecycle.run` summary row (the summary is only written at the end,
  `scheduler.ts:57-59`). The next pass re-derives state from live Jellyfin data, so it converges —
  the gap is the audit trail, not the state.

Fix: make the lease independent of the interval (heartbeat row updated during the pass, staleness
computed from it), and show "last started X ago, lock expires Y" instead of "Running now."

### 3. An in-flight lifecycle pass can delete an account whose deletion an admin just cancelled
`lib/services/lifecycle.ts:176-195,114-140` — severity **high** (irreversible data loss)

`runLifecycle` decides every user from the snapshot taken by `collectLifecycleInputs()` at the start
of the pass (`lifecycle.ts:177`), then loops with `await`s. `deleteUserNow` (`lifecycle.ts:115-140`)
re-fetches the user from Jellyfin but never re-reads `user_meta.deleteAfter`, and there is no
conditional claim. Concrete scenario: the snapshot sees `deleteAfter` in the past; while the loop is
still working through earlier users (seconds to minutes, see finding 4), an admin clicks "Cancel
deletion" (`cancelDeletion` sets `deleteAfter = null`, re-enables, audits `user.delete.cancel`);
the pass then reaches that user, still holds the stale decision, and calls
`DELETE /Users/{id}`. The account is gone, the DB no longer schedules a deletion, and the audit log
contains a "cancel" followed by a system "delete". The same window lets a pass delete a user whose
expiry an admin just extended.

Fix: claim the deletion in SQL before touching Jellyfin, e.g.
`update user_meta set deleteAfter = null where jellyfin_user_id = ? and delete_after is not null and
delete_after <= ?` and only call `deleteUserNow` when `changes === 1`; re-read the meta row
immediately before the Jellyfin call and abort if the decision no longer holds.

### 4. Bulk actions and the lifecycle pass are N+1 against Jellyfin, sequentially
`lib/services/bulk.ts:163-227`, `lib/services/lifecycle.ts:179-194`, `lib/services/protection.ts:10-13` — severity **high**

`assertProtected` calls `fetchUsers()` (a full `GET /Users`) *per call*, and `setUserEnabled` calls
`fetchUser` first. Per-user cost of the bulk kinds that touch Jellyfin, in series:

| bulk kind | Jellyfin round trips per user |
| --- | --- |
| `schedule_deletion` (`bulk.ts:203` → `lifecycle.ts:92-97`) | `assertProtected`→GET /Users, GET /Users/{id}, `setUserEnabled`→GET /Users/{id} + `assertProtected`→GET /Users + POST Policy = **5** |
| `disable` / `enable` (`bulk.ts:187,183` → `user-actions.ts:21,29,33`) | `fetchUser` + `assertProtected` + POST = **3** (enable: 2) |
| `apply_profile` (`bulk.ts:178` → `profiles.ts:206,210`) | GET /Users/{id} + POST Policy = **2** |
| `send_reset_link` (`bulk.ts:219` → `reset.ts:120-125`) | GET /Users/{id} + SMTP send = **2** |

Plus `executeBulk` re-runs `previewBulk` (`bulk.ts:164`), so `GET /Users` is fetched twice per bulk
execute on top of that. 20 selected users on `schedule_deletion` = ~100 sequential HTTP requests in
one server action; one unresponsive user stalls the whole action for the 20 s timeout, and the
operator sees the dialog hang with work half-applied (results are only returned at the end).

The scheduler payload loop is the same shape: `setUserEnabled` → `fetchUser` + `assertProtected`
(`GET /Users`) + POST, and `deleteUserNow` → `assertProtected` + `fetchUser` + DELETE, i.e. **3 per
due user** on top of the initial list fetch. This is the direct cause of finding 1(a).

Fix: fetch `GET /Users` once per operation and pass the DTO/subject list down (the DTO already
carries `Policy`, so the disable path can compute the new policy from the snapshot and keep the
read-modify-write only where it matters); run with a small concurrency limit; write per-user results
incrementally rather than only at the end.

### 5. `audit` "to" date filter never gets the end-of-day adjustment, so it excludes that whole day
`app/(admin)/audit/page.tsx:40` — severity **medium**

```ts
f.to = new Date(`${to}T23:59:59.999Z`.length === 29 && to.length === 10 ? `${to}T23:59:59.999Z` : to);
```

`` `${to}T23:59:59.999Z`.length `` is `to.length + 13`, so it can never equal 29 while
`to.length === 10`. The condition is always false, so `new Date(to)` is used verbatim. The page's
`to` control is `<input type="date">` (`audit/page.tsx:108`), which submits `YYYY-MM-DD` → parsed as
`00:00:00.000Z` of that day. Concrete failing scenario: filter "from 2026-03-01 to 2026-03-10" to see
everything through the 10th; every row after `2026-03-10T00:00:00Z` is dropped, so the newest day
looks empty. The same `parseAuditFilters` drives the CSV/JSON export
(`app/(admin)/audit/export/route.ts:14`), so the exported file silently omits the day too. (The
`from` side is correct: start-of-day is the intended inclusive bound.)

Fix: `f.to = to.length === 10 ? new Date(`${to}T23:59:59.999Z`) : new Date(to)` — drop the dead
length check.

### 6. The audit "action" prefix filter full-scans the unbounded audit table
`lib/services/audit.ts:67`, `app/(admin)/audit/page.tsx:85-97` — severity **medium**

The filter dropdown offers `user.*`, `invite.*`, `profile.*` etc., which produce
`like(audit.action, 'user.%')`. SQLite's LIKE optimization requires `case_sensitive_like = ON` or a
`COLLATE NOCASE` index; `openDb` sets neither (`lib/db/index.ts:18-21`), so `audit_action_idx`
(BINARY) is unusable. Verified with `EXPLAIN QUERY PLAN` against the migrated schema:
`... where action like ? order by id desc limit 101` → **`SCAN audit`**, while the exact-action
variant → `SEARCH audit USING INDEX audit_action_idx (action=?)`, and the same LIKE with
`case_sensitive_like = ON` → `SEARCH ... USING INDEX audit_action_idx`. So every admin page view and
every export with a prefix filter reads the entire audit table — a table with no retention
(finding 7).

Fix: use a range predicate (`action >= p and action < p || char(0x10FFFF)`) which uses the index, or
set `PRAGMA case_sensitive_like = ON` in `openDb` (audit actions are all lowercase ASCII).

### 7. Nothing ever prunes `audit`, `token`, `invite_use`; `user_meta` rows are never reconciled
`lib/db/schema.ts:82-119`, whole repo — severity **medium** (unbounded growth)

The only `DELETE`s in `lib/` are `setting` by key, `profile` by id, and `token`/`user_meta` for a
user being deleted (`lib/services/lifecycle.ts:129-130`). There is no retention job, no vacuum, no
WAL checkpoint, and no "delete expired tokens" step anywhere (checked by grep for
delete/prune/retention/vacuum/checkpoint across `lib`, `app`, `scripts`). Consequences:

- `token`: one row per reset request and per verification mail, `used_at`/`expires_at` set but never
  removed. `requestPasswordReset` is **unauthenticated** (`app/api/public/reset/route.ts`) and
  appends an audit row even when nothing matched (`lib/services/reset.ts:68`), so anyone can grow
  both tables at the rate limit (20/min/IP, `lib/ratelimit.ts:54-58`).
- `audit`: grows with every action forever; `distinctAuditActions()` scans the whole action index on
  **every** audit page render (`app/(admin)/audit/page.tsx:52`; plan:
  `SCAN audit USING COVERING INDEX audit_action_idx`, so O(total rows) each time), and the date-range
  filter adds a
  `USE TEMP B-TREE FOR ORDER BY` over all matching rows (verified plan) because the only relevant
  index is `(ts)` while the query orders by `id desc`.
- `invite_use`: grows forever; `listInvites` loads **all** rows and does an O(invites × uses)
  JS filter (`lib/services/invites.ts:102,112`).
- `user_meta`: rows are only created for users present in Jellyfin and only removed by this app's own
  delete. A user removed directly in Jellyfin (or by another tool) leaves a row forever; nothing
  reconciles. Note `user_meta` is keyed by the Jellyfin id and is what holds `expiresAt`,
  `deleteAfter` and `disabledReason`, so orphans are invisible but permanent.

Fix: a step in the lifecycle job that deletes tokens older than their TTL and audit rows older than
a configurable retention window (or documents explicitly that audit is append-only forever and the
UI must paginate/aggregate server-side).

### 8. Audit export blocks the event loop and buffers the entire result in memory
`app/(admin)/audit/export/route.ts:17-37` — severity **medium**

The whole export is produced inside the `ReadableStream` `start()` callback, synchronously:
`iterateAudit` is a sync generator over sync better-sqlite3 queries, and every row is
`controller.enqueue`d without ever awaiting, so the stream's backpressure is ignored and the whole
file accumulates in the controller queue. Concrete failure: on a large `audit` table, "Export CSV"
(a) blocks the single Node thread for the entire export — every other page request, server action
and the scheduler tick waits, i.e. the app appears hung — and (b) can allocate hundreds of MB and
OOM the container. Because the table has no retention (finding 7), the trigger only becomes more
reachable over time.

Fix: move generation into `pull()` (or an async generator with `await` between pages) so
backpressure applies, and/or drive it from `iterateAudit`'s `beforeId` pages with an `await` yield
between pages.

### 9. Policy read-modify-write without stale-write protection (editor is protected, the rest are not)
`lib/services/user-actions.ts:20-45,47-63`, `lib/services/profiles.ts:204-223`, `lib/services/policies.ts:69-87` — severity **medium**

`saveUserPolicy`/`saveProfilePolicy` correctly refetch, compare `baseHash` and refuse a stale write
(`lib/services/policies.ts:36-44`). These paths do not: they read the live policy and POST the whole
object back. Concrete scenario: the lifecycle pass is disabling Bob for expiry
(`setUserEnabled` → `fetchUser` → `POST /Users/{id}/Policy` with `IsDisabled: true`) at the same
moment an admin toggles Bob in the UI (`app/(admin)/users/[id]/actions.ts:24`) or applies a profile
(`actions.ts:51`). Both read the same base policy; whichever POST lands second replaces the other's
field with its stale value. Both record a successful audit row (`user.disable` and `user.enable`),
so the audit log shows two contradictory successes and the final state is decided by I/O timing.
`renameUser` (`user-actions.ts:57`) and `copyPolicyFromUser` (`policies.ts:76`) have the same shape.

Fix: reuse the hash/stale-write check for these mutations (fetch → hash → merge only the fields the
operation owns → POST with a compare-and-set on the hash), or serialise per-user policy writes
through a single guarded helper.

### 10. Bulk dialog reports skipped users as "ok"
`lib/services/bulk.ts:167-169,234` + `components/users/bulk-bar.tsx:170` — severity **low**

Skipped rows are returned with `ok: true` and message `Skipped: …`. The dialog header counts
`results.filter(r => r.ok).length` as "ok", so selecting 20 users for "Add label X" when all 20
already have it reports **"20 ok, 0 failed"** although nothing was applied. (The per-row message does
say "Skipped", and the audit summary computes `succeeded` correctly by string-matching
"`Skipped`" — `bulk.ts:234` — so only the headline count is wrong.)

Fix: add a distinct `status: "applied" | "skipped" | "failed"` to `BulkResultRow` and count on it
instead of the `"Skipped: "` string prefix.

### 11. A shared verified email makes password reset silently do nothing
`lib/services/reset.ts:46-56` — severity **low**

`byEmail` must have length exactly 1 for the email branch to run, and email uniqueness is never
enforced (`setOwnEmail`/`updateUserMeta` accept any address). If two accounts have the same verified
address, neither branch runs, `userId` stays undefined and the caller returns "not sent" while the
user is told the generic "if an account matches, a link has been sent". Fix: pick deterministically
(e.g. reject/flag duplicates, or use the single user whose name also matches).

### 12. `setOwnEmail` commits the address and a success audit before the verification mail
`lib/services/self.ts:130-133` — severity **low**

The `user_meta.email` update and `self.email.set` audit happen before `sendVerification`. If SMTP
fails, the caller gets an error but the address on file has already changed to an unverified one
(and the operators' audit log claims the change happened). Combined with `updateUserMeta`'s
"changing email clears verification" rule this also drops a previously verified address. Fix: send
first, persist after, or persist with an explicit "pending" flag and audit the outcome.

### 13. `verifyEmailToken` consumes the token before checking that the address still matches
`lib/services/self.ts:155-161` — severity **low**

`consumeToken` marks the row used, then the mismatch check runs. If the address changed after the
mail was sent, the user gets "mismatch" and the token is burned (a retry reports "already used").
Safe (no bypass), but a dead end for the user. Fix: check `row.email === meta.email` before
consuming.

### 14. `invite_use_invite_idx` is never used by any query
`lib/db/schema.ts:79` — severity **low** (informational; the only index with no matching query)

`listInvites` loads all `invite_use` rows and filters in JavaScript, and redeem only inserts. The
index is write-cost only. Either use it (`where invite_id in (…)` / a join) or drop it; `listInvites`
loading the whole table is the actual scaling issue (finding 7).

### 15. `synchronous = NORMAL` in WAL mode
`lib/db/index.ts:18-19` — severity **low** (looks deliberate)

Committed transactions survive a process crash but can be lost on power loss / host crash. Flagging
only because "data loss" is in scope; if the audit log is meant to be the durable record of who did
what, `synchronous = FULL` is the alternative.

## Verified sound

- **Lock acquisition is genuinely atomic.** Two connections to the same file running the exact
  acquire SQL: first gets `changes = 1`, second gets `0`. The `insert … onConflictDoNothing` +
  conditional `UPDATE` does prevent a double start; the defects in finding 1 are lease length and
  release scoping, not the acquire statement.
- **Schema and migrations agree.** After applying `drizzle/0000_init.sql` + `0001_…` to a scratch
  database, `sqlite_master` contains exactly the indexes declared in `lib/db/schema.ts`
  (`audit_ts_idx`, `audit_target_idx`, `audit_action_idx`, `audit_actor_idx`,
  `invite_token_hash_idx`, `invite_use_invite_idx`, `profile_name_unique`, `token_hash_idx`,
  `token_user_idx`, `user_meta_profile_idx`, `user_meta_email_idx`). No drift, no missing index.
- **Every index except the two noted is used by a real query** (`EXPLAIN QUERY PLAN`, bound
  parameters as Drizzle emits them): `token_hash_idx` for `peekToken`, `token_user_idx` for
  `issueToken`'s invalidate-older UPDATE, `invite_token_hash_idx` for `findInviteByToken`,
  `user_meta_profile_idx` for `deleteProfile`, `user_meta_email_idx` for `requestPasswordReset`,
  `audit_target_idx` for `listAuditForUser` and its `id < beforeId` pagination (rowid rides the same
  index), `audit_actor_idx` for actorType alone and actorType+actorId, `audit_action_idx` for the
  exact-action filter, `audit_ts_idx` for the from/to range. The exceptions are the LIKE prefix
  (finding 6) and `invite_use_invite_idx` (finding 14). The `.unique()` on `profile.name` is backed
  by `profile_name_unique`, and `getProfile`/`requireProfile` use the primary key.
- **Date and grace math is correct.** `daysBetween(now, basis)` returns positive days for a past
  basis (`lib/format.ts:57-59`), so `idle >= inactivityDisableDays` (`lib/lifecycle/decide.ts:37-42`)
  fires exactly at the configured threshold, not a day early or late; `expiresAt <= now` and
  `deleteAfter <= now` (`decide.ts:29,34`) are inclusive as documented; `computeUserStatus` uses
  `days <= 0` → "Expired" and `days <= 7` → "Expiring soon" (`lib/users/status.ts:37-41`) with no
  boundary error. Admins are excluded first, and a scheduled deletion beats disabling as documented.
- **Token single-use is race-free.** `consumeToken` peeks and then claims with
  `update … where id = ? and used_at is null` returning the row; a concurrent second caller gets no
  row and is told "used" (`lib/services/tokens.ts:54-64`). Expiry is checked against the row's own
  timestamp.
- **Invite use-count is race-free.** The increment is `uses = uses + 1` guarded by
  `revoked_at is null` and `uses < max_uses` in the WHERE clause, and `changes === 0` aborts
  (`lib/services/invites.ts:226-231`). The rollback deletes the just-created Jellyfin user and
  records `invite.rollback_failed` if that fails too (`invites.ts:250-261`).
- **In-process read-modify-write on `user_meta` cannot interleave.** `extendExpiry`, `addLabel`,
  `removeLabel` and `updateUserMeta` read and write in one synchronous block (better-sqlite3, no
  `await` in between), so no lost update within the single-process deployment; `updateUserMeta` also
  writes only the patched columns, so unrelated fields cannot be clobbered. The same reasoning makes
  `ensureMetaRows`' `onConflictDoNothing` + missing-row check safe in one process. **(Unverified)**:
  with the "several instances" arrangement `DECISIONS.md:60` is written for, the `ensureMetaRows`
  window is real — the loser's `returning()` omits the row and `metas.get(u.Id)!`
  (`lib/services/users.ts:114`) would then dereference `undefined`. I did not confirm whether the
  standalone build can run more than one writer process; if it can, that is a 500 on `/users`.
- **Protection rules behave.** `checkProtection` skips the self-check for the system actor
  (`actorId === null`), refuses the last enabled admin, and `deleteUserNow` adds "automation never
  deletes administrators" (`lib/services/lifecycle.ts:121`).
- **Failure handling around lifecycle actions does not fall through.** `backToUser` is typed `never`
  and always ends in `redirect()` (`app/(admin)/users/[id]/shared.ts:5-7`), so the
  `catch { backToUser(…) }` blocks in `lifecycle-actions.ts` cannot continue with an unassigned `m`
  or `parsed.data`.
- **"Run now" reports the lock correctly.** `runLifecycleNowAction` distinguishes `null` (lock held)
  from a result and shows "A lifecycle run is already in progress." plus an audit row
  (`app/(admin)/settings/actions.ts:43-54`) — it does not claim success when it skipped.
- **Jellyfin HTTP boundary is sane.** One 20 s `AbortSignal.timeout` per request
  (`lib/jellyfin/client.ts:56-62`); `call()` maps thrown network/timeout errors to
  `JellyfinUnreachableError` and `unwrap()` maps any non-2xx (or a defined `error` body) to
  `JellyfinError` with the status preserved, so the 404/400 handling in `getUserDetail`,
  `deleteUserNow` and `reset` is consistent. No retry loops, so no unbounded retry storm.
  `fetchUserImage` uses a 10 s timeout and returns `null` on 404.
- **Page renders are not N+1.** `listUsers` = `GET /Users` + `GET /Sessions` + `GET /Devices` for the
  whole table, with the session list memoized for 10 s (`lib/services/sessions.ts:7,23-34`); user
  detail is 3 calls; the avatar route is browser-side fan-out (one Jellyfin call per `<img>`), not a
  server loop. The N+1s are the bulk and lifecycle paths in finding 4.
- **Public endpoints are rate-limited** (`lib/ratelimit.ts:54-58` applied in
  `app/api/public/{reset,invite,me/login}` and the verify page), and the limiter prunes its own map.
- **Input validation covers the paths I suspected.** Bulk `days`/`profileId`/`date` are validated in
  `app/(admin)/users/bulk-actions.ts:23-53`; `inactivityDisableDays` is `.min(1)`; invite
  `optionalInt` defaults `min: 0` so a negative link expiry cannot silently mean "never expires";
  the bulk `apply_profile` non-null assertion `params.profileId!` (`lib/services/bulk.ts:157`) is
  unreachable from the UI because the action rejects a missing profile first.

## Not investigated

- Mail/SMTP behaviour and templates (out of scope).
- Jellyfin 10.11 API semantics beyond what `lib/jellyfin/schemas.ts` asserts (e.g. whether
  `LastActivityDate` is updated for every login on every client) — the inactivity rule's correctness
  depends on that, and I took the schema comment at face value.
- Whether the production image runs a single Node writer process (affects the cross-process
  `ensureMetaRows` note above).
