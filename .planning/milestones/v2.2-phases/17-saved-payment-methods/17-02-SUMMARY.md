---
phase: 17-saved-payment-methods
plan: 02
subsystem: payments
tags: [stripe, customer-session, checkout, telemetry, tracer]

requires:
  - phase: 17-saved-payment-methods
    provides: "17-01: payment_customers table and lib/payments/customer-binding.ts (ensureStripeCustomerForShopper, findStripeCustomerId)"
provides:
  - "app/api/payment-intent/route.ts binds a signed-in shopper's PaymentIntent to their Stripe customer and returns a Customer Session client secret"
  - "customerSessionClientSecret field in the /api/payment-intent response, the only field plan 17-03's client consumes"
  - "payment.customer_binding_failed and payment.customer_session_failed telemetry events (warning severity)"
affects: [17-03, saved-payment-methods, checkout]

actuals:
  tokens: 4500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Best-effort secondary Stripe call in its own try/catch, degrading to the pre-existing behavior on failure rather than turning a working checkout into a 503"

key-files:
  created: []
  modified:
    - app/api/payment-intent/route.ts
    - lib/observability/telemetry.ts
    - tests/unit/app/api/payment-intent-authority.test.ts

key-decisions:
  - "Customer Session's payment_method_remove feature is 'disabled' per the locked D-06 value, not the 'enabled' shown in 17-RESEARCH.md's sample code — removal lives on the account page (D-10), not inside checkout."
  - "The Stripe customer binding call and the createPaymentIntent/Customer Session amendments both live strictly inside `if (userId)` gates, so a guest checkout never calls ensureStripeCustomerForShopper or customerSessions.create (D-07, Pitfall 3)."
  - "No setup_future_usage field was added to createPaymentIntent's params; the Customer Session's payment_method_save_usage: 'off_session' is the only place save-for-later is configured (D-06a, Pitfall 1)."

requirements-completed: [PAY-01, PAY-03]

coverage:
  - id: D1
    description: "A signed-in shopper's PaymentIntent is created against their own Stripe customer, with a Customer Session client secret returned in the same response"
    requirement: PAY-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#binds a signed-in shopper's PaymentIntent to their Stripe customer and returns a Customer Session secret"
        status: pass
    human_judgment: false
  - id: D2
    description: "Guest checkout is byte-for-byte unchanged: no binding lookup, no Customer Session, no extra response field"
    requirement: PAY-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#leaves a guest checkout completely unaffected (D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stripe-customer binding failure and Customer Session failure both degrade to a usable, customer-less PaymentIntent instead of a 503"
    requirement: PAY-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#falls through to a customer-less PaymentIntent when the Stripe customer binding fails (D-04)"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#falls through to a plain PaymentIntent when the Customer Session call fails"
        status: pass
    human_judgment: false
  - id: D4
    description: "No save-for-later parameter is ever sent at PaymentIntent creation; the Customer Session drives it instead"
    requirement: PAY-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#sends no save-for-later parameter at PaymentIntent creation for a signed-in shopper (D-06a)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The zero-cash gift-card branch takes no PaymentIntent and no Customer Session, and no telemetry call ever carries a client secret"
    requirement: PAY-03
    verification:
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#takes no PaymentIntent and no Customer Session for a signed-in zero-cash gift-card checkout (D-05)"
        status: pass
      - kind: unit
        ref: "tests/unit/app/api/payment-intent-authority.test.ts#never lets a recorded telemetry call carry either client secret"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-11
status: complete
---

# Phase 17 Plan 02: Checkout Server Wiring Summary

**`app/api/payment-intent/route.ts` binds a signed-in shopper to a Stripe Customer, creates the PaymentIntent against it, and returns a Customer Session client secret in the same response — with two new warning-severity telemetry events and every guest/failure path proven unchanged.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-11T10:07:00Z (approx.)
- **Completed:** 2026-09-11T10:31:22Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- After the existing `getCustomer`/`createCustomer` block, `app/api/payment-intent/route.ts` now calls `ensureStripeCustomerForShopper` inside its own `if (userId)`/try-catch, never turning checkout into a 503 on failure (D-04).
- `createPaymentIntent` receives `customer: stripeCustomerId` only when a binding was obtained; the parameter object carries no save-for-later field (D-05, D-06a).
- A Customer Session is created immediately after the provider-amount validation block, guarded by `userId && stripeCustomerId && paymentIntent`, with features `payment_method_save: 'enabled'`, `payment_method_redisplay: 'enabled'`, `payment_method_remove: 'disabled'`, `payment_method_save_usage: 'off_session'` — matching the locked D-06 value rather than 17-RESEARCH.md's sample.
- `customerSessionClientSecret` is added to the cash-branch JSON response only when the session succeeded; the zero-cash gift-card response and guest responses never carry it.
- Two new telemetry events, `payment.customer_binding_failed` and `payment.customer_session_failed`, registered at `{ severity: 'warning', sampleRate: 1 }` — proven not to require any tail-worker critical-list change.
- Seven new tests cover the signed-in happy path, guest isolation, both best-effort failure paths, the D-06a save-for-later assertion, the zero-cash gift-card regression, and telemetry-secret redaction.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end signed-in PaymentIntent → Stripe customer binding (tracer)** - `2072aa8` (feat)
2. **Task 2: Guest, binding-failure, and Customer-Session-failure cases** - `c1fc209` (test)
3. **Task 3: Zero-cash regression and telemetry redaction proof, full suite/lint/typecheck** - `0673ee9` (test)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `app/api/payment-intent/route.ts` - Stripe customer binding call, `customer` param on `createPaymentIntent`, Customer Session creation, `customerSessionClientSecret` on the cash-branch response
- `lib/observability/telemetry.ts` - `payment.customer_binding_failed`, `payment.customer_session_failed` (warning severity)
- `tests/unit/app/api/payment-intent-authority.test.ts` - 7 new tests: signed-in happy path, D-06a assertion, guest-unaffected, binding-failure-falls-through, Customer-Session-failure-falls-through, zero-cash regression, telemetry-secret redaction

## Decisions Made

- `payment_method_remove: 'disabled'` used per the locked D-06 decision, correcting 17-RESEARCH.md's sample code which showed `'enabled'`.
- `ensureStripeCustomerForShopper` and `customerSessions.create` are both called only inside `if (userId)` gates that additionally require a resolved `stripeCustomerId`/`paymentIntent`, so a guest checkout structurally cannot reach either call (not merely response-filtered).
- Test file mocks: `ensureStripeCustomerForShopper` mocked via `@/lib/payments/customer-binding`; `getStripeClient` mocked inline in the existing `@/lib/stripe` mock to expose a fake `customerSessions.create`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `mise exec -- npm test` reports 9 failing tests, all in `tests/unit/app/api/account-payment-methods.test.ts`, which is plan 17-04's file being executed concurrently in the same (non-worktree) checkout per the parallel-execution contract in this plan's prompt. Those failures are `Error: not implemented` from 17-04's DELETE route, mid-TDD at the time this plan finished — not caused by any change in this plan. Confirmed by running `mise exec -- npx vitest run --exclude "**/account-payment-methods.test.ts"`: 318 files / 2888 tests pass (2881 baseline from 17-01-SUMMARY.md + 7 new tests added here). `npm run lint` reports 0 errors (54 pre-existing warnings, same count as 17-01's baseline). `npm run typecheck` reports errors only inside `tests/unit/app/api/account-payment-methods.test.ts` (17-04's file); zero errors in any file this plan touched.
- Because this plan and 17-04 share one checkout (no worktrees, `.planning/config.json` has `use_worktrees: false`), `git rev-list --count <ledger-base>..HEAD` measures 4 commits, not this plan's 3 — it includes 17-04's interleaved `test(17-04): add failing tests for DELETE payment-method ownership check` (`d9a29af`) landed between this plan's Task 2 and Task 3 commits. The `commits: 3` in this SUMMARY's frontmatter is this plan's own commit count (`2072aa8`, `c1fc209`, `0673ee9`), measured by hash rather than by the shared-history range, since the ledger's single-owner-checkout assumption doesn't hold under same-checkout parallel execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `customerSessionClientSecret` is live on the wire, ready for plan 17-03's client-side `StripeProvider.tsx`/Payment Element wiring to consume verbatim per the interface contract.
- Two new warning-severity telemetry events exist; no tail-worker or dashboard change is required for them.
- No blockers. Plan 17-04 (account payment-methods routes) is running concurrently in the same checkout and does not depend on anything this plan produced.

---
*Phase: 17-saved-payment-methods*
*Completed: 2026-09-11*

## Self-Check: PASSED

- FOUND: app/api/payment-intent/route.ts
- FOUND: lib/observability/telemetry.ts
- FOUND: tests/unit/app/api/payment-intent-authority.test.ts
- FOUND: .planning/phases/17-saved-payment-methods/17-02-SUMMARY.md
- FOUND: 2072aa8 (git log)
- FOUND: c1fc209 (git log)
- FOUND: 0673ee9 (git log)
- `mise exec -- npx vitest run tests/unit/app/api/payment-intent-authority.test.ts` - 22/22 passed
- `mise exec -- npx vitest run --exclude "**/account-payment-methods.test.ts"` - 318 files / 2888 tests passed
- `mise exec -- npm run lint` - 0 errors (54 pre-existing, unrelated warnings)
- `mise exec -- npm run typecheck` - clean for every file this plan touched (errors present only in plan 17-04's concurrent, in-progress test file)
