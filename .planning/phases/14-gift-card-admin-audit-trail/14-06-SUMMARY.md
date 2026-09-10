---
phase: 14-gift-card-admin-audit-trail
plan: 06
subsystem: api
tags: [d1, gift-cards, admin, tdd, next-app-router, audit-log]

requires:
  - phase: 14-02
    provides: "lib/gift-cards/admin-http.ts: readBoundedJsonBody, actorFrom, giftCardAdminFlags, jsonError, GiftCardAdminErrorCode"
  - phase: 14-03
    provides: "repository disableAccount/findReservations/classifyGiftCardReservation, assertGiftCardReason"
  - phase: 14-04
    provides: "lib/gift-cards/events.ts (appendGiftCardEvent, GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS), lib/gift-cards/timeline.ts (buildGiftCardTimeline), extended AdminGiftCardPresentation with q search"
  - phase: 14-05
    provides: "issueAdminGiftCard in lib/services/gift-card-fulfillment.ts"
provides:
  - "GET /api/admin/gift-cards/[id] — full admin card view, gated, code-material-free"
  - "GET /api/admin/gift-cards/[id]/events — merged oldest-first timeline"
  - "q search + meta.total on GET /api/admin/gift-cards; POST /api/admin/gift-cards admin-create"
  - "getAdminGiftCardPresentation export on lib/gift-cards/presentations.ts (single-card counterpart to listAdminGiftCardPresentations)"
  - "Extended honor-decision-owner-source.test.ts askers list naming the two new routes (D-16)"
affects: [14-07, 14-08, 14-09]

actuals:
  tokens: 9338
  tasks: 3
  commits: 6
  plan_head_before: 55d04cec152e178ad3db63475a68b4eba3d59a79

tech-stack:
  added: []
  patterns:
    - "A single-card presentation read (getAdminGiftCardPresentation) added to lib/gift-cards/presentations.ts so the detail route reuses the same PRESENTATION_SELECT/mapRow/resolvePurchaserLabels the list route uses, keeping the plan's 'no SQL statement in a route' rule literal rather than aspirational"
    - "POST admin-create only writes its admin_created audit event when issueAdminGiftCard reports created: true — an idempotent requestId retry (created: false) must not duplicate the event"
    - "Wrong-but-not-throwing RED scaffolds (NextResponse.json({ wrong: true })) for each new route file, so new test assertions fail on real status/body mismatches rather than a vacuous throw or a module-load crash"

key-files:
  created:
    - app/api/admin/gift-cards/[id]/route.ts
    - app/api/admin/gift-cards/[id]/events/route.ts
    - tests/unit/app/api/admin-gift-card-detail-routes.test.ts
  modified:
    - app/api/admin/gift-cards/route.ts
    - lib/gift-cards/presentations.ts
    - tests/unit/app/api/gift-card-presentation-routes.test.ts
    - tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts

key-decisions:
  - "Added getAdminGiftCardPresentation to lib/gift-cards/presentations.ts even though it was not in the plan's files_modified list — the plan's own objective ('No route in this plan contains a SQL statement') and D-14's forbidden-column discipline leave no route-local way to fetch the masked code / code suffix / delivery status / purchaser label for one id without either duplicating PRESENTATION_SELECT in the route or exporting a single-row counterpart from the module that already owns that projection."
  - "Constructed the invalid_limit error response directly with NextResponse.json(...) in the events route instead of widening the shared GiftCardAdminErrorCode union in lib/gift-cards/admin-http.ts, because that file was being actively edited by the parallel 14-07 executor in this shared (non-worktree) checkout for the duration of this plan's execution."
  - "The detail route calls findAccountById for the 404 existence gate and getAdminGiftCardPresentation for display fields as two separate repository/module calls, exactly as the plan's action text specifies, rather than collapsing them into one query — a missing presentation row for an account that was just found falls through to the 503 catch as a data-integrity surprise, not a false 404."

requirements-completed: [GCA-01, GCA-02, GCA-07, GCA-09]

coverage:
  - id: D1
    description: "A card's detail is fetched by id through GET /api/admin/gift-cards/[id], refusing an unauthenticated caller with 401 and carrying no code material in a successful response (D-13, GCA-09)"
    requirement: GCA-09
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#401s an unauthenticated caller"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#404s with gift_card_not_found for an unknown id"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#returns a full card view with reservations classified and capabilities from the stored setting"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#carries no forbidden column names in a successful response body"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#503s on a database failure with code gift_cards_read_failed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The list is searchable by exact order id, recipient email or four-character suffix via q, and reports meta.total for the UI to page through (D-15, GCA-01)"
    requirement: GCA-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/gift-card-presentation-routes.test.ts#passes q through to the projection and reports meta.total (D-15)"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/gift-card-presentation-routes.test.ts#rejects a malformed q with invalid_query"
        status: pass
    human_judgment: false
  - id: D3
    description: "An admin creates a card by posting amount, recipient email and reason; one admin_created event records who and why, only for a genuinely new card (D-07, GCA-07)"
    requirement: GCA-07
    verification:
      - kind: unit
        ref: "tests/unit/app/api/gift-card-presentation-routes.test.ts#issues a card, writes one admin_created event, and returns the new card id"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/gift-card-presentation-routes.test.ts#converges two identical requestId posts into one card and one event"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/gift-card-presentation-routes.test.ts#503s on a write failure with gift_cards_write_failed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The timeline route returns merged entries oldest first with resolved actor labels and a bounded limit (D-04, GCA-02)"
    requirement: GCA-02
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#returns entries oldest first with meta.limit"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#400s with invalid_limit for a non-positive-integer limit"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every route in this plan asks resolveHonorEffective directly for the surface-existence decision, and the Phase 13 ownership contract now names them (D-16)"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts#every surface that asks the money question asks the owner"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#calls resolveHonorEffective with both flags rather than a bare boolean"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-card-detail-routes.test.ts#contains a direct call to resolveHonorEffective"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 06: Gift-Card Admin Read/Create Routes Summary

**Three thin admin routes — card detail, merged timeline, and a searchable/pageable list with admin-create — every one auth-gated, honor-gated through `resolveHonorEffective`, and provably free of code material.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-10T20:16:00Z (approx.)
- **Completed:** 2026-09-10T21:01:00Z
- **Tasks:** 3 (1 tracer, 2 auto), all `tdd="true"`
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `GET /api/admin/gift-cards/[id]`: full admin card view built field by field from `findAccountById` (existence), the new `getAdminGiftCardPresentation` (display fields), and `findReservations`/`classifyGiftCardReservation` (each reservation classified) — never a spread of an account or delivery row. `capabilities.codeRevealEnabled` reads the same stored `gift_cards.code_reveal_enabled` setting plan 14-07's reveal route and plan 14-08's UI will read.
- `GET /api/admin/gift-cards/[id]/events`: bounded-`limit` (`invalid_limit` on a bad value), honor-gated, existence-checked, then a typed body around `buildGiftCardTimeline` — no merge/sort logic in the route itself.
- `app/api/admin/gift-cards/route.ts` extended: `GET` accepts an optional `q`, rejects a duplicate or over-254-character value as `invalid_query`, and `meta` now carries `total` alongside `limit`/`offset`. `POST` validates a body (`amountMinor`, `recipientEmail`, `reason`, `requestId`, optional `recipientName`/`currency`), calls `issueAdminGiftCard`, and writes one `admin_created` event — only for a genuinely new card, never on an idempotent `requestId` retry.
- `lib/gift-cards/presentations.ts` gained `getAdminGiftCardPresentation` — a single-card counterpart to `listAdminGiftCardPresentations`, reusing the existing `PRESENTATION_SELECT`/`mapRow`/`resolvePurchaserLabels` so the detail route contains no SQL of its own.
- `tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts`'s `askers` array now names both new route paths (D-16); a comment marks where plan 14-08 adds its detail-page path.

## Task Commits

Executed as three `tdd="true"` tasks (Task 1 `type="tracer"`, Tasks 2-3 `type="auto"`), each RED -> GREEN, no REFACTOR needed:

1. **Task 1 RED: failing tests for GET /api/admin/gift-cards/[id]** - `5a55233` (test)
2. **Task 1 GREEN: implement GET /api/admin/gift-cards/[id]** - `7755a46` (feat)
3. **Task 2 RED: failing tests for q search and POST admin-create** - `4063a3e` (test)
4. **Task 2 GREEN: implement q search and POST admin-create** - `2b8df50` (feat)
5. **Task 3 RED: failing tests for GET /api/admin/gift-cards/[id]/events** - `ad2b0b8` (test)
6. **Task 3 GREEN: implement GET /api/admin/gift-cards/[id]/events** - `1b3a3eb` (feat)

**Plan metadata:** (this commit)

**Tracer feedback gate (Task 1):** re-ran Task 1's full `<verify>` (`admin-gift-card-detail-routes.test.ts` + `admin-gift-card-forbidden-columns.test.ts`, 18 tests) after GREEN, before starting Task 2's expansion, per the `end-of-phase` human-verify mode with an automated-only `<verify>` block. Passed — logged `⚡ Tracer verified end-to-end — expanding` and continued without a checkpoint.

## Files Created/Modified
- `app/api/admin/gift-cards/[id]/route.ts` - card detail route (D-13, D-16)
- `app/api/admin/gift-cards/[id]/events/route.ts` - timeline route (D-04, D-16)
- `app/api/admin/gift-cards/route.ts` - `q` search + `meta.total` on `GET`, new `POST` admin-create (D-07, D-15)
- `lib/gift-cards/presentations.ts` - new `getAdminGiftCardPresentation` export
- `tests/unit/app/api/admin-gift-card-detail-routes.test.ts` - detail + events route cases
- `tests/unit/app/api/gift-card-presentation-routes.test.ts` - `q`/`meta.total` + `POST` admin-create cases
- `tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts` - extended `askers` array

## Decisions Made
- `getAdminGiftCardPresentation` added to `lib/gift-cards/presentations.ts` — see frontmatter `key-decisions` for the full rationale (the plan's own "no SQL statement in a route" objective, plus D-14's forbidden-column discipline, leave no other route-local way to get the masked code / code suffix / delivery status / purchaser label for one id).
- `invalid_limit` constructed directly with `NextResponse.json(...)` in the events route rather than widening the shared `GiftCardAdminErrorCode` union in `lib/gift-cards/admin-http.ts`, which the parallel 14-07 executor was actively editing in this shared checkout for the duration of this plan.
- POST admin-create writes its `admin_created` event only when `issueAdminGiftCard` reports `created: true`, so a double-submit sharing a `requestId` never produces two audit rows for one card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `getAdminGiftCardPresentation` to `lib/gift-cards/presentations.ts` (not in `files_modified`)**
- **Found during:** Task 1 (implementing the detail route)
- **Issue:** The plan's `files_modified` list does not include `lib/gift-cards/presentations.ts`, but the plan's own objective states "No route in this plan contains a SQL statement" and the detail route's `must_haves`/acceptance criteria require the exact presentation shape (masked code, code suffix, delivery status, resolved purchaser label) that only `presentations.ts`'s private `PRESENTATION_SELECT`/`mapRow`/`resolvePurchaserLabels` can produce. Building that query inline in the route would violate the plan's own "no SQL" rule and duplicate logic the existing forbidden-column contract already covers for `presentations.ts`.
- **Fix:** Added a small, additive `getAdminGiftCardPresentation(database, id, now)` export that reuses the existing private helpers for a single-row read, mirroring `listAdminGiftCardPresentations`'s own construction.
- **Files modified:** `lib/gift-cards/presentations.ts`
- **Verification:** `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` (which already scans this file) still passes; the detail route's own forbidden-column assertion passes.
- **Committed in:** `7755a46` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking, scope-preserving] Did not widen `GiftCardAdminErrorCode` in `lib/gift-cards/admin-http.ts` for `invalid_limit`**
- **Found during:** Task 3 (implementing the events route)
- **Issue:** The events route's behavior requires a 400 response with code `invalid_limit`, which is not in `lib/gift-cards/admin-http.ts`'s `GiftCardAdminErrorCode` union. That file is outside this plan's `files_modified` and was being actively edited by the parallel 14-07 executor in this same non-worktree checkout for the duration of this plan's execution (observed via `git status` showing it modified throughout).
- **Fix:** Constructed the `invalid_limit` response directly with `NextResponse.json({ code: 'invalid_limit', ... }, { status: 400 })` in the events route instead of extending the shared type, avoiding any edit to a file a sibling executor was mid-edit on.
- **Files modified:** `app/api/admin/gift-cards/[id]/events/route.ts` only
- **Verification:** `tests/unit/app/api/admin-gift-card-detail-routes.test.ts#400s with invalid_limit for a non-positive-integer limit` passes.
- **Committed in:** `1b3a3eb` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical export, 1 blocking scope-preservation).
**Impact on plan:** No SQL landed in any route (the plan's stated goal); no shared file was edited concurrently with a sibling executor. Both deviations stayed within this plan's actual surface (one small additive export, one route-local construction) and are independently proven by passing tests.

## Issues Encountered

None blocking. During Task 1 test authoring, a reservation fixture's `expiresAt` was initially set to a fixed past epoch (`1_700_100_000`, November 2023) against the route's real `Date.now()`-derived `now`, which classified the reservation as `expired` instead of the intended `open` — caught by the test itself before any commit and fixed to a `Date.now() + 3_600` relative expiry.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GET /api/admin/gift-cards/[id]`, `GET /api/admin/gift-cards/[id]/events`, `q` search, `meta.total`, and `POST` admin-create are all live and tested; plan 14-08's list/detail/create UI can call them directly.
- `getAdminGiftCardPresentation` is available for any other single-card read plan 14-07's mutation routes might want, though none of them are required to use it.
- The honor-decision ownership contract now names both new routes; plan 14-08 adds its detail-page path to the same `askers` array per the comment left in place.
- No blockers. Full targeted suite for this plan (detail + events + list/create + honor-decision-owner-source + forbidden-columns) passes; `npm run lint` and `npm run typecheck` both exit 0 with no new errors or warnings in this plan's files.

## Self-Check: PASSED

- `app/api/admin/gift-cards/[id]/route.ts` exists and exports `GET`: FOUND
- `app/api/admin/gift-cards/[id]/events/route.ts` exists and exports `GET`: FOUND
- `app/api/admin/gift-cards/route.ts` exports both `GET` and `POST`: FOUND
- `lib/gift-cards/presentations.ts` exports `getAdminGiftCardPresentation`: FOUND
- All 6 task commits (`5a55233`, `7755a46`, `4063a3e`, `2b8df50`, `ad2b0b8`, `1b3a3eb`) verified in `git log --oneline`: FOUND
- `mise exec -- npx vitest run tests/unit/app/api/admin-gift-card-detail-routes.test.ts tests/unit/app/api/gift-card-presentation-routes.test.ts`: 44/44 passed
- `mise exec -- npx vitest run tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts`: 15/15 passed
- `mise exec -- npm run lint`: exit 0 (52 pre-existing warnings, none in this plan's files)
- `mise exec -- npm run typecheck`: exit 0

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*
