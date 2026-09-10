---
phase: 14-gift-card-admin-audit-trail
plan: 03
subsystem: database
tags: [d1, gift-cards, repository, tdd, money, idempotency]

requires:
  - phase: 14-01
    provides: "gift_card_events table, gift_card_accounts.code_suffix column, gift_card_events_reissued_once_idx partial UNIQUE index"
provides:
  - "IssueGiftCardInput.codeSuffix, assertGiftCardCodeSuffix, assertGiftCardReason in lib/gift-cards/domain.ts (D-02, D-05/D-07/D-11)"
  - "giftCardReissueId, giftCardReissueAdjustmentBusinessKey in lib/gift-cards/domain.ts (D-06, D-19)"
  - "issueAccount binds code_suffix into gift_card_accounts.code_suffix"
  - "disableAccount, findReservations, classifyGiftCardReservation, requeueDelivery, writeAdjustment, reissue on the repository returned by createGiftCardRepository"
affects: [14-04, 14-05, 14-06, 14-07]

actuals:
  tokens: 9737
  tasks: 3
  commits: 6
  plan_head_before: a48dfb0241457f41d1884ae169b3839cce931141

tech-stack:
  added: []
  patterns:
    - "reissue idempotency via a deterministic new-card id (SHA-256 over a purpose-scoped message, giftCardReissueId) rather than a custom business key parameter on issueAccount, which always derives its own key from the id it is given (D-19)"
    - "local const closures (issueAccount, readBalance, findReservations, writeAdjustment) instead of object-method shorthand for repository methods that call sibling methods, matching the file's existing findAccountById/findReservationById idiom and avoiding any reliance on `this` binding"
    - "one shared reservation classifier (classifyGiftCardReservation) fed by a single LEFT JOIN against gift_card_ledger_entries, so the reissue guard, release-hold route, and timeline agree on one definition of open/committed_unsettled/released/expired/settled instead of three"

key-files:
  created: []
  modified:
    - lib/gift-cards/domain.ts
    - lib/gift-cards/repository.ts
    - tests/unit/lib/gift-cards/domain.test.ts
    - tests/integration/lib/gift-cards/repository.test.ts

key-decisions:
  - "Second reissue attempt intentionally FAILS rather than silently succeeding a second time: readBalance runs before writeAdjustment/issueAccount, so a retry on an already-reissued card sees a zero balance and throws GiftCardConflictError before writing anything. This matches D-19's own acceptance language (\"a second reissue attempt fails and leaves no partial state\") rather than the restoreRedemption-style \"second call returns created:false\" idiom used elsewhere in this file."
  - "writeAdjustment does not reuse assertGiftCardMoney (which rejects negative values unconditionally) since an adjustment amount is signed by design; validation is a few inline checks (Money instance, valid currency) instead of a new domain assertion, since no artifact in the plan calls for one."

requirements-completed: [GCA-01, GCA-04, GCA-05, GCA-06, GCA-09]

coverage:
  - id: D1
    description: "Issuance stores a four-character code suffix in gift_card_accounts.code_suffix (or leaves it NULL without one), validated by assertGiftCardCodeSuffix against the gift-card code alphabet (D-02)"
    requirement: GCA-01
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/domain.test.ts#restricts the code suffix to four alphabet characters and rejects everything else"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/gift-cards/domain.test.ts#validates a supplied code suffix as part of issuance input"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#stores a code suffix at issuance, leaves it NULL without one, and converges a suffixed retry"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertGiftCardReason: shared [1, maximum] bound for the phase's free-text admin inputs (disable reason, admin-create reason, note)"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/domain.test.ts#bounds a reason to [1, maximum] and trims no whitespace for it"
        status: pass
    human_judgment: false
  - id: D3
    description: "disableAccount: one-way active -> disabled transition, idempotent-safe on retry, throws GiftCardUnavailableError for an unknown id (D-05)"
    requirement: GCA-04
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#disables an active card once, safely no-ops a retry, and rejects an unknown id"
        status: pass
    human_judgment: false
  - id: D4
    description: "findReservations + classifyGiftCardReservation: every reservation for a card, newest first, classified as open/committed_unsettled/released/expired/settled from one LEFT JOIN query (D-10)"
    requirement: GCA-06
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#classifies every reservation for a card as open, committed-unsettled, released, expired, or settled"
        status: pass
    human_judgment: false
  - id: D5
    description: "requeueDelivery: needs_review -> pending with attempts/claim/lease reset together; any other delivery status is left untouched (D-09)"
    requirement: GCA-06
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#re-queues a needs_review delivery back to pending and leaves any other status untouched"
        status: pass
    human_judgment: false
  - id: D6
    description: "writeAdjustment: one negative ledger entry per business key, idempotent on retry, overdraft refused by the 0022 balance guard trigger rather than application arithmetic (D-06)"
    requirement: GCA-05
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#writes exactly one negative adjustment entry per business key and refuses an overdraft"
        status: pass
    human_judgment: false
  - id: D7
    description: "reissue: drains a disabled card with no blocking reservation into a new card for the same amount; provably once-only against real D1 (a second attempt fails and leaves no partial state); refuses an active card or one with an open/committed-unsettled reservation (D-06, D-19)"
    requirement: GCA-05
    verification:
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#reissues a disabled card with no blocking reservation, draining it and issuing a new card for the same amount"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#fails a second reissue attempt on the same card and leaves no partial state"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#refuses to reissue an active card and writes nothing"
        status: pass
      - kind: integration
        ref: "tests/integration/lib/gift-cards/repository.test.ts#refuses to reissue a disabled card blocked by an open or committed-unsettled reservation and writes nothing"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-10
status: complete
---

# Phase 14 Plan 03: Gift-Card Repository Capabilities Summary

**Five new repository methods (disableAccount, findReservations, requeueDelivery, writeAdjustment, reissue) plus a code-suffix column binding at issuance, all proven against real D1 triggers, with the reissue once-only guarantee demonstrated by a second attempt that fails and leaves no partial state.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-09-10T19:42:00Z
- **Completed:** 2026-09-10T20:52:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `issueAccount` now binds an optional four-character `codeSuffix` into `gift_card_accounts.code_suffix`, validated by the new `assertGiftCardCodeSuffix`; a card issued with no suffix leaves the column NULL, and repeated issuance still converges on one row.
- `disableAccount`, `findReservations` (with the shared `classifyGiftCardReservation` classifier), and `requeueDelivery` all exist as repository methods, each proven against the real 0022 triggers rather than mocks.
- `writeAdjustment` writes exactly one signed ledger entry per business key, modelled on `restoreRedemption`'s idempotent single-INSERT idiom; an overdraft is refused by the `gift_card_ledger_balance_guard` trigger, not application arithmetic.
- `reissue` composes status check, reservation-classification guard, balance read, `writeAdjustment`, and `issueAccount` (with a deterministic new-card id from `giftCardReissueId`) into one once-only operation: a second reissue attempt on the same card fails at the balance check — already drained to zero — and leaves no partial state.

## Task Commits

Executed as a `type="tracer"` task (Task 1) followed by two `type="auto"` TDD tasks:

1. **Task 1 RED: failing tests for code suffix and reason validation** - `b30d4d9` (test)
2. **Task 1 GREEN: carry a code suffix through issuance into the column** - `7f27a0b` (feat)
3. **Task 2 RED: failing tests for disableAccount, findReservations, requeueDelivery** - `b76bcfe` (test)
4. **Task 2 GREEN: disableAccount, findReservations, requeueDelivery** - `2584a9a` (feat)
5. **Task 3 RED: failing tests for writeAdjustment and the once-only reissue** - `e059137` (test)
6. **Task 3 GREEN: writeAdjustment and the once-only reissue** - `6e0aa63` (feat)

**Plan metadata:** (this commit)

_No REFACTOR commits — each GREEN implementation was already minimal; no obvious cleanup surfaced._

**Tracer feedback gate (Task 1):** re-ran Task 1's full `<verify>` (unit + integration) end-to-end before starting Task 2's expansion, per the `end-of-phase` human-verify mode with an automated-only `<verify>` block. Passed — logged `⚡ Tracer verified end-to-end — expanding` and continued without a checkpoint.

## Files Created/Modified
- `lib/gift-cards/domain.ts` - `codeSuffix` on `IssueGiftCardInput`, `assertGiftCardCodeSuffix`, `assertGiftCardReason`, `giftCardReissueAdjustmentBusinessKey`, `giftCardReissueId`
- `lib/gift-cards/repository.ts` - `issueAccount` binds `code_suffix`; new `disableAccount`, `findReservations`, `classifyGiftCardReservation` (exported), `requeueDelivery`, `writeAdjustment`, `reissue`; `issueAccount`/`readBalance` refactored from object-method shorthand to local `const` closures so `reissue` can call them directly
- `tests/unit/lib/gift-cards/domain.test.ts` - code-suffix, reason-bound, and reissue-id/business-key unit cases
- `tests/integration/lib/gift-cards/repository.test.ts` - nine new integration cases against real D1 triggers (code suffix, disable, reservation classification, requeue, adjustment, four reissue cases)

## Decisions Made
- Second `reissue` attempt fails rather than silently converging: `readBalance` runs before the write steps, so a retry on an already-reissued card sees a zero balance and throws `GiftCardConflictError` before touching the ledger or accounts table. This matches D-19's stated test ("a second reissue attempt fails and leaves no partial state") rather than the `restoreRedemption`-style silent-idempotent pattern used elsewhere in this file.
- `writeAdjustment` does not call `assertGiftCardMoney` (which unconditionally rejects negative amounts) since an adjustment's whole purpose is a signed value; validation is a few inline checks instead of a new domain assertion, since the plan's artifact list did not call for one.
- `issueAccount` and `readBalance` were converted from object-method shorthand to local `const` closures (matching the file's existing `findAccountById`/`findReservationById` pattern) so `reissue` calls them by closure reference rather than `this.issueAccount(...)` — safer if a future caller destructures the returned repository object.

## Deviations from Plan

### Process Note (no code impact)

**1. `giftCardReissueId`/`giftCardReissueAdjustmentBusinessKey` landed in Task 1's commit instead of Task 3's**
- **Found during:** Task 1 (writing `domain.ts`'s GREEN implementation)
- **Issue:** The plan's Task 3 action text introduces these two functions "beside the existing business-key helpers," but Task 1's GREEN commit already touches `domain.ts` for `codeSuffix`/`assertGiftCardCodeSuffix`/`assertGiftCardReason`. Adding all of Task 1 and Task 3's `domain.ts` helpers in one coherent commit (rather than reopening the same file for two lines' worth of new exports three tasks later) was the more natural grouping and is what actually happened.
- **Effect on TDD gate:** Task 3's RED phase for the two `domain.ts`-level unit tests (`giftCardReissueAdjustmentBusinessKey`, `giftCardReissueId` determinism) passed immediately rather than going RED, since the functions already existed. This is documented rather than hidden: the five genuinely new Task 3 behaviors — all in `repository.ts` (`writeAdjustment`, `reissue`) — did go through a real RED → GREEN cycle, captured and verified via `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK`).
- **Files affected:** `lib/gift-cards/domain.ts` (committed in `7f27a0b`, Task 1's GREEN commit)
- **Verification:** Both functions are covered by passing unit tests either way; `giftCardReissueId`/`giftCardReissueAdjustmentBusinessKey` are correctly wired into `reissue` in Task 3's commit.
- **Impact:** None on correctness or on the artifacts the plan requires to exist by the end of the plan — only on which task's commit introduced two of the seven required exports.

---

**Total deviations:** 1 process note (no code impact), 0 auto-fixed bugs, 0 missing-critical additions, 0 architectural questions.
**Impact on plan:** No scope creep, no correctness gaps. All `must_haves.truths` and acceptance criteria from all three tasks are met and integration-tested against real D1 triggers.

## Issues Encountered
- While writing Task 2's RED tests, an id collision surfaced: the new "classifies every reservation..." test originally reused reservation ids (`reservation_committed`, `reservation_settled`) already used by an earlier, pre-existing test in the same file. Since this D1 integration suite applies migrations once in `beforeAll` and only resets `giftCardId`/`hash` per test (not the database), reservation `id`/`request_key` collide across tests unless explicitly scoped. Fixed by prefixing every new reservation/order id in that test with the per-test `giftCardId` before RED was ever captured — no commit exists with the collision present.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `disableAccount`, `reissue`, `requeueDelivery`, `findReservations`/`classifyGiftCardReservation`, and `writeAdjustment` are ready for plan 14-07's mutation routes and plan 14-04's timeline to call directly — no route in this phase gets its own path to the money tables.
- `giftCardReissueId`/`giftCardReissueAdjustmentBusinessKey` are ready for plan 14-05's new-card issuance path.
- `IssueGiftCardInput.codeSuffix`/`assertGiftCardCodeSuffix` are ready for plan 14-05's `issueLine`/`issueAdminGiftCard`.
- No blockers. Full unit suite (300 files / 2592 tests) and full D1 integration suite (29 files / 208 tests) both green after this plan's changes.

---
*Phase: 14-gift-card-admin-audit-trail*
*Completed: 2026-09-10*

## Self-Check: PASSED
