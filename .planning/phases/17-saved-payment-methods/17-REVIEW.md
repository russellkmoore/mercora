---
phase: 17-saved-payment-methods
reviewed: 2026-09-11T10:48:31Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - app/account/payment-methods/page.tsx
  - app/api/account/payment-methods/[id]/route.ts
  - app/api/account/payment-methods/route.ts
  - app/api/payment-intent/route.ts
  - components/account/AccountNav.tsx
  - components/account/PaymentMethodList.tsx
  - components/checkout/CheckoutClient.tsx
  - components/checkout/PaymentForm.tsx
  - components/checkout/StripeProvider.tsx
  - lib/db/schema/index.ts
  - lib/db/schema/payments.ts
  - lib/observability/telemetry.ts
  - lib/payments/customer-binding.ts
  - migrations/0025_add_payment_customers.sql
  - tests/integration/d1-harness.test.ts
  - tests/integration/payment-customer-binding.test.ts
  - tests/integration/payment-customers-migration.test.ts
  - tests/unit/app/account-security-source.test.ts
  - tests/unit/app/api/account-payment-methods.test.ts
  - tests/unit/app/api/payment-intent-authority.test.ts
  - tests/unit/components/account/account-payment-methods-navigation.test.ts
  - tests/unit/components/checkout-gift-card-field-source.test.ts
  - tests/unit/components/checkout/checkout-client-customer-session-source.test.ts
  - tests/unit/components/checkout/stripe-provider-customer-session.test.ts
  - tests/unit/components/payment-form-link-source.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-09-11T10:48:31Z
**Depth:** deep
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This is a careful, well-tested implementation. I traced the full money path (`ensureStripeCustomer`'s
find-or-create/conflict algorithm, `app/api/payment-intent/route.ts`'s try/catch chain, the zero-cash
gift-card branch) and the full authorization path (`DELETE /api/account/payment-methods/[id]`'s
retrieve-then-compare check) line by line against the actual source, not just the plan summaries.

What holds up:
- `setup_future_usage` never appears outside a comment; `payment_method_remove: 'disabled'` is the
  literal value everywhere; `customer: stripeCustomerId` is spread into `createPaymentIntent` only
  when truthy.
- `ensureStripeCustomerForShopper` and `stripe.customerSessions.create` are both called only inside
  `if (userId)` gates; a guest checkout structurally cannot reach either call, and both failure paths
  degrade to a plain, customer-less PaymentIntent (200 OK) rather than a 503 — verified against the
  real try/catch, not just its presence.
- The DELETE route's retrieve-then-compare ownership check runs before `detach`, and every ownership
  mismatch returns 404 — confirmed by both the unit tests and a source-contract test that pins
  `retrieve` appearing before `detach` in the file text.
- No card number, PAN, CVC, fingerprint, or Stripe secret key appears anywhere in the diff (including
  telemetry payloads, which pass through a hard allowlist that strips everything but an `error_class`
  string).
- The three "git index sweep" incidents documented in 17-03-SUMMARY.md and 17-05-SUMMARY.md are
  confirmed cosmetic: `git show --stat` on the three final commits (`a2b82df`, `fe63abc`, `52a41f6`)
  shows each contains exactly the files its own plan's `files_modified` declares — no cross-plan file
  ever reached a shared commit.
- Guest safety holds end-to-end: the server never returns `customerSessionClientSecret` for a guest,
  the client never sets a truthy value for it, and `StripeProvider` only spreads the key into `Elements`
  options when supplied — verified at all three layers with passing tests.
- Smoke tests, `npm run typecheck`, and the two D1 integration tests all pass clean.

Four warnings below are worth fixing before this ships to production traffic; none of them are money-
incorrect or exploitable without already possessing privileged knowledge, but two of them are real
correctness gaps (not just style) that the phase's own summaries claim are covered when they aren't
quite.

## Warnings

### WR-01: DELETE route's status code leaks whether an unowned payment-method id actually exists

**File:** `app/api/account/payment-methods/[id]/route.ts:22-37`
**Issue:** The route's own contract test (`tests/unit/app/api/account-payment-methods.test.ts`, "returns
403 on a cross-origin request..." block) and 17-04-SUMMARY.md both claim "every mismatch — no binding,
wrong customer, missing/over-long id — returns the identical 404." That's true for the three cases
that are checked explicitly (missing binding, length bound, wrong owner), but a fourth case isn't: when
`stripe.paymentMethods.retrieve(id)` throws (id is malformed, or a syntactically valid but nonexistent
`pm_` id), the generic `catch` block at line 32 returns **503**, not 404. A caller can therefore
distinguish "this id exists at Stripe (for someone else)" (404) from "this id doesn't exist at all"
(503) — the opposite of the stated "don't confirm existence" goal. Exploitability is low (Stripe
payment-method ids are unguessable random tokens), but the status codes don't match the documented
security property, and the same test file that's cited as proof of the 404-only contract
(`account-payment-methods.test.ts`, "returns 503 without leaking the caught error when retrieve
throws") actually demonstrates the discrepancy itself.
**Fix:** Either map a Stripe "resource_missing" error to the same `denial()` 404 explicitly, or accept
and document that a not-found id and a malformed id both return 503 while only a *found-but-foreign* id
returns 404 — but don't describe the current behavior as "every mismatch returns 404."
```ts
try {
  const paymentMethod = await stripe.paymentMethods.retrieve(id);
  ...
} catch (error) {
  if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
    return denial(); // matches the "don't leak existence" contract
  }
  return NextResponse.json({ error: "The payment method could not be removed right now" }, { status: 503 });
}
```

### WR-02: The D1 "race" test proves sequential idempotency, not a genuine concurrent race

**File:** `tests/integration/payment-customer-binding.test.ts:47-79`
**Issue:** 17-01-SUMMARY.md's coverage table (D3) and this file's own describe block advertise "Real-D1
integration proof that two concurrent binds for the same shopper converge on one Stripe customer id."
Both tests in the file call `await repository.bindPaymentCustomer(...)` twice **sequentially** (the
second `await` only starts after the first has fully resolved) — there is no `Promise.all`, no
overlapping in-flight request, nothing that exercises a genuine race between two simultaneous writers.
What's actually proven is that the `UNIQUE`/`INSERT OR IGNORE` SQL shape is idempotent across repeated
calls, which is a real and useful property, but it is not proof of atomicity under concurrent access —
the stated verification claim overstates what the test does.
**Fix:** Either soften the claim in the SUMMARY/docstring to "idempotent re-bind, not concurrent race,"
or add a true concurrency case using `Promise.all([repository.bindPaymentCustomer(a), repository.bindPaymentCustomer(b)])`
so the test actually exercises two in-flight writers against the same row.

### WR-03: A signed-in, zero-cash (gift-card-only) checkout still creates a real Stripe Customer with PII

**File:** `app/api/payment-intent/route.ts:244-258`
**Issue:** The Stripe-customer binding call (`ensureStripeCustomerForShopper`) sits before the
`total.gt(Money.zero(...))` branch and runs for every signed-in checkout regardless of whether a
PaymentIntent (and therefore a card form) is ever created. A shopper whose very first checkout is a
$0, gift-card-only order will have `stripe.customers.create({ metadata, email, name })` called on
their behalf even though they never see a card field, never get a Customer Session, and have no
opportunity to save a card in that transaction. This creates a real, billable Stripe resource carrying
the shopper's email/name with zero corresponding benefit, and it happens silently — no test in this
phase asserts on `stripe.customers.create` being called (or not) for the zero-cash path, only that
`createPaymentIntent`/`customerSessions.create` are skipped.
**Fix:** Gate the binding call on `total.gt(Money.zero(...))` the same way the PaymentIntent/Customer
Session creation already is, or explicitly accept this as intended (a shopper who later returns to buy
something with cash already has a bound customer) and add a test that pins the current behavior so a
future change doesn't silently flip it.

### WR-04: `GET /api/account/payment-methods` has no `limit`/pagination, silently truncating past 10 saved cards

**File:** `app/api/account/payment-methods/route.ts:22-25`
**Issue:** `stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card" })` is called with no
`limit` and no pagination loop. Stripe's default page size for list endpoints is 10. A shopper who
saves more than 10 cards over time will see only the first 10 in Account → Payment methods, with the
rest invisible and unremovable through this UI — silent data loss from the shopper's point of view, not
an error. This codebase already has the convention for handling this correctly elsewhere in the same
diff's neighborhood: `app/api/webhooks/stripe/handlers/refund-handlers.ts` passes `limit: 100` on its
own `stripe.refunds.list` call, and `lib/subscriptions/stripe-provider.ts` uses a `startingAfter`
auto-pagination helper for `invoicePayments.list`. Neither pattern was applied here.
**Fix:** At minimum pass an explicit bound (`limit: 100`); ideally paginate with `for await (const pm of stripe.paymentMethods.list({...}).autoPagingEach(...))` so the count is never silently capped.

## Info

### IN-01: Zero-cash-branch Stripe-customer side effect isn't covered by any test

**File:** `tests/unit/app/api/payment-intent-authority.test.ts:576-592`
**Issue:** The zero-cash test ("takes no PaymentIntent and no Customer Session...") asserts
`createPaymentIntent` and `customerSessionsCreate` are not called, but doesn't assert anything about
`ensureStripeCustomerForShopper`/`stripe.customers.create` in that same scenario — so WR-03's behavior
(a Stripe Customer being created on a $0 order) is currently invisible to the test suite in either
direction.
**Fix:** Add `expect(mocks.ensureStripeCustomerForShopper).toHaveBeenCalled()` (documenting current
behavior) or `.not.toHaveBeenCalled()` (if WR-03 is fixed) to this test so the behavior is pinned
either way.

### IN-02: `PaymentMethodList`'s busy state disables every row's Remove button, not just the one being removed

**File:** `components/account/PaymentMethodList.tsx:87`
**Issue:** `disabled={busy}` is applied identically to every card's Remove button rather than being
scoped to the specific row being deleted. Functionally harmless (prevents a genuine double-submit
race and matches `AddressManager`'s own global-busy convention per the plan), but worth a note since a
shopper removing card A briefly sees card B's Remove button go inert too, which could read as a stall
if there are several cards.
**Fix:** Non-blocking; track the busy id (`busy === method.id`) instead of a single boolean if a
future pass wants per-row feedback.

---

_Reviewed: 2026-09-11T10:48:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
