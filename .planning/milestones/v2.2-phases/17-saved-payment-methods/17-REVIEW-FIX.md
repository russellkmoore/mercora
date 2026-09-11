---
phase: 17-saved-payment-methods
fixed_at: 2026-09-11T10:56:00Z
review_path: .planning/phases/17-saved-payment-methods/17-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-09-11T10:56:00Z
**Source review:** .planning/phases/17-saved-payment-methods/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (4 Warning, 2 Info)
- Fixed: 6
- Skipped: 0

Worktree isolation was skipped for this run — `workflow.use_worktrees` is `false` in
`.planning/config.json`, so every fix was made and committed directly on `main` in the
main checkout (the documented opt-out path). All gates below ran in the main checkout too;
the numbers are reproducible from this tree as-is.

## Fixed Issues

### WR-01: DELETE route's status code leaked whether an unowned payment-method id actually exists

**Files modified:** `app/api/account/payment-methods/[id]/route.ts`, `tests/unit/app/api/account-payment-methods.test.ts`
**Commit:** `ad7b881`
**Applied fix:** Added a duck-typed `isResourceMissingError()` check (matching the codebase's
existing `isMissingStripePrice` convention in `lib/subscriptions/plan-price-adapter.ts` —
checks `type === "StripeInvalidRequestError"` and `code`/`raw.code === "resource_missing"`
rather than `instanceof Stripe.errors.StripeInvalidRequestError`, so a plain rejected `Error`
in a unit test is unaffected). When `stripe.paymentMethods.retrieve(id)` throws
`resource_missing`, the route now returns the same 404 `denial()` as an ownership mismatch,
closing the status-code side channel. Renamed the pre-existing generic-error test to clarify
it covers a *non-Stripe* error, and added two new tests: one for `resource_missing` at
`error.code`, one at `error.raw.code`, both asserting 404 and that `detach` is never called.

### WR-02: The D1 "race" test proved sequential idempotency, not a genuine concurrent race

**Files modified:** `tests/integration/payment-customer-binding.test.ts`
**Commit:** `7242f57`
**Applied fix:** Kept the original sequential test (renamed to make clear it proves re-bind
idempotency, not concurrency) and added a new test that races two genuinely concurrent
`bindPaymentCustomer` calls for the same shopper via `Promise.all` — the same real-D1-concurrency
pattern already established in this codebase (`tests/integration/lib/subscriptions/repository.test.ts:128`,
`tests/integration/d1-harness.test.ts:180`). D1's `cloudflare:test` harness produces genuine
overlapping statements under `Promise.all` (confirmed by both cited precedents), so no
alternative simulation approach was needed. The new test asserts exactly one call's row wins
under `INSERT OR IGNORE` and the two results are self-consistent with whichever id actually
landed in the row.

### WR-03: A signed-in, zero-cash (gift-card-only) checkout still created a real Stripe Customer with PII

**Files modified:** `app/api/payment-intent/route.ts`, `tests/unit/app/api/payment-intent-authority.test.ts`
**Commit:** `971db2a`
**Applied fix:** Gated the `ensureStripeCustomerForShopper` call on the same
`total.gt(Money.zero(total.currency))` condition already used for the PaymentIntent/Customer
Session branch below it, per the REVIEW's stated default ("nothing about a zero-cash order
needs a Stripe customer"). A signed-in shopper whose order is entirely covered by a gift card
no longer causes `stripe.customers.create` to run.

### WR-04: `GET /api/account/payment-methods` had no `limit`/pagination, silently truncating past 10 saved cards

**Files modified:** `app/api/account/payment-methods/route.ts`, `tests/unit/app/api/account-payment-methods.test.ts`
**Commit:** `ae5512b`
**Applied fix:** Added `limit: 100` to `stripe.paymentMethods.list(...)` — Stripe's own list-API
ceiling, and the minimum-bound option the REVIEW offered, matching this codebase's existing
`limit: 100` convention (`app/api/webhooks/stripe/handlers/refund-handlers.ts`). Documented the
cap in a code comment rather than adding full auto-pagination: this is a shopper's own saved-card
list (self-service, not an admin queue), and a full `autoPagingEach`/`starting_after` loop would
have required rebuilding the route's Stripe-client test mock to support cursor pagination for a
scenario (>100 saved cards by one shopper) this store does not need to handle.

### IN-01: Zero-cash-branch Stripe-customer side effect wasn't covered by any test

**Files modified:** `tests/unit/app/api/payment-intent-authority.test.ts`
**Commit:** `971db2a` (same commit as WR-03 — the test and the fix it pins are inseparable)
**Applied fix:** Added `expect(mocks.ensureStripeCustomerForShopper).not.toHaveBeenCalled()` to
the existing zero-cash test, pinning the corrected (post-WR-03) behavior so a future change can't
silently reintroduce Stripe-customer creation on a $0 order without a test failing.

### IN-02: `PaymentMethodList`'s busy state disabled every row's Remove button, not just the one being removed

**Files modified:** `components/account/PaymentMethodList.tsx`
**Commit:** `a8da99b`
**Applied fix:** Replaced the single `busy: boolean` with `busyIds: Set<string>`, disabling only
the Remove button for the row actually being deleted. The same state also still guards against a
double-submit on that same row (`remove()` early-returns if `busyIds.has(method.id)`); rows other
than the one in flight remain interactive, matching the REVIEW's suggested fix.

## Skipped Issues

None — all six in-scope findings were fixed.

## Gates

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 54 warnings (all pre-existing, none in touched files) |
| `npm run typecheck` | clean |
| `mise exec -- npm test` | 322 files / 2921 tests passed |
| `mise exec -- npm run test:workers` | 33 files / 254 tests passed |

No card number, PAN, CVC, fingerprint, or Stripe secret key was written into any diff, test
fixture, or this report.

---

_Fixed: 2026-09-11T10:56:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
