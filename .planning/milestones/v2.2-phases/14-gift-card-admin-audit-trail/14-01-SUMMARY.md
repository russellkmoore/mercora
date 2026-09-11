---
phase: 14-gift-card-admin-audit-trail
plan: 01
subsystem: database
tags: [sqlite, d1, drizzle, migrations, gift-cards]

requires: []
provides:
  - "gift_card_events table (D-01): id, gift_card_id, event_type, actor_type, actor_id, details, created_at"
  - "gift_card_accounts.code_suffix column (D-02)"
  - "gift_card_events_reissued_once_idx partial UNIQUE index — database-level once-only reissue guarantee (D-06)"
  - "giftCardEvents Drizzle table + GiftCardEventRow type in lib/db/schema/gift-cards.ts"
affects: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09]

actuals:
  tokens: 2316
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Append-only audit table mirrors order_events (0014) but with integer epoch timestamps and ON DELETE RESTRICT, matching the rest of the gift-card schema (0022) rather than order_events' text timestamps and CASCADE"
    - "Database-enforced once-only action via a partial UNIQUE index (WHERE event_type = 'reissued') instead of application-level locking"

key-files:
  created:
    - migrations/0024_add_gift_card_events.sql
  modified:
    - lib/db/schema/gift-cards.ts
    - tests/integration/gift-cards-migration.test.ts
    - tests/integration/d1-harness.test.ts

key-decisions:
  - "Snapshot comparison in the ordering test names every pre-0024 column explicitly rather than SELECT * — ALTER TABLE ADD COLUMN makes SELECT * gain a new (NULL) field after migration even though no existing value changes, which would otherwise fail a byte-identical assertion for the wrong reason."
  - "Added migrations/0024_add_gift_card_events.sql to tests/integration/d1-harness.test.ts's hardcoded migration-sequence expectation — a direct, in-scope consequence of adding the new migration file, not a neighbouring-suite edit."

requirements-completed: [GCA-09, GCA-01]

coverage:
  - id: D1
    description: "Migration 0024 creates gift_card_events (D-01) and gift_card_accounts.code_suffix (D-02), proven expand-only and non-destructive of a populated pre-0024 baseline"
    requirement: GCA-09
    verification:
      - kind: integration
        ref: "tests/integration/gift-cards-migration.test.ts#adds gift_card_events and code_suffix without disturbing a populated 0023 baseline"
        status: pass
      - kind: other
        ref: "npm run check:migrations -- --base origin/main"
        status: pass
    human_judgment: false
  - id: D2
    description: "gift_card_events_reissued_once_idx partial UNIQUE index makes a second reissued event for the same card impossible at the database layer (D-06)"
    requirement: GCA-01
    verification:
      - kind: integration
        ref: "tests/integration/gift-cards-migration.test.ts#adds gift_card_events and code_suffix without disturbing a populated 0023 baseline"
        status: pass
    human_judgment: false
  - id: D3
    description: "giftCardEvents Drizzle table and GiftCardEventRow type exported for later plans to insert through"
    verification:
      - kind: other
        ref: "npm run typecheck (isolated to plan 14-01's own files — see Deviations)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 01: Gift-Card Events Migration Summary

**Migration 0024 adds an append-only `gift_card_events` audit table and a `code_suffix` search column to `gift_card_accounts`, with a partial UNIQUE index making a second `reissued` event for one card impossible at the database layer.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-10T19:27:00Z
- **Completed:** 2026-09-10T19:32:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `migrations/0024_add_gift_card_events.sql`: `gift_card_events` table (integer epoch `created_at`, `ON DELETE RESTRICT`, `actor_type` CHECK, `details` object-only CHECK), two lookup indexes, the `gift_card_events_reissued_once_idx` partial UNIQUE index, and `gift_card_accounts.code_suffix` plus its partial index.
- `lib/db/schema/gift-cards.ts`: `giftCardEvents` Drizzle table (array-style config matching this file's existing tables, not `order-events.ts`'s object style) with matching indexes and CHECK, `GiftCardEventRow` type export, and `codeSuffix` column + index on `giftCardAccounts`.
- `tests/integration/gift-cards-migration.test.ts`: new ordering case proving a populated pre-0024 baseline is byte-identical after applying 0024, `code_suffix` is NULL on pre-existing rows, a second `reissued` event is rejected while two `note` events both succeed, an invalid `actor_type` is rejected, non-object `details` is rejected, and deleting an account with events is rejected.
- Migration classified `expand-only` by `npm run check:migrations`; full D1 integration suite (29 files, 199 tests) green.

## Task Commits

1. **Task 1: Migration 0024, the `giftCardEvents` Drizzle table, and the ordering test** - `98e84f7` (feat)
2. **Task 2: Prove the migration is expand-only and the schema typechecks** - `1fdf05c` (test) — this task's only required change was updating `tests/integration/d1-harness.test.ts`'s hardcoded migration-sequence expectation, a direct consequence of adding `0024`.

**Plan metadata:** (this commit)

## Files Created/Modified
- `migrations/0024_add_gift_card_events.sql` - the expand-only migration (D-01, D-02, D-06)
- `lib/db/schema/gift-cards.ts` - `giftCardEvents` table, `GiftCardEventRow`, `codeSuffix` column + index
- `tests/integration/gift-cards-migration.test.ts` - 0024 ordering test case
- `tests/integration/d1-harness.test.ts` - added `0024_add_gift_card_events.sql` to the hardcoded migration-sequence assertion

## Decisions Made
- Snapshot comparison in the ordering test names every pre-0024 column explicitly instead of `SELECT *`, because `ALTER TABLE ADD COLUMN` makes `SELECT *` pick up the new `code_suffix` field (as `NULL`) after the migration — a literal `SELECT *` byte-comparison would fail even though no pre-existing value changed. This was caught by running the test (it failed on the first attempt with exactly that diff) and fixed before committing.
- Updated `tests/integration/d1-harness.test.ts`'s hardcoded full-migration-sequence array to include `0024_add_gift_card_events.sql`. This is a direct, in-scope consequence of Task 1 adding a migration file (Task 2's own instructions anticipate this: fix the cause in this phase's own files rather than editing a neighbouring suite's expectations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Snapshot comparison used explicit columns instead of `SELECT *`**
- **Found during:** Task 1 (writing the ordering test)
- **Issue:** A literal `SELECT *`-based byte-identical snapshot fails after `ALTER TABLE ADD COLUMN` because the row gains a new `code_suffix: null` field, even though no pre-existing value changed.
- **Fix:** Named every pre-0024 column explicitly in the snapshot query so the comparison proves "byte-identical" for the columns that existed before 0024, which is what D-01/GCA-09 actually requires.
- **Files modified:** tests/integration/gift-cards-migration.test.ts
- **Verification:** Test passes; `code_suffix IS NULL` is asserted separately.
- **Committed in:** 98e84f7 (Task 1 commit)

**2. [Rule 3 - Blocking] `tests/integration/d1-harness.test.ts` hardcodes the full migration list**
- **Found during:** Task 2 (`mise exec -- npm run test:workers`)
- **Issue:** `d1-harness.test.ts`'s "applies the production migration sequence" test asserts the exact ordered list of migration filenames; adding `0024` without updating it fails that assertion — a direct, expected consequence of Task 1's migration file, not a pre-existing or unrelated failure.
- **Fix:** Appended `'0024_add_gift_card_events.sql'` to the expected array.
- **Files modified:** tests/integration/d1-harness.test.ts
- **Verification:** `mise exec -- npm run test:workers` — 29 files, 199 tests, all green.
- **Committed in:** 1fdf05c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were required for the plan's own acceptance criteria to hold. No scope creep — neither touched a file outside this plan's `files_modified` plus the one D1-harness file whose failure Task 2's own instructions anticipated.

## Issues Encountered

`npm run typecheck` reported 3 pre-existing/concurrent errors, none in this plan's files:
- `tests/unit/app/api/admin-settings-honor-guard.test.ts:130` — committed by the parallel plan 14-02 executor (`ffc979f fix(14-02): narrow honor-guard settings refusal and declare reveal setting`) in this same shared checkout (`workflow.use_worktrees: false`).
- `tests/unit/lib/gift-cards/admin-http.test.ts:98-99` and untracked `lib/gift-cards/admin-http.ts` — uncommitted work-in-progress from a sibling plan's executor, present in the shared working tree at the time this task ran.

None of these three errors reference `migrations/`, `lib/db/schema/gift-cards.ts`, or either `tests/integration/*` file this plan touches. Per the parallel-execution scope boundary, these are out of scope for plan 14-01 and were left untouched. `npm run check:migrations` and the full D1 integration suite (`mise exec -- npm run test:workers`) — the two other Task 2 verification commands — both pass cleanly with no caveats.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`gift_card_events` and `gift_card_accounts.code_suffix` exist in D1 with the full column/index/CHECK set from D-01/D-02/D-06, and `giftCardEvents`/`GiftCardEventRow` are exported from `lib/db/schema/gift-cards.ts` for plan 14-04 (`lib/gift-cards/events.ts`) and plan 14-07 (mutation routes) to build on. No blockers.

## Self-Check: PASSED

- `migrations/0024_add_gift_card_events.sql` exists: FOUND
- `lib/db/schema/gift-cards.ts` exports `giftCardEvents`, `GiftCardEventRow`, and `codeSuffix`: FOUND (verified via grep)
- Commit `98e84f7` exists in `git log`: FOUND
- Commit `1fdf05c` exists in `git log`: FOUND
- `mise exec -- npx vitest run --config vitest.workers.config.mts tests/integration/gift-cards-migration.test.ts`: 2/2 passed
- `npm run check:migrations -- --base origin/main`: `0024_add_gift_card_events.sql` classified expand-only
- `mise exec -- npm run test:workers`: 29/29 files, 199/199 tests passed

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*
