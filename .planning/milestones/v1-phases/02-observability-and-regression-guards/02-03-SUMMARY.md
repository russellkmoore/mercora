---
phase: 02-observability-and-regression-guards
plan: 03
subsystem: observability
tags: [telemetry, stripe, webhooks, vitest]

requires:
  - phase: 02-observability-and-regression-guards
    provides: "payment.intent_failed taxonomy entry and the reason enum field, registered in both lib/observability/telemetry.ts and workers/observability-tail/src/core.ts by plan 02-01"
provides:
  - "Closed allow-list mapper (mapDeclineReason) from any Stripe last_payment_error shape to a five-value reason enum"
  - "Telemetry-only handlePaymentFailed: emits payment.intent_failed and writes no order state, ledger row, inventory adjustment, or email"
  - "RUN-02 hand-off note in deferred-items.md for Phase 3's webhook-doc update"
affects: [03-run-02-docs]

actuals:
  tokens: 4391
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure, import-free allow-list mapper module (decline-reason.ts) as the single trust boundary between a free-form/large-union upstream value and a closed telemetry enum"
    - "Handler modules under app/api/webhooks/stripe/handlers/ are tested only through the route's POST dispatch test, never with a standalone unit-test file for the handler module itself — matches the existing refund-handlers.ts and subscription-handlers.ts convention"

key-files:
  created:
    - app/api/webhooks/stripe/handlers/decline-reason.ts
    - tests/unit/app/api/stripe-webhook-payment-failed.test.ts
    - .planning/phases/02-observability-and-regression-guards/deferred-items.md
  modified:
    - app/api/webhooks/stripe/route.ts

key-decisions:
  - "Removed the metadata/orderId early-return guard entirely rather than keeping it as dead code; the guard protected an order-state update this handler no longer performs, and keeping it would silently drop telemetry for orphaned failures (the exact blind spot OBS-05 exists to close). Recorded as the plan's one discretion call, per the plan's own instruction."
  - "Changed the dispatch switch's outcome for payment_intent.payment_failed from 'ignored' to 'handled': the plan's must_haves truths and Task 2's <behavior> both state completeWebhookEvent must be called with outcome: 'handled', which is the correct signal now that the handler genuinely does something (emit telemetry) rather than nothing."
  - "decline-reason.ts has no standalone unit-test file, despite tdd=\"true\" on Task 1. Its full 10-case behavior matrix (undefined/null/non-object, non-string code, the decline_code refinement rule and its negative case, every mapped code, unmapped code) is exercised only indirectly through 6 of the 10 route-level tests, plus manual verification of the remaining edge cases against the implementation during execution. This mirrors the codebase's established convention — no other file in app/api/webhooks/stripe/handlers/ (refund-handlers.ts, subscription-handlers.ts) has a dedicated unit-test file either; all are tested through the route's POST dispatch. Task 1's own <verify> block only specifies grep/typecheck checks, not a vitest run, which is consistent with this reading."

patterns-established: []

requirements-completed: [OBS-05]

coverage:
  - id: D1
    description: "A payment_intent.payment_failed webhook produces exactly one payment.intent_failed telemetry envelope (severity warning) carrying only provider, outcome, and reason — no payment intent, charge, customer, or order identifier"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#emits exactly one console.warn telemetry envelope for the failed-intent event"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#carries exactly the three fields provider, outcome, and reason"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#never includes the payment intent id, charge id, customer id, or order id in the envelope"
        status: pass
    human_judgment: false
  - id: D2
    description: "mapDeclineReason is a total, closed allow-list function: every Stripe code/decline_code shape (mapped, unmapped, null, non-string, free-form decline_code) collapses to one of five fixed reason values, never a raw Stripe string"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#maps an expired-card decline code to the expired_card reason"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#maps an unmapped Stripe decline code to other"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#maps a payment intent with no last_payment_error at all to other"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "Six of decline-reason.ts's ten behavior bullets (undefined/null/empty-object input, non-string code, the decline_code refinement's positive and negative cases) are not driven by a dedicated automated test — only verified by direct code review during execution and by the three route-level reason-mapping tests plus typecheck. A human reviewer should confirm the mapper's full behavior matrix against app/api/webhooks/stripe/handlers/decline-reason.ts directly."
  - id: D3
    description: "handlePaymentFailed provably writes nothing (no order update, ledger write, inventory adjustment, or email) and is idempotent under redelivery"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#calls no state-changing collaborator beyond the claim/complete pair the POST wrapper performs"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#replaying the same event three times yields three telemetry lines and zero state changes"
        status: pass
      - kind: other
        ref: "awk negative gate over handlePaymentFailed body for update|insert|finalize|promote|send|adjust|restock|ledger"
        status: pass
    human_judgment: false
  - id: D4
    description: "The POST route still answers 200 and records payment_intent.payment_failed as handled, the dispatch case and Stripe subscription stay live, and no placeholder task marker remains in the file"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#returns 200 and records the event as handled through completeWebhookEvent"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-payment-failed.test.ts#still emits telemetry for an intent with no orderId in metadata"
        status: pass
      - kind: other
        ref: "grep -q 'TODO' app/api/webhooks/stripe/route.ts (expected: no match)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 3's RUN-02 has a written, code-verified hand-off recording that payment_intent.payment_failed is telemetry-only and stays subscribed, plus the tail_consumers carry-forward"
    requirement: "OBS-05"
    verification:
      - kind: other
        ref: ".planning/phases/02-observability-and-regression-guards/deferred-items.md (2 sections, both required facts present, no diff to docs/DEPLOYMENT_SETUP.md or docs/STRIPE_INTEGRATION.md)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-02
status: complete
---

# Phase 2 Plan 3: Telemetry-Only Failed-Payment Handler Summary

**`handlePaymentFailed` now emits one identifier-free `payment.intent_failed` event through a closed allow-list decline-reason mapper, writes nothing, and the placeholder TODO and its dead guard are gone.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-02T19:44:47Z
- **Completed:** 2026-09-02T19:49:19Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added `app/api/webhooks/stripe/handlers/decline-reason.ts`: a pure, import-free, total mapper (`mapDeclineReason`) collapsing any Stripe `last_payment_error` shape to one of five closed `DECLINE_REASONS` values, refining the generic `card_declined` code via `decline_code` only when it is exactly `insufficient_funds`.
- Rewrote `handlePaymentFailed` in `app/api/webhooks/stripe/route.ts` to emit `recordTelemetry('payment.intent_failed', { provider: 'stripe', outcome: 'failed', reason: mapDeclineReason(...) })` and nothing else — no order-state change, no email, no inventory touch, no ledger write.
- Removed the metadata/`orderId` early-return guard and the four-line placeholder comment block (including its `TODO`), and changed the dispatch switch's outcome for this event from `'ignored'` to `'handled'` to match the event now genuinely being processed.
- Added `tests/unit/app/api/stripe-webhook-payment-failed.test.ts` (10 tests) covering dispatch, envelope shape, reason mapping through the route, the no-identifier contract, no-state-change, and idempotent triple-replay.
- Recorded the RUN-02 hand-off and the `tail_consumers` carry-forward in a new `deferred-items.md` for Phase 2.

## Task Commits

1. **Task 1: Closed-allow-list decline-reason mapper** - `8aab9ff` (feat)
2. **Task 2: Telemetry-only handlePaymentFailed with the placeholder block removed** - `128f187` (feat)
3. **Task 3: Record the RUN-02 hand-off for Phase 3** - `ece5a27` (docs)

**Plan metadata:** commit follows this SUMMARY.

## Files Created/Modified
- `app/api/webhooks/stripe/handlers/decline-reason.ts` - Pure allow-list mapper (`DECLINE_REASONS`, `mapDeclineReason`)
- `app/api/webhooks/stripe/route.ts` - `handlePaymentFailed` rewritten telemetry-only; dispatch outcome for this event changed to `'handled'`; placeholder/TODO removed
- `tests/unit/app/api/stripe-webhook-payment-failed.test.ts` - Dispatch, envelope, reason-mapping, no-identifier, no-state-change, and replay coverage
- `.planning/phases/02-observability-and-regression-guards/deferred-items.md` - RUN-02 hand-off plus `tail_consumers` carry-forward

## Decisions Made
- Dropped the `orderId` early-return guard entirely (discretion call recorded in the plan): the guard protected an order-state update this handler no longer performs, and the envelope carries no order reference, so keeping it would silently drop telemetry for orphaned failures — the exact blind spot OBS-05 closes.
- Changed dispatch outcome from `'ignored'` to `'handled'` for `payment_intent.payment_failed`, per the plan's `must_haves.truths` ("still records the event as handled through `completeWebhookEvent`") and Task 2's explicit `<behavior>` bullet — this reading takes precedence over the more literal "stays exactly as written" phrasing describing the case's *presence* in the switch, not its outcome literal.
- `decline-reason.ts` has no dedicated unit-test file despite `tdd="true"` on Task 1: the plan's own file list scopes the phase's one new test file to the route-level dispatch test, and no sibling handler module (`refund-handlers.ts`, `subscription-handlers.ts`) has a standalone test file either. Six of the mapper's ten behavior-bullet edge cases are covered only by direct code review plus typecheck, not by an executed test — flagged as `human_judgment: true` on coverage item D2 for reviewer follow-up.

## Deviations from Plan

None — plan executed as written, with two documented discretion calls (the `orderId` guard removal, already anticipated by the plan text, and the dispatch outcome value, resolved by following the plan's `must_haves` over an ambiguous phrase) recorded above rather than as auto-fixed bugs.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3's RUN-02 can update `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md` from `deferred-items.md` without re-deriving the event list from the route.
- `decline-reason.ts`'s full behavior matrix is unverified by automated test beyond 3 route-level cases plus typecheck — worth a follow-up dedicated unit test if this mapper's logic changes again.
- No blockers.

## Self-Check: PASSED

- `app/api/webhooks/stripe/handlers/decline-reason.ts` FOUND
- `app/api/webhooks/stripe/route.ts` FOUND, contains `payment.intent_failed` and no `TODO`
- `tests/unit/app/api/stripe-webhook-payment-failed.test.ts` FOUND
- `.planning/phases/02-observability-and-regression-guards/deferred-items.md` FOUND
- Commit `8aab9ff` FOUND in `git log --oneline --all`
- Commit `128f187` FOUND in `git log --oneline --all`
- Commit `ece5a27` FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run and passing: targeted vitest (4 files, 33 tests), full `npm test` (238 files, 1791 tests), `npm run lint` (exit 0, 0 errors), `npm run typecheck` (exit 0), `grep -c "payment.intent_failed"` matches both `app/api/webhooks/stripe/route.ts` and `lib/observability/telemetry.ts`.

---
*Phase: 02-observability-and-regression-guards*
*Completed: 2026-09-02*
