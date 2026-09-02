---
phase: 02-observability-and-regression-guards
reviewed: 2026-09-02T13:10:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - app/api/analytics/vitals/route.ts
  - app/api/webhooks/stripe/handlers/decline-reason.ts
  - app/api/webhooks/stripe/route.ts
  - app/category/[slug]/page.tsx
  - app/product/[slug]/page.tsx
  - cloudflare-env.d.ts
  - docs/mobile-lighthouse-baseline.md
  - lib/observability/route-template.ts
  - lib/observability/telemetry.ts
  - lib/services/checkout-pricing.ts
  - tests/unit/app/api/stripe-webhook-payment-failed.test.ts
  - tests/unit/app/api/vitals-route.test.ts
  - tests/unit/app/category-slug-page.test.ts
  - tests/unit/app/product-slug-page.test.ts
  - tests/unit/lib/observability/route-template.test.ts
  - tests/unit/lib/services/checkout-allocation.test.ts
  - tests/unit/lib/services/checkout-pricing.test.ts
  - workers/observability-tail/src/core.ts
  - wrangler.jsonc
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-02T13:10:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the diff since `a55e976` against full file context for the web-vitals
Analytics Engine sink, the `checkout.tax_fallback` / `payment.intent_failed`
telemetry additions, the telemetry-only `handlePaymentFailed`, the
Promise-typed slug params, the newly-exported checkout allocation functions
(with their new table tests), and the Lighthouse baseline doc.

The unauthenticated vitals endpoint is well-bounded: metric name, rating,
route-template bucket, and boolean-mobile flag are all drawn from small,
fixed enumerations before being written to Analytics Engine, and the beacon's
raw `url`/`userAgent`/`id`/`timestamp` fields are never persisted — confirmed
by the new test suite and by inspection. The `reason` enum addition is
byte-parallel between `lib/observability/telemetry.ts` and
`workers/observability-tail/src/core.ts` (both diffs are identical, and the
existing `observability-tail-core.test.ts` parity test still passes).
`handlePaymentFailed` performs no order/inventory/email writes and is
replay-safe (verified against the new webhook test, including a
replay-three-times assertion). The category/product page Promise-param
change is a pure typing/notFound cleanup and does not alter behavior for
valid slugs.

However, tracing the newly-*exported* `allocateDiscount` function (exported
in this phase specifically so it could be table-tested) turned up a real,
reproducible per-line over-allocation bug that the new tests do not catch
because they only assert sum-exactness, not per-line capacity. See CR-01.

All 146 tests across the files reviewed here pass (`mise exec -- npx vitest
run` against the listed test files), and the pre-existing
`observability-tail-core.test.ts` enum-parity test also passes.

## Critical Issues

### CR-01: `allocateDiscount` can assign a line more discount than the line is worth

**File:** `lib/services/checkout-pricing.ts:253-281`

**Issue:** In `allocateDiscount`, every eligible line except the *last* one
in iteration order is capped against its own remaining capacity:

```ts
const cents = position === eligible.length - 1
  ? remaining
  : Math.min(
      available[position].toMinorUnits(),
      Math.floor(
        applied.toMinorUnits() * available[position].toMinorUnits() /
        availableTotal.toMinorUnits()
      )
    );
```

The last position instead receives the entire floor-rounding leftover
(`remaining`) with **no cap against `available[position]`**. When the
per-line floor shares for the non-last lines lose more than a few cents to
rounding (which grows with the number of eligible lines, up to
`eligible.length - 1` cents in the worst case), that lost value is dumped
onto the last line even if the last line's own price/available capacity is
smaller than the leftover. The result is `existing[lastIndex]` exceeding
`lineTotals[lastIndex]` — a per-line discount larger than the line's own
price.

Reproduced directly against the exported function (verified interactively,
not committed as a test):

```ts
const lineTotals = [Money.fromMinor(1,'USD'), Money.fromMinor(1,'USD'), Money.fromMinor(1,'USD')];
const existing   = [Money.zero('USD'), Money.zero('USD'), Money.zero('USD')];
allocateDiscount(Money.fromMinor(2, 'USD'), [0, 1, 2], lineTotals, existing);
// existing => [0, 0, 2]  — line index 2 received a 2-cent discount on a 1-cent line.
```

The total (`2`) still matches `applied`, which is exactly what the new
`checkout-allocation.test.ts` suite asserts ("sums exactly to the applied
amount") — so the new table tests pass while this per-line invariant is
silently broken. In `priceCheckout`, this flows into
`netMerchandise: pricedCatalog[index].lineTotal.subtract(discounts.perLine[index])`,
which `Money.subtract` allows to go negative (no floor-at-zero guard). A
negative net-merchandise line then either:
- is sent to Stripe Tax as a negative line `amount` (likely provider-rejected,
  routing into the `catch` fallback), or
- if it reaches the `configured_fallback` tax path, is passed as a negative
  weight into `allocateLargestRemainder`, which explicitly throws
  (`"Tax fallback allocation requires nonnegative integer minor units"`),
  crashing checkout pricing entirely for that customer.

This is realistically reachable with a normal-sized cart: any checkout with
several eligible lines (accessories, small add-ons) under a percentage or
fixed promotion whose amount doesn't divide evenly across all eligible line
prices can dump the accumulated rounding loss onto whichever line happens to
be last in catalog order — worse the more eligible lines there are (up to
`MAX_CHECKOUT_LINES = 100`), and worst when the last eligible line is
cheap.

**Fix:** Cap the last line the same way the others are capped, and
redistribute any leftover that the last line can't absorb to lines with
remaining spare capacity (or switch this function to the same
largest-remainder technique already implemented correctly in
`allocateLargestRemainder` in this same file, using each line's `available`
value as its weight and iterating spare capacity for the actual cent-by-cent
remainder assignment). Minimal patch shape:

```ts
let remaining = applied.toMinorUnits();
const shareOf = (position: number) => Math.min(
  available[position].toMinorUnits(),
  Math.floor(
    applied.toMinorUnits() * available[position].toMinorUnits() /
    availableTotal.toMinorUnits()
  )
);
const shares = eligible.map((_, position) => shareOf(position));
remaining -= shares.reduce((a, b) => a + b, 0);
// Distribute the leftover only into lines with spare capacity, never past it.
for (let i = 0; remaining > 0 && i < eligible.length; i += 1) {
  const room = available[i].toMinorUnits() - shares[i];
  const take = Math.min(room, remaining);
  shares[i] += take;
  remaining -= take;
}
eligible.forEach((index, position) => {
  existing[index] = existing[index].add(Money.fromMinor(shares[position], amount.currency));
});
```
(Any equivalent fix is acceptable as long as no `shares[i]` can exceed
`available[i]`.) Add a regression test asserting
`existing[i].toMinorUnits() <= lineTotals[i].toMinorUnits()` (or
`<= available[i]` pre-mutation) for every line across the existing weight
tables — the current suite never checks this invariant.

## Warnings

### WR-01: Vitals endpoint has no request body size cap

**File:** `app/api/analytics/vitals/route.ts:35-42`

**Issue:** `POST` calls `await request.json()` directly with no
`content-length` check and no bounded-reader pattern, even though this route
is unauthenticated by design (a public `sendBeacon`/`fetch` target) and the
same PR adds exactly this kind of guard to
`app/api/webhooks/stripe/route.ts` (`readBoundedRawBody`,
`MAX_STRIPE_WEBHOOK_BODY_BYTES = 1_048_576`). Field-level validation (metric
name/value/rating enums) happens only *after* the full body has been
buffered and JSON-parsed, so an attacker can send arbitrarily large POST
bodies to this public endpoint at no authentication cost, forcing the worker
to buffer/parse the whole payload before anything is rejected.

**Fix:** Reuse the same bounded-body pattern already established in the
Stripe webhook route (check `content-length` up front, cap total bytes read,
e.g. a few KB is plenty for a five-field vitals beacon) before calling
`.json()`.

### WR-02: `mapDeclineReason` likely under-detects `expired_card` / `authentication_required` in real Stripe data

**File:** `app/api/webhooks/stripe/handlers/decline-reason.ts:52-61`

**Issue:** `CODE_TO_REASON` maps `code === 'expired_card'` and
`code === 'authentication_required'` directly, but the refinement step for
the generic `code === 'card_declined'` case only special-cases
`decline_code === 'insufficient_funds'`:

```ts
if (code === 'card_declined') {
  return record.decline_code === 'insufficient_funds' ? 'insufficient_funds' : 'card_declined';
}
```

In Stripe's actual error shape, when an issuer declines a card the `code` is
almost always the generic `card_declined`, and the *specific* reason
(`expired_card`, `authentication_required`, `stolen_card`, etc.) is carried
in `decline_code`, not `code`. As written, most real expired-card and
3DS-required declines will fall through to the generic `'card_declined'`
bucket instead of their more specific reason, even though
`ALLOWED_FIELD_ENUMS.reason` and `CODE_TO_REASON` both already define
`expired_card` and `authentication_required` as first-class values. The
`expired_card`/`authentication_required` branches of `CODE_TO_REASON`
mostly only fire for the (rarer) case where Stripe rejects the card before
even reaching the issuer.

**Fix:** Extend the `card_declined` refinement to check `decline_code`
against `expired_card` and `authentication_required` the same way it
already does for `insufficient_funds`, e.g.:

```ts
if (code === 'card_declined') {
  const declineCode = record.decline_code;
  if (declineCode === 'insufficient_funds') return 'insufficient_funds';
  if (declineCode === 'expired_card') return 'expired_card';
  if (declineCode === 'authentication_required') return 'authentication_required';
  return 'card_declined';
}
```

### WR-03: Dead catch branch in `handlePaymentFailed`

**File:** `app/api/webhooks/stripe/route.ts:347-360`

**Issue:**

```ts
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    recordTelemetry('payment.intent_failed', { ... });
  } catch (error) {
    recordTelemetry('webhook.processing_failed', { ... }, error);
  }
}
```

`recordTelemetry` (`lib/observability/telemetry.ts:312-341`) wraps its
entire body in a top-level `try { ... } catch { /* fail open */ }` and
documents itself as always failing open; it cannot throw. `mapDeclineReason`
is likewise documented as "Total over all inputs — never throws." This means
the `catch` branch here is unreachable in the current codebase, and the
function has no test coverage of that branch (understandably, since nothing
can trigger it).

**Fix:** Either remove the try/catch (relying on `recordTelemetry`'s
documented fail-open contract, matching how `mapDeclineReason` is called
elsewhere without a wrapper), or add a code comment noting this is
deliberate defense-in-depth against a future change to `recordTelemetry`'s
contract. Not a functional bug today, but the dead branch adds
untestable/unreachable code.

## Info

### IN-01: Inconsistent `notFound()` call style between the two updated pages

**File:** `app/category/[slug]/page.tsx:62-64`

**Issue:** The category page calls `notFound();` without `return`:

```ts
if (!category) {
  notFound();
}
```

while the product page updated in the same diff uses the safer explicit
form:

```ts
if (!storedProduct || storedProduct.status !== "active") return notFound();
```

Functionally equivalent today (`notFound()` throws), but relying on that
implicitly is fragile if code is ever added beneath the `if` block later, or
in a test double that doesn't throw.

**Fix:** `if (!category) { return notFound(); }` for consistency with the
sibling file changed in this same PR.

---

_Reviewed: 2026-09-02T13:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
