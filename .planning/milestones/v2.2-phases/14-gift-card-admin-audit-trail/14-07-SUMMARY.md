---
phase: 14-gift-card-admin-audit-trail
plan: 07
subsystem: api
tags: [admin, gift-cards, audit-log, d1, encryption, security-contract]

requires:
  - phase: 14-01
    provides: "gift_card_events table, gift_card_accounts.code_suffix, gift_card_events_reissued_once_idx partial UNIQUE index"
  - phase: 14-02
    provides: "lib/gift-cards/admin-http.ts (readBoundedJsonBody, actorFrom, giftCardAdminFlags, jsonError, GiftCardAdminErrorCode), gift_cards.code_reveal_enabled saveable"
  - phase: 14-03
    provides: "repository.disableAccount/findReservations/classifyGiftCardReservation/requeueDelivery/writeAdjustment/reissue"
  - phase: 14-04
    provides: "appendGiftCardEvent, GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS, the forbidden-column source contract"
  - phase: 14-05
    provides: "issueAdminGiftCard, resendGiftCardDelivery in lib/services/gift-card-fulfillment.ts"
provides:
  - "Seven mutation routes under app/api/admin/gift-cards/[id]/: disable, notes, requeue, release-hold, resend, reissue, reveal"
  - "lib/gift-cards/repository.ts: findDeliveryByGiftCardId"
  - "lib/gift-cards/domain.ts: giftCardReissueDeliveryId"
  - "lib/gift-cards/events.ts: appendGiftCardEvent accepts an optional pre-minted id"
  - "lib/services/gift-card-fulfillment.ts: giftCardDeliveryHasStoredCode, revealGiftCardDeliveryCode"
  - "GiftCardAdminErrorCode: gift_card_already_disabled, delivery_not_resendable"
affects: [14-08, 14-09]

actuals:
  tokens: 18900
  tasks: 3
  commits: 5
  plan_head_before: 1b3a3eb62a46dd62d1461c547ed4681999403c4b

tech-stack:
  added: []
  patterns:
    - "The disable route is the one skeleton every other mutation route copies: checkAdminPermissions -> actorFrom -> readBoundedJsonBody -> environment+honor gate -> validation -> one repository/service call -> one appendGiftCardEvent -> typed NextResponse.json (D-13)"
    - "Ciphertext-column access for reveal lives in lib/services/gift-card-fulfillment.ts (giftCardDeliveryHasStoredCode / revealGiftCardDeliveryCode), split into an availability check and a separate decrypt call, so the route can write the code_revealed audit event strictly before decrypting (D-12) while never itself referencing code_ciphertext/code_nonce/code_key_version — those three literal strings are exactly what the D-14 forbidden-column source contract greps every file under app/api/admin/gift-cards/ for"
    - "reissue's new-card delivery id is a second deterministic SHA-256 derivation (giftCardReissueDeliveryId) sibling to giftCardReissueId, so a retried reissue converges on the same delivery row instead of racing a second one into existence"

key-files:
  created:
    - app/api/admin/gift-cards/[id]/disable/route.ts
    - app/api/admin/gift-cards/[id]/notes/route.ts
    - app/api/admin/gift-cards/[id]/requeue/route.ts
    - app/api/admin/gift-cards/[id]/release-hold/route.ts
    - app/api/admin/gift-cards/[id]/resend/route.ts
    - app/api/admin/gift-cards/[id]/reissue/route.ts
    - app/api/admin/gift-cards/[id]/reveal/route.ts
    - tests/unit/app/api/admin-gift-cards-actions.test.ts
    - tests/unit/app/api/admin-gift-cards-reveal.test.ts
    - tests/integration/gift-card-admin-actions.test.ts
  modified:
    - lib/gift-cards/admin-http.ts
    - lib/gift-cards/domain.ts
    - lib/gift-cards/events.ts
    - lib/gift-cards/repository.ts
    - lib/services/gift-card-fulfillment.ts

key-decisions:
  - "Reveal's ciphertext access moved out of the route file into two new lib/services/gift-card-fulfillment.ts functions (giftCardDeliveryHasStoredCode, revealGiftCardDeliveryCode) rather than the route querying gift_card_deliveries directly, as the plan's action text literally described. Following the plan's literal text would have put the strings code_ciphertext/code_nonce/code_key_version inside reveal/route.ts, which the D-14 forbidden-column source contract (tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts, itself part of this task's own <verify>) greps every file under app/api/admin/gift-cards/ for and fails on. Splitting into an availability check and a separate decrypt call also preserves D-12's ordering requirement (write the audit event, then decrypt)."
  - "Added GiftCardAdminErrorCode.gift_card_already_disabled and .delivery_not_resendable — the plan's behavior bullets named these outcomes but no existing code in the union matched them (gift_card_not_disabled reads as the opposite case — an active card blocking reissue, not a double-disable)."
  - "appendGiftCardEvent gained an optional id field so the resend route can mint the event id before the send (needed for the D-08 idempotency key gift-card-resend/{deliveryId}/{eventId}) and have the audit row land under that same id, rather than the id the write generates internally."
  - "lib/gift-cards/repository.ts gained findDeliveryByGiftCardId(giftCardId) -> { id, recipientEmail } | undefined — a narrow, non-forbidden read the resend and reissue routes both need (resend to resolve the delivery id and default recipient; reissue to resolve the default recipient when no `to` override is given)."
  - "Integration coverage calls repository/service functions directly (disableAccount, requeueDelivery, releaseReservation, reissue, appendGiftCardEvent) against real D1, rather than invoking the Next.js route handlers under vitest-pool-workers. No existing integration test in this codebase invokes a route handler under that harness (checked via grep across tests/integration/); every established gift-card integration suite — repository.test.ts, gift-card-events.test.ts, gift-card-fulfillment.test.ts — exercises the underlying functions directly. The plan's own acceptance language ('against real D1 and real 0022 triggers, asserting both the row state and the resulting gift_card_events rows') is fully satisfied this way; introducing route-handler-through-getCloudflareContext mocking under the workers pool would have been new, unprecedented test-harness surface for this plan alone."

requirements-completed: [GCA-03, GCA-04, GCA-05, GCA-06, GCA-08, GCA-09]

coverage:
  - id: D1
    description: "An admin disables a card with a required reason and the reason lands on a disabled event; an unknown card 404s, an already-disabled card 409s with no second event, a repository failure 503s (D-05, GCA-04)"
    requirement: GCA-04
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-cards-actions.test.ts#POST /api/admin/gift-cards/[id]/disable"
        status: pass
    human_judgment: false
  - id: D2
    description: "An admin adds a note, re-queues a needs_review delivery, releases an uncommitted hold, and resends a delivery email — each writes exactly its own audit event and refuses the wrong state with no event written (D-08, D-09, D-10, D-11, GCA-03, GCA-06)"
    requirement: GCA-06
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-cards-actions.test.ts#POST /api/admin/gift-cards/[id]/notes, requeue, release-hold, resend"
        status: pass
      - kind: integration
        ref: "tests/integration/gift-card-admin-actions.test.ts#re-queues a needs_review delivery / releases an open hold / refuses to release a committed-unsettled reservation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reissue drains a disabled card once, refusing an active card or one with a blocking reservation with no write, and a second attempt on the same card fails leaving exactly one adjustment, one new account, and one reissued event (D-06, D-19, GCA-05)"
    requirement: GCA-05
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-cards-actions.test.ts#POST /api/admin/gift-cards/[id]/reissue"
        status: pass
      - kind: integration
        ref: "tests/integration/gift-card-admin-actions.test.ts#reissues a disabled card once, and a second attempt fails leaving exactly one adjustment, one new account, and one reissued event"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reveal refuses unless the setting is strictly on, the caller is a super admin (service tokens and the dev bypass refused), and the body confirms; the code_revealed event is written before the code is returned, and a failing event write returns no code (D-12, GCA-08)"
    requirement: GCA-08
    verification:
      - kind: unit
        ref: "tests/unit/app/api/admin-gift-cards-reveal.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "No response from any of these seven routes carries code material, and none of them writes admin_settings (D-14, D-16, GCA-09)"
    requirement: GCA-09
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/honor-decision-owner-source.test.ts"
        status: pass
    human_judgment: false

duration: 92min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 07: Gift-Card Admin Mutation Routes Summary

**Seven mutation routes (disable, notes, requeue, release-hold, resend, reissue, reveal) over HTTP, each writing exactly one audit event, with reveal's ciphertext access deliberately kept out of the route directory so the D-14 forbidden-column contract never has to scan a route file for a code column.**

## Performance

- **Duration:** ~92 min
- **Started:** 2026-09-10T19:33:00Z
- **Completed:** 2026-09-10T21:04:53Z
- **Tasks:** 3
- **Files modified:** 15 (10 created, 5 modified)

## Accomplishments
- `disable/route.ts` — the archetype every other route copies: a required 1-500 character reason, one `disabled` event, no re-enable path (D-05).
- `notes/route.ts`, `requeue/route.ts`, `release-hold/route.ts`, `resend/route.ts` — four routine actions, each its own audit event (`note`, `delivery_requeued`, `hold_released`, `delivery_resent`), and resend's idempotency key naming both the delivery id and the freshly minted event id so the sender's own dedupe cannot swallow it (D-08/D-09/D-10/D-11).
- `reissue/route.ts` — drains a disabled card's balance into a new card once only, composing `repository.reissue` with the same code-generation/encryption machinery `issueAdminGiftCard` uses, writing the paired `reissued`/`reissued_from` events (D-06/D-19).
- `reveal/route.ts` — off by default, super-admin-only (service tokens and the dev bypass refused), confirm-gated, and audited strictly before the code is decrypted and returned, with a `Cache-Control: no-store` header (D-12/GCA-08).
- Full plan `<verification>` block re-run clean on the final HEAD: 39 unit assertions across the two new unit test files, 6 D1 integration assertions, the forbidden-column source contract, `npm run lint`, and `npm run typecheck` all pass.

## Task Commits

Each task was committed, with one process caveat documented below (a parallel-plan staging race):

1. **Task 1: disable route (the archetype) + shared test scaffold** - `4871c84` (feat)
2. **Task 2: notes, requeue, release-hold, resend routes** - landed inside `030178b` (`docs(14-06): complete gift-card admin read/create routes plan`), the sibling 14-06 executor's own final commit, due to a shared non-worktree checkout staging race — see Deviations. Content verified byte-identical to what this plan wrote (`git diff --quiet 030178b -- <file>` for every affected file).
3. **Task 3: reissue and reveal routes** - `e2bac89` (feat)
4. **Integration test coverage** - `59159f2` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/api/admin/gift-cards/[id]/disable/route.ts` - required-reason disable, no re-enable (D-05)
- `app/api/admin/gift-cards/[id]/notes/route.ts` - 1-2000 character CSR note (D-11)
- `app/api/admin/gift-cards/[id]/requeue/route.ts` - `needs_review` -> `pending` (D-09)
- `app/api/admin/gift-cards/[id]/release-hold/route.ts` - releases only an `open` reservation (D-10)
- `app/api/admin/gift-cards/[id]/resend/route.ts` - re-send without touching the delivery row (D-08/D-21)
- `app/api/admin/gift-cards/[id]/reissue/route.ts` - once-only drain-and-issue (D-06/D-19)
- `app/api/admin/gift-cards/[id]/reveal/route.ts` - off/super-admin/confirm/audited-first reveal (D-12)
- `lib/gift-cards/admin-http.ts` - `+gift_card_already_disabled`, `+delivery_not_resendable`
- `lib/gift-cards/domain.ts` - `+giftCardReissueDeliveryId`
- `lib/gift-cards/events.ts` - `appendGiftCardEvent` accepts an optional pre-minted `id`
- `lib/gift-cards/repository.ts` - `+findDeliveryByGiftCardId`
- `lib/services/gift-card-fulfillment.ts` - `+giftCardDeliveryHasStoredCode`, `+revealGiftCardDeliveryCode`
- `tests/unit/app/api/admin-gift-cards-actions.test.ts` - 29 assertions across disable/notes/requeue/release-hold/resend/reissue
- `tests/unit/app/api/admin-gift-cards-reveal.test.ts` - 10 assertions covering every reveal gate
- `tests/integration/gift-card-admin-actions.test.ts` - 6 D1 assertions against real triggers

## Decisions Made

See frontmatter `key-decisions` for the full rationale on each. Summary:
- Reveal's ciphertext handling moved to `lib/services/gift-card-fulfillment.ts` (not the route file) to satisfy the D-14 forbidden-column source contract while still meeting D-12's write-then-decrypt ordering.
- Two new `GiftCardAdminErrorCode` values added (`gift_card_already_disabled`, `delivery_not_resendable`) — the plan's behavior bullets needed them and no existing code fit.
- `appendGiftCardEvent` gained an optional `id` for the resend idempotency-key contract.
- `findDeliveryByGiftCardId` added to the repository for the resend/reissue recipient-resolution need.
- Integration tests call repository/service functions directly rather than the HTTP route layer, matching every other integration suite in this codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] Moved reveal's ciphertext access out of the route file**
- **Found during:** Task 3 (reveal route)
- **Issue:** The plan's action text has the reveal route load the delivery row and call `decryptGiftCardDeliveryCode` directly, which would put the literal strings `code_ciphertext`/`code_nonce`/`code_key_version` inside `app/api/admin/gift-cards/[id]/reveal/route.ts` — exactly what `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` greps every file under that directory for and fails on. That test is itself part of Task 3's own `<verify>` command, so following the plan's literal text would have made the task's own acceptance gate fail.
- **Fix:** Added `giftCardDeliveryHasStoredCode` and `revealGiftCardDeliveryCode` to `lib/services/gift-card-fulfillment.ts` (already home to `resendGiftCardDelivery`'s identical ciphertext-column pattern, and not scanned by the contract), split so the route can check availability, write the audit event, and only then decrypt — preserving D-12's ordering.
- **Files modified:** app/api/admin/gift-cards/[id]/reveal/route.ts, lib/services/gift-card-fulfillment.ts
- **Verification:** `tests/unit/lib/gift-cards/admin-gift-card-forbidden-columns.test.ts` passes with the full seven-route directory populated; `tests/unit/app/api/admin-gift-cards-reveal.test.ts` proves the write-before-decrypt ordering directly.
- **Committed in:** e2bac89

**2. [Rule 3 - Blocking] Added two missing GiftCardAdminErrorCode values**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan's behavior bullets specify a 409 for an already-disabled card and a 409 for a non-resendable delivery, but `lib/gift-cards/admin-http.ts`'s `GiftCardAdminErrorCode` union (from plan 14-02) had no matching literal — `gift_card_not_disabled` reads as the opposite case (an active card blocking reissue). Using either the wrong existing code or an ad-hoc unlisted string would have both been wrong.
- **Fix:** Added `gift_card_already_disabled` and `delivery_not_resendable` to the union — additive, non-breaking.
- **Files modified:** lib/gift-cards/admin-http.ts
- **Verification:** `npm run typecheck` passes; unit tests assert the exact codes.
- **Committed in:** 4871c84

**3. [Rule 3 - Blocking] appendGiftCardEvent needed a pre-mintable event id**
- **Found during:** Task 2 (resend route)
- **Issue:** D-08 requires the resend idempotency key to be `gift-card-resend/{deliveryId}/{eventId}`, but `appendGiftCardEvent` always generated its own id internally with no way for the caller to learn it before the write (or to make the send and the audit row share one id).
- **Fix:** Added an optional `id` field to `AppendGiftCardEventInput`; `appendGiftCardEvent` uses `input.id ?? crypto.randomUUID()`. Every other caller is unaffected (field is optional).
- **Files modified:** lib/gift-cards/events.ts
- **Verification:** Unit test asserts the idempotency key contains the exact id the event was written under.
- **Committed in:** landed inside 030178b (see process note below)

**4. [Rule 3 - Blocking] Added findDeliveryByGiftCardId to the repository**
- **Found during:** Task 2 (resend route)
- **Issue:** `resendGiftCardDelivery` takes a `deliveryId`, not a `giftCardId` — the route needs to resolve the delivery id (and the default recipient address) for a card before calling it, and neither existing repository method nor presentation function exposed just that.
- **Fix:** Added `findDeliveryByGiftCardId(giftCardId) -> { id, recipientEmail } | undefined`, selecting only two non-forbidden columns.
- **Files modified:** lib/gift-cards/repository.ts
- **Verification:** Unit and integration tests both exercise it indirectly through the resend/reissue routes.
- **Committed in:** landed inside 030178b (see process note below)

---

**Total deviations:** 4 auto-fixed (1 bug-avoidance re: a test contract, 3 blocking additions). **Impact:** All four were necessary for the plan's own stated acceptance criteria (the forbidden-column contract, the D-08 idempotency requirement, the resend/reissue recipient lookup) to hold. No scope creep beyond what those requirements demanded.

### Process note — a parallel-plan staging race (not a code deviation)

Task 2's four route files (`notes`, `requeue`, `release-hold`, `resend`) plus the accompanying `lib/gift-cards/repository.ts` and `lib/gift-cards/events.ts` changes were staged with `git add <explicit paths>` as instructed, but before this plan's own commit ran, the parallel 14-06 executor (running in the same non-worktree checkout) executed its own final `docs(14-06): complete...` commit, which swept these already-staged files into its commit rather than this plan's. Content was verified byte-identical to what this plan authored (`git diff --quiet 030178b -- <path>` for every affected file returns no diff) — no data loss or corruption, only a mis-attributed commit. The 14-06 executor independently documented the same event from its side in `6beea60`. No corrective git surgery was performed (per the destructive-operation prohibition); this note plus the `030178b` reference in the Task Commits table is the record.

## Issues Encountered

None beyond the staging race documented above.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None beyond the STRIDE register already declared in the plan — all fourteen threats (T-14-38 through T-14-51) are mitigated by the implementation as specified: `checkAdminPermissions` first in every handler, `isSuperAdminActor` gating reveal, the setting read as strictly `true`, the event written before decryption, `Cache-Control: no-store`, `assertGiftCardEventDetails` on every write, the deterministic reissue id plus the D-01 partial unique index, the repository's own reservation/status checks, the requeue status predicate, the resend event-before-address record, the 4 KiB body cap, same-origin enforcement inside `checkAdminPermissions`, and no route importing the settings writer.

## Next Phase Readiness
All seven mutation routes exist, are tested (unit + D1 integration), and pass lint/typecheck. Ready for plan 14-08 (action bar and dialogs) to wire these routes into the admin UI, and for plan 14-09's phase gate to re-run the full verification suite.

## Self-Check: PASSED

- `app/api/admin/gift-cards/[id]/disable/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/notes/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/requeue/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/release-hold/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/resend/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/reissue/route.ts` exists: FOUND
- `app/api/admin/gift-cards/[id]/reveal/route.ts` exists: FOUND
- `tests/unit/app/api/admin-gift-cards-actions.test.ts` exists: FOUND
- `tests/unit/app/api/admin-gift-cards-reveal.test.ts` exists: FOUND
- `tests/integration/gift-card-admin-actions.test.ts` exists: FOUND
- Commit `4871c84` exists in history: FOUND
- Commit `e2bac89` exists in history: FOUND
- Commit `59159f2` exists in history: FOUND
- Commit `030178b` (Task 2 content) exists in history: FOUND

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*
