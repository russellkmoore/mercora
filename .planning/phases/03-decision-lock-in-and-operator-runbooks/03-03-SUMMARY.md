---
phase: 03-decision-lock-in-and-operator-runbooks
plan: 03
subsystem: payments
tags: [stripe, webhooks, dead-code-removal, vitest]

# Dependency graph
requires:
  - phase: 03-decision-lock-in-and-operator-runbooks
    provides: "Plan 02's corrected runbooks (docs/DEPLOYMENT_SETUP.md, docs/STRIPE_INTEGRATION.md) already list the trimmed Stripe event set without checkout.session.completed"
provides:
  - "app/api/webhooks/stripe/route.ts dispatch switch with no case for checkout.session.completed"
  - "A pinned regression contract for what any unhandled Stripe event type does: HTTP 200, ledger outcome 'ignored', event still claimed, no finalizer call"
affects: [stripe-webhook-route, payments, runbook-verification]

# Actuals (#2632)
actuals:
  tokens: 6000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Characterization test pattern for webhook fall-through: copy the existing signature-test mock scaffolding (vi.hoisted mocks + vi.mock of @/lib/stripe, @/lib/services/order-finalization, @/lib/webhooks/processed-events) and assert against the default branch's contract rather than a removed handler's."

key-files:
  created:
    - tests/unit/app/api/stripe-webhook-unhandled-events.test.ts
  modified:
    - app/api/webhooks/stripe/route.ts

key-decisions:
  - "Removed the checkout.session.completed case, its header doc bullet, and the handleCheckoutCompleted function in a single tracer-task commit so the file stayed internally consistent at every commit boundary."
  - "The new test is explicitly a characterization test (documented in a file-header comment), not a red-first TDD test, since it pins behavior the default branch already provides rather than driving new implementation."

patterns-established:
  - "Dead-code removal in the webhook dispatch switch is verified by: (1) grep counts for the removed symbol going to zero, (2) a git diff --numstat check proving deletions only, (3) the full existing test suite for that route passing unmodified."

requirements-completed: [RUN-02]

coverage:
  - id: D1
    description: "app/api/webhooks/stripe/route.ts no longer references the checkout.session.completed event anywhere - header doc, dispatch switch, or handler function"
    requirement: RUN-02
    verification:
      - kind: other
        ref: "grep -c 'checkout.session.completed' app/api/webhooks/stripe/route.ts == 0"
        status: pass
      - kind: other
        ref: "grep -c 'handleCheckoutCompleted' app/api/webhooks/stripe/route.ts == 0"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-signature.test.ts + 5 sibling webhook test files (61 tests) pass unmodified"
        status: pass
    human_judgment: false
  - id: D2
    description: "payment_intent.payment_failed and every other dispatch case are unchanged; the diff to route.ts is deletions only"
    requirement: RUN-02
    verification:
      - kind: other
        ref: "grep -c \"case 'payment_intent.payment_failed':\" app/api/webhooks/stripe/route.ts == 1"
        status: pass
      - kind: other
        ref: "git diff --numstat app/api/webhooks/stripe/route.ts == 0 insertions, 29 deletions"
        status: pass
    human_judgment: false
  - id: D3
    description: "A regression test pins the unhandled-event contract: HTTP 200, ledger outcome 'ignored', event still claimed, no finalizer call"
    requirement: RUN-02
    verification:
      - kind: unit
        ref: "tests/unit/app/api/stripe-webhook-unhandled-events.test.ts (4 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full repository gates are green after the removal: lint, typecheck, and the entire test suite"
    verification:
      - kind: other
        ref: "npm run lint (0 errors, 52 pre-existing unrelated warnings)"
        status: pass
      - kind: other
        ref: "npm run typecheck (clean)"
        status: pass
      - kind: unit
        ref: "npm test (242 files, 1868 tests, all pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-02
status: complete
---

# Phase 3 Plan 3: Remove Dead Checkout-Session Webhook Branch Summary

**Deleted the checkout.session.completed dispatch case, its comments-only handler, and its header doc bullet from the Stripe webhook route (29 lines, deletions only), then pinned the unhandled-event fall-through contract with a new 4-assertion regression test.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-02T15:07:00Z
- **Completed:** 2026-09-02T22:09:37Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `app/api/webhooks/stripe/route.ts` no longer has a case, handler, or header-doc reference for `checkout.session.completed` — exactly 29 lines removed (the case block, its separating blank line, the `handleCheckoutCompleted` function with its JSDoc, and one header bullet), zero lines inserted. The `payment_intent.payment_failed` case and every other case in the switch (subscriptions, `charge.refunded`, refund lifecycle, `default`) are byte-identical to before.
- New file `tests/unit/app/api/stripe-webhook-unhandled-events.test.ts` pins the contract an unhandled Stripe event type gets today: HTTP 200, `completeWebhookEvent` called with `outcome: 'ignored'`, `claimWebhookEvent` still called (idempotency ledger not skipped), and `finalizeOrderPayment` never called. It uses `checkout.session.completed` as the example event and documents in a header comment that it is a characterization test of existing `default`-branch behavior, not a test of removed code.
- `npm run lint`, `npm run typecheck`, and `npm test` (242 test files, 1868 tests) are all green after the removal — nothing was orphaned by deleting the case or the function.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the dead checkout-session branch end to end** - `0852c93` (feat)
2. **Task 2: Pin the unhandled-event contract with a regression test, then run the full gates** - `7b84825` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `app/api/webhooks/stripe/route.ts` - removed the `checkout.session.completed` case, `handleCheckoutCompleted` function, and its header-doc bullet (0 insertions, 29 deletions)
- `tests/unit/app/api/stripe-webhook-unhandled-events.test.ts` - new file, 4 tests pinning the unhandled-event fall-through contract

## Decisions Made

- Removed the case, handler, and header bullet together in one tracer-task commit rather than across separate commits, so the file was internally consistent (no dangling reference to the removed event anywhere) at every commit boundary — this is what let the file-wide `grep -c` gates run cleanly right after Task 1.
- Wrote Task 2's test as an explicit characterization test (documented via a header comment) rather than following red-first TDD, because it pins behavior the `default` branch already provides — there was no new implementation to drive with a failing test.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All acceptance criteria and the plan-level `<verification>` block passed on the first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

RUN-02's code half is complete: the dispatch switch matches the event lists Plan 02 already wrote into `docs/DEPLOYMENT_SETUP.md` and `docs/STRIPE_INTEGRATION.md` (no `checkout.session.completed`), and the regression test guards against the case being re-added silently. This was the last plan in Phase 3 — phase verification (`/gsd-verify-work`) can now run against all three plans (ADR locks, runbook corrections, and this dead-code removal).

---
*Phase: 03-decision-lock-in-and-operator-runbooks*
*Completed: 2026-09-02*
