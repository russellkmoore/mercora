---
phase: 14-gift-card-admin-audit-trail
plan: 04
subsystem: api
tags: [d1, gift-cards, audit-log, admin, tdd, security-contract]

requires:
  - phase: 14-01
    provides: "gift_card_events table, gift_card_accounts.code_suffix column, gift_card_events_reissued_once_idx partial UNIQUE index"
  - phase: 14-03
    provides: "findReservations/classifyGiftCardReservation shared reservation classifier, disableAccount, writeAdjustment, reissue, issueAccount carrying codeSuffix"
provides:
  - "lib/gift-cards/events.ts: appendGiftCardEvent, listGiftCardEvents, GIFT_CARD_EVENT_TYPES, GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS, assertGiftCardEventDetails (D-03, D-11)"
  - "lib/gift-cards/timeline.ts: buildGiftCardTimeline merging ledger/reservation/delivery/event sources oldest-first (D-04)"
  - "lib/gift-cards/code.ts: giftCardCodeSuffix, maskGiftCardCodeSuffix (D-02)"
  - "extended AdminGiftCardPresentation (id, codeSuffix, maskedCode, recipientEmail, purchaser) and search-capable listAdminGiftCardPresentations (D-14, D-15, D-22)"
  - "tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts: the forbidden-column source contract (D-14, GCA-09)"
affects: [14-05, 14-06, 14-07, 14-08, 14-09]

actuals:
  tokens: 15652
  tasks: 3
  commits: 8
  plan_head_before: f32ea2c9f15660b3461a5f20d2bdead841cbfc06

tech-stack:
  added: []
  patterns:
    - "Timeline assembly at read time from four raw-SQL sources against one D1Database param, reusing the existing repository's findReservations/classifyGiftCardReservation rather than re-deriving reservation state (one shared classifier, per the 14-03 SUMMARY's own forward note)"
    - "Every constructed response details/label object goes through assertGiftCardEventDetails as a second, independent check beyond the SELECT column list itself — belt-and-suspenders against a future spread-the-row regression"
    - "Batched second-query label resolution (admin_users for actors, customers for purchasers) via one IN (...) lookup per page, matching the existing orders-events route pattern instead of a per-row correlated subquery"
    - "Grep-style source contract asserts both directions — the absence of forbidden columns AND the presence of the one field (account id) that must keep flowing — so a regression that silently drops a required field fails the same test as a regression that leaks one"

key-files:
  created:
    - lib/gift-cards/events.ts
    - lib/gift-cards/timeline.ts
    - tests/unit/lib/gift-cards/timeline.test.ts
    - tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts
  modified:
    - lib/gift-cards/code.ts
    - lib/gift-cards/presentations.ts
    - tests/unit/lib/gift-cards/code.test.ts
    - tests/integration/lib/gift-cards/gift-card-events.test.ts

key-decisions:
  - "appendGiftCardEvent/listGiftCardEvents use getDbAsync (Drizzle), matching lib/fulfillment/service.ts's recordEmailEvent idiom; buildGiftCardTimeline and the extended presentations.ts use raw D1Database.prepare(...) against the caller-supplied database param instead, matching repository.ts's style and keeping both unit-testable with a hand-rolled D1 fake with no Cloudflare-context mocking."
  - "buildGiftCardTimeline queries gift_card_events directly with its own raw SQL rather than calling listGiftCardEvents, so the whole timeline is testable against one D1 fake instead of needing a second getDbAsync mock layered on top."
  - "A reservation's hold entry is always contributed; committed-unsettled adds an awaiting-settlement entry; released adds a release entry; settled contributes nothing extra because the ledger's own redemption entry already represents settlement — avoiding a duplicate timeline entry for the same fact."
  - "giftCardCodeSuffix/maskGiftCardCodeSuffix live in code.ts (not domain.ts) to avoid a circular import: domain.ts already imports from code.ts for GiftCardCodeLookup."

requirements-completed: [GCA-01, GCA-02, GCA-03, GCA-09]

coverage:
  - id: D1
    description: "An admin action writes one gift_card_events row naming who did it and when, and that row can be read back; a second reissued event for the same card is rejected as a thrown error, not a silent no-op (D-03, D-11, GCA-03)"
    requirement: GCA-03
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#writes an event and reads back an integer epoch created_at, not an ISO string"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#rejects a second reissued event for the same card as a thrown error, not a silent no-op"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#refuses to write an event whose details contain a forbidden key, and writes nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "One timeline merges ledger entries, reservations, delivery status and admin events, oldest first, each entry naming its actor (D-04, GCA-02)"
    requirement: GCA-02
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/timeline.test.ts#merges all four sources, oldest first, regardless of source order"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/timeline.test.ts#resolves an admin actor's label from admin_users and yields null, not a throw, for an unresolvable id"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#merges the issuance, a hold, its release, and a note, oldest first"
        status: pass
    human_judgment: false
  - id: D3
    description: "The admin list projection carries account id, code suffix, recipient email and a purchaser label, and carries no code material (D-14, D-22, GCA-01)"
    requirement: GCA-01
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#carries id, codeSuffix, maskedCode, recipientEmail, and a resolved purchaser"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#renders a null maskedCode for a card with no stored code suffix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Searching by exact order id, exact recipient email or exact four-character suffix returns the matching cards, case-insensitively for the latter two (D-15, GCA-01)"
    requirement: GCA-01
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/gift-card-events.test.ts#matches an exact order id, an exact recipient email, and an exact suffix, case-insensitively for the latter two"
        status: pass
    human_judgment: false
  - id: D5
    description: "No event detail payload and no projection field ever contains a hash, ciphertext, nonce, key version, claim token, idempotency key or ledger business key — enforced by a source contract, not review discipline (D-03, D-14, GCA-09)"
    requirement: GCA-09
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts#never references the forbidden column"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts#still selects the account id — a regression that silently drops it fails too (D-14, RESEARCH Pitfall 6)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 04: Gift-Card Read/Audit Layer Summary

**Event writer, four-source timeline merge, and a searchable admin list projection — all three tied together by one forbidden-column source contract that greps the actual read paths for code material instead of relying on review.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-10T20:04:42Z
- **Completed:** 2026-09-10T20:22:38Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `lib/gift-cards/events.ts`: `appendGiftCardEvent` writes one attributed, append-only audit row (integer epoch `created_at`, admin/service/system actor); `listGiftCardEvents` reads it back bounded and newest-first; `assertGiftCardEventDetails` recursively rejects any forbidden key at any depth, in objects or arrays.
- `lib/gift-cards/timeline.ts`: `buildGiftCardTimeline` merges ledger entries (issuance/redemption/restoration-as-refund/adjustment), reservations (hold/awaiting-settlement/released), the delivery row (created/completed-with-terminal-status), and `gift_card_events`, oldest first, with admin actors labelled from `admin_users` and a graceful null-label degrade on lookup failure.
- `lib/gift-cards/code.ts`: `giftCardCodeSuffix`/`maskGiftCardCodeSuffix` extend the existing masking module for the last-four-character display/search material (D-02).
- `lib/gift-cards/presentations.ts`: `AdminGiftCardPresentation` now carries `id`, `codeSuffix`, `maskedCode`, `recipientEmail`, and a resolved `purchaser` label; `listAdminGiftCardPresentations` accepts an optional `q` matched in order against the exact order id, the exact recipient email, and the exact suffix — bound parameters only, folded into both the paged and `COUNT` queries.
- `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts`: a grep-style contract scanning `presentations.ts`, `timeline.ts`, `events.ts`, and (once it exists) every file under `app/api/admin/gift-cards/` for the six D-14 forbidden columns plus `business_key`, importing the one canonical list from `events.ts`, and asserting the *opposite* direction too — that `presentations.ts` still selects `account.id` as a projected column, not merely as a JOIN predicate.

## Task Commits

Executed as three `tdd="true"` tasks (Task 1 `type="tracer"`, Tasks 2–3 `type="auto"`), each RED → GREEN, no REFACTOR needed:

1. **Task 1 RED: failing test for gift-card event append/read** - `7b39128` (test)
2. **Task 1 GREEN: appendGiftCardEvent and listGiftCardEvents** - `dba0f83` (feat)
3. **Task 2 RED: failing tests for buildGiftCardTimeline** - `9dc6bf3` (test)
4. **Task 2 GREEN: buildGiftCardTimeline** - `014bd57` (feat)
5. **Task 3a RED: failing test for giftCardCodeSuffix/maskGiftCardCodeSuffix** - `683e475` (test)
6. **Task 3a GREEN: giftCardCodeSuffix and maskGiftCardCodeSuffix** - `3c3a063` (feat)
7. **Task 3b RED: failing tests for the extended presentation and the forbidden-column contract** - `7f0fefb` (test)
8. **Task 3b GREEN: extend AdminGiftCardPresentation with id, code suffix, and search** - `138bb21` (feat)

**Plan metadata:** (this commit)

**Tracer feedback gate (Task 1):** re-ran Task 1's full `<verify>` (7/7 integration tests) after GREEN, before starting Task 2's expansion, per the `end-of-phase` human-verify mode with an automated-only `<verify>` block. Passed — logged `⚡ Tracer verified end-to-end — expanding` and continued without a checkpoint.

## Files Created/Modified
- `lib/gift-cards/events.ts` - `appendGiftCardEvent`, `listGiftCardEvents`, `GIFT_CARD_EVENT_TYPES`, `GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS`, `assertGiftCardEventDetails`
- `lib/gift-cards/timeline.ts` - `buildGiftCardTimeline`, `GiftCardTimelineEntry`
- `lib/gift-cards/code.ts` - `giftCardCodeSuffix`, `maskGiftCardCodeSuffix`
- `lib/gift-cards/presentations.ts` - extended `AdminGiftCardPresentation`/`PresentationRow`/`mapRow`, `q` search, revised doc comment
- `tests/unit/lib/gift-cards/timeline.test.ts` - hand-written D1 fake covering every timeline behavior bullet
- `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` - the forbidden-column source contract
- `tests/unit/lib/gift-cards/code.test.ts` - suffix/mask-suffix cases
- `tests/integration/lib/gift-cards/gift-card-events.test.ts` - events, timeline, and presentation-search cases against real D1

## Decisions Made
- `appendGiftCardEvent`/`listGiftCardEvents` use `getDbAsync` (Drizzle), matching `recordEmailEvent`'s idiom; `buildGiftCardTimeline` and the extended `presentations.ts` use raw `D1Database.prepare(...)` against the caller-supplied `database` param instead, matching `repository.ts`'s style. This keeps both testable with a hand-rolled D1 fake and no `getCloudflareContext` mocking, and lets `buildGiftCardTimeline` reuse `createGiftCardRepository(database).findReservations` directly.
- A settled reservation contributes only its hold entry to the timeline — the ledger's own `redemption` entry already represents settlement, so duplicating it as a second reservation-source entry was rejected as redundant.
- `giftCardCodeSuffix`/`maskGiftCardCodeSuffix` live in `code.ts`, not `domain.ts`, to avoid a circular import (`domain.ts` already imports `GiftCardCodeLookup` from `code.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added integration coverage for `listAdminGiftCardPresentations` search**
- **Found during:** Task 3 (extending `presentations.ts`)
- **Issue:** The plan's task 3 verify command runs `code.test.ts`, `admin-gift-card-forbidden-columns.test.ts`, and the mocked `gift-card-presentation-routes.test.ts` — none of which exercises the actual SQL correctness of the new `q` search against real D1. The plan's own `must_haves.truths` explicitly requires "Searching by exact order id, exact recipient email or exact four-character suffix returns the matching cards" to hold.
- **Fix:** Added a `listAdminGiftCardPresentations search and projection` describe block to `tests/integration/lib/gift-cards/gift-card-events.test.ts` (the one integration file the plan's `files_modified` already lists) covering the id/codeSuffix/maskedCode/recipientEmail/purchaser projection, a null-maskedCode pre-0024 card, and all three ordered `q` match forms plus a no-match case.
- **Files modified:** tests/integration/lib/gift-cards/gift-card-events.test.ts
- **Verification:** All 4 new cases pass against real D1; RED confirmed against the pre-14-04 `presentations.ts` first (`RED_EVIDENCE_OK`).
- **Committed in:** `7f0fefb` (RED), `138bb21` (GREEN)

**2. [Rule 1 - Bug] Loosened-then-fixed regex in the forbidden-columns "still selects account id" assertion**
- **Found during:** Task 3 (writing `admin-gift-card-forbidden-columns.test.ts`)
- **Issue:** A first draft asserted `/account\.id\b/`, which matched the *pre-14-04* `presentations.ts` — every `WHERE ... = account.id` join/subquery predicate already contains that substring, so the assertion passed even though `id` was never actually a selected column. That would have made the "id still flows through" half of the contract (RESEARCH Pitfall 6) unable to ever fail.
- **Fix:** Tightened to `/account\.id,/`, requiring the trailing comma of a `SELECT`-list entry — true only once `PRESENTATION_SELECT` actually projects `account.id`.
- **Files modified:** tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts
- **Verification:** Re-ran against the pre-14-04 file (fails, as required) and the post-14-04 file (passes).
- **Committed in:** `7f0fefb`

**3. [Rule 1 - Bug] Two integration test cases rewritten to filter by their own fixture instead of asserting on an unfiltered/first-row read**
- **Found during:** Task 3 (running the new integration cases)
- **Issue:** `tests/integration/lib/gift-cards/gift-card-events.test.ts` applies migrations once in `beforeAll` and never resets the database between tests in the file (matching the file's own established pattern from earlier tasks). Two new cases asserted `total === 1` or read `cards[0]` from an unfiltered call, which actually counted/ordered over every card every earlier test in the file had created.
- **Fix:** Both cases now pass their own unique `q` (a code suffix or order id) so the projection assertions are scoped to the exact fixture they created, not to accumulated cross-test state.
- **Files modified:** tests/integration/lib/gift-cards/gift-card-events.test.ts
- **Verification:** Full file (11 tests) passes in isolation and as part of the full suite.
- **Committed in:** `138bb21`

---

**Total deviations:** 3 auto-fixed (1 missing-critical test coverage, 2 bugs caught and fixed before any GREEN commit).
**Impact on plan:** All three were caught and resolved during this plan's own execution, before any commit that could have shipped them. No scope creep — all three stayed within `tests/integration/lib/gift-cards/gift-card-events.test.ts` and `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts`, both already named in the plan's `files_modified`.

## Issues Encountered

`tests/unit/app/api/gift-card-presentation-routes.test.ts` (listed in the plan's `files_modified`) needed no edits — its existing cases mock `listAdminGiftCardPresentations` entirely, and the route itself doesn't pass `q` yet (that's wave 4's `GET /api/admin/gift-cards` extension per D-13). All 15 of its existing cases continue to pass unchanged against the extended function signature, since `q` is optional. Verified explicitly, not just left untouched by assumption.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `appendGiftCardEvent`/`listGiftCardEvents` are ready for plan 14-06 (events route) and plan 14-07 (all seven mutation routes) to call directly.
- `buildGiftCardTimeline` is ready for plan 14-06's `GET .../[id]/events` route and plan 14-08's detail page.
- `giftCardCodeSuffix`/`maskGiftCardCodeSuffix` are ready for plan 14-05 (issuance/reissue) and plan 14-08 (the masked-code list column).
- The extended `AdminGiftCardPresentation` and `q` search are ready for plan 14-06's list route (D-13) to thread the query parameter through, and for plan 14-08's list UI.
- `admin-gift-card-forbidden-columns.test.ts` already scans `app/api/admin/gift-cards/` unconditionally — once plans 14-06/14-07 create that directory, every route file in it is covered by this contract with no additional wiring.
- No blockers. Full unit suite (302 files / 2632 tests) and full D1 integration suite (30 files / 219 tests) both green after this plan's changes.

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All 8 created/modified source and test files verified present on disk with `[ -f ]`: FOUND
- All 8 task commits (`7b39128`, `dba0f83`, `9dc6bf3`, `014bd57`, `683e475`, `3c3a063`, `7f0fefb`, `138bb21`) verified in `git log --oneline --all`: FOUND
- `mise exec -- npx vitest run tests/unit/lib/gift-cards/timeline.test.ts tests/unit/lib/gift-cards/code.test.ts tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts`: 3 files / 85 tests passed
- `mise exec -- npx vitest run --config vitest.workers.config.mts tests/integration/lib/gift-cards/gift-card-events.test.ts`: 1 file / 11 tests passed
- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors (52 pre-existing warnings, none in this plan's files)
- Full regression: `npm test` — 302 files / 2632 tests passed; `npm run test:workers` — 30 files / 219 tests passed
