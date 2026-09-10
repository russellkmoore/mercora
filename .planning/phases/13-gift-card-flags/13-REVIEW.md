---
phase: 13-gift-card-flags
reviewed: 2026-09-10T00:00:00Z
depth: standard
diff_base: ec8942c41aadd206914a30b0f9dd5f3dc8d0e46c
files_reviewed: 49
files_reviewed_list:
  - app/admin/gift-cards/page.tsx
  - app/api/admin/gift-cards/route.ts
  - app/api/gift-cards/balance/route.ts
  - app/api/payment-intent/route.ts
  - app/api/products/route.ts
  - app/category/[slug]/page.tsx
  - app/page.tsx
  - app/product/[slug]/ProductDisplay.tsx
  - app/product/[slug]/page.tsx
  - components/admin/AdminSidebar.tsx
  - components/admin/GiftCardHonorBanner.tsx
  - components/cart/CartItemCard.tsx
  - components/checkout/CheckoutClient.tsx
  - docs/DEPLOYMENT_SETUP.md
  - docs/runtime-configuration.md
  - lib/cms/page-products.ts
  - lib/commerce/capabilities.ts
  - lib/commerce/runtime.ts
  - lib/gift-cards/checkout.ts
  - lib/gift-cards/honor-guard.ts
  - lib/gift-cards/repository.ts
  - lib/gift-cards/visibility.ts
  - lib/mcp/catalog.ts
  - lib/mcp/tools/assess.ts
  - lib/mcp/tools/recommend.ts
  - lib/mcp/tools/search.ts
  - lib/observability/scheduled.ts
  - lib/observability/telemetry.ts
  - lib/recommendations/index.ts
  - lib/services/checkout-pricing.ts
  - workers/observability-tail/src/core.ts
  - tests/integration/lib/gift-cards/honor-guard-cron.test.ts
  - tests/integration/lib/gift-cards/honor-guard.test.ts
  - tests/unit/app/admin-gift-card-gating.test.ts
  - tests/unit/app/api/gift-card-presentation-routes.test.ts
  - tests/unit/app/api/payment-intent-authority.test.ts
  - tests/unit/app/api/products-public.test.ts
  - tests/unit/app/product-slug-page.test.ts
  - tests/unit/components/gift-card-checkout-gating-source.test.ts
  - tests/unit/components/gift-card-unavailable-source.test.ts
  - tests/unit/docs/gift-card-flag-docs.test.ts
  - tests/unit/lib/commerce/capabilities.test.ts
  - tests/unit/lib/commerce/runtime-honor-override.test.ts
  - tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts
  - tests/unit/lib/gift-cards/honor-guard.test.ts
  - tests/unit/lib/gift-cards/listing-call-sites-source.test.ts
  - tests/unit/lib/gift-cards/visibility.test.ts
  - tests/unit/lib/services/checkout-pricing.test.ts
  - tests/unit/worker-cron-routing.test.ts
findings:
  critical: 4
  warning: 12
  info: 0
  total: 16
status: issues_found
---

# Phase 13: Gift-Card Flags — Code Review Report

**Reviewed:** 2026-09-10
**Depth:** standard
**Files Reviewed:** 49 (31 source, 18 test)
**Status:** issues_found

## Summary

The flag semantics, the capability matrix, the `GiftCardSalesDisabledError` path, the cron
`waitUntil` shape, and the telemetry envelope are all correct. The 269 tests in the new suites
pass and none of them are inverted, skipped, or mocking the module under test.

Four defects need fixing before this ships. Three of them are about money: the honor guard cannot
see a reservation that is committed but not yet settled, so it can report "no balances" while an
order is mid-settlement; the guard record it depends on is writable by any admin through the
generic settings API, which the module's own header comment says is impossible; and the checkout
redemption panel is gated on the *configured* honor flag rather than the *effective* one, so the
guard keeps honoring balances the shopper has no way to spend. The fourth is a leak: the storefront
chat assistant returns product cards straight from Vectorize with no visibility filter, so the gift
card still shows up under sell=off and links to a 404 under both-off.

Answers to the seven questions asked are at the end.

## Critical Issues

### CR-01: The honor guard is blind to committed-but-unsettled reservations

**File:** `lib/gift-cards/repository.ts:258-261`, `lib/gift-cards/honor-guard.ts:179`

**Issue:** Commit and settle are two separate steps. `commitReservation`
(`lib/gift-cards/repository.ts:485`) sets `committed_at` at order finalization; `settleReservation`
(`:537`) writes the redemption ledger entry later, from `applyTender` inside the order-effects
drain (`lib/services/order-effects.ts:295`). Between those two steps the money is invisible to both
halves of the guard measurement:

- `availableBalanceExpression` subtracts a committed, unsettled reservation from the card's
  available balance, so `outstanding_minor` reads **0** for that card.
- The open-reservation query filters `committed_at IS NULL`, so `open_reservations` reads **0** too.

`balancesMayExist` therefore returns `false`, `honorIsEffectivelyOn` returns `false`, and the next
capability resolution installs `noOpCommerceCapabilities.giftCards`. Its `applyTender`
(`lib/commerce/capabilities.ts:102-113`) throws `CommerceCapabilityDisabledError` for any nonzero
tender, so the pending `gift_card` order effect fails on every retry, forever. The customer paid
with the card, the ledger is never debited, and the reservation is never released.

The cron also writes a fresh record every five minutes *regardless of the flag*, so the zero
measurement taken while honor was still on is what the runtime reads the instant honor is flipped
off. There is no window in which the operator gets a warning.

**Fix:** Count committed-but-unsettled reservations as outstanding. Either add a third statement to
the batch, or widen the existing one:

```ts
database.prepare(`SELECT COUNT(*) AS open_reservations
  FROM gift_card_reservations reservation
  WHERE reservation.released_at IS NULL
    AND (reservation.committed_at IS NOT NULL OR reservation.expires_at > ?)
    AND NOT EXISTS (
      SELECT 1 FROM gift_card_ledger_entries settlement
      WHERE settlement.reservation_id = reservation.id
        AND settlement.entry_type = 'redemption'
    )`)
  .bind(nowSeconds),
```

That is the same clause `availableBalanceExpression` already uses, which keeps one definition of
"still holding value" in the codebase. Add an integration case in
`tests/integration/lib/gift-cards/honor-guard.test.ts`: commit a reservation, do not settle it,
assert `runGiftCardHonorGuard(db, false, now).honorEffective === true`.

---

### CR-02: Any admin can forge the honor-guard record through `PUT /api/admin/settings`

**File:** `app/api/admin/settings/route.ts:139-170`, `lib/gift-cards/honor-guard.ts:9-12`

**Issue:** The module header states the invariant this phase is built on:

> **Only the five-minute cron writes it.** `writeHonorGuard` exists for the scheduled handler and
> nothing else; no request path writes this record. A request-time writer would let a forged or
> racing measurement switch honoring off while cards still carry money.

That invariant is not enforced. `PUT /api/admin/settings` takes an arbitrary `key` from the request
body and upserts it with no allowlist, no denylist, and no key-shape validation. Any actor holding
plain admin permissions (`checkAdminPermissions`, not `isSuperAdminActor` — the super-admin gate at
`:130` covers only `CUSTOM_JS_ENABLED_SETTING`) can send:

```json
{"updates":[{"key":"gift_cards.honor_guard","category":"gift_cards","data_type":"object",
 "value":{"outstanding_minor":0,"currency":"USD","open_reservations":0,"measured_at":1900000000}}]}
```

`readHonorGuard` reads it straight back, `balancesMayExist` sees a fresh zero, and honoring is off
until the next cron tick overwrites it — long enough to strand redemptions and refunds. Setting
`measured_at` far in the future makes it permanent: `balancesMayExist` deliberately does not treat
a future timestamp as stale (`lib/gift-cards/honor-guard.ts:178`).

`tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts` does not catch this — it only asserts
that no file under `app/` *imports* `writeHonorGuard`. The generic settings writer needs no import.

**Fix:** Reject the guard key in the settings route, next to the existing custom-JS gate:

```ts
import { HONOR_GUARD_SETTING_KEY } from '@/lib/gift-cards/honor-guard';

if (updates.some((u: { key?: unknown }) => u?.key === HONOR_GUARD_SETTING_KEY)) {
  return NextResponse.json(
    { error: 'The gift-card honor guard is written only by the scheduled measurement.' },
    { status: 403 },
  );
}
```

Add a route test that a PUT naming that key returns 403 and leaves the row unchanged.

---

### CR-03: Redemption is gated on the configured honor flag, not the effective one

**File:** `components/checkout/CheckoutClient.tsx:513`, `app/api/gift-cards/balance/route.ts:35`

**Issue:** `CheckoutClient` renders `GiftCardApplyPanel` only when
`commerce.features.giftCardReconciliation` is true. That value comes from
`toPublicStoreConfig(getStoreConfig())`, which reads the raw `STORE_FEATURE_GIFT_CARD_RECONCILIATION`
env var (`lib/store-config.ts:437`). It never sees the honor guard.

So in the exact state the guard exists to protect — honor=off with outstanding balances — the
server keeps honoring (`lib/commerce/runtime.ts:37-47` widens the flag), the cron pages on-call
every five minutes, the admin banner names the total, and the shopper holding the card has no input
to type it into. `/api/gift-cards/balance` has the same defect at `:35`: it returns
`{ valid: false }` for a perfectly good code because it too reads the configured flag.

This contradicts D-04 ("redemption, settlement and refunds keep working exactly as if honor were
on"), D-16 ("with honor=off **and the guard clear**, `GiftCardApplyPanel` simply does not render"),
and the prose this phase added to `docs/runtime-configuration.md`:

> Turning honor off while a balance or open reservation exists is ignored: redemption, settlement,
> and refunds keep running exactly as if honor were on.

**Fix:** Push the effective value into the public config the client reads, rather than the raw flag.
The checkout page is a server component; resolve the guard there and pass it down, the same way
`app/product/[slug]/page.tsx` passes `giftCardSalesDisabled`:

```tsx
// checkout page (server)
const honorEffective = await honorIsEffectivelyOn(env.DB, configuredHonor, nowSeconds);
<CheckoutClient ... giftCardRedemptionEnabled={honorEffective} />

// CheckoutClient
{giftCardRedemptionEnabled && <GiftCardApplyPanel ... />}
```

Apply the same change to `app/api/gift-cards/balance/route.ts:35` (`honorIsEffectivelyOn` instead of
the bare flag). Note `tests/unit/components/gift-card-checkout-gating-source.test.ts:42` currently
pins the wrong contract and will need updating alongside.

---

### CR-04: The storefront chat assistant still returns the gift card under sell=off

**File:** `app/api/agent-chat/route.ts:782-801`

**Issue:** Nine listing call sites were routed through `filterListedProducts`. `/api/agent-chat` —
the Volt drawer a shopper actually talks to (`components/agent/AgentDrawer.tsx`) — was not one of
them, and is not in the diff at all. It hydrates products directly from Drizzle:

```ts
const productResults = await db.select().from(products)
  .where(and(inArray(products.id, finalProductIds), eq(products.status, "active")));
```

The ids come from Vectorize semantic search (`:615`) plus the model's own picks (`:773`), filtered
only on `status`. Under sell=off the shopper can ask "what should I get someone as a gift?" and get
a gift-card product card. Under both flags off that card links to `/product/gift-card`, which now
`notFound()`s (`app/product/[slug]/page.tsx:68`) — a dead link from the assistant.

The Vectorize context snippets at `:604` are also unfiltered, so the model is fed gift-card copy and
will describe a product the store says does not exist.

D-07 names "Volt's product results and recommendations" explicitly. The plan interpreted "Volt" as
the MCP tools only; `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts:13-23` hard-codes
the nine files and so cannot detect the omission.

**Fix:** Filter after hydration, before projection, using the same predicate:

```ts
import { getStoreConfig } from "@/lib/store-config";
import { filterListedProducts } from "@/lib/gift-cards/visibility";

const { giftCardAcquisition } = getStoreConfig().commerce.features;
const visibleResults = filterListedProducts(productResults, { giftCardAcquisition });
relatedProducts = await Promise.all(visibleResults.map(async (productRecord) => { ... }));
```

Drop the matching ids from `contextSnippets` too, and add `app/api/agent-chat/route.ts` to
`PUBLIC_LISTING_CALL_SITES` so the source contract covers it.

---

## Warnings

### WR-01: `/product/gift-card` stays in the sitemap after it starts returning 404

**File:** `app/sitemap.ts:29`, `lib/seo/sitemap-data.ts:26-32`

**Issue:** `getSitemapCatalogEntries` selects on `products.status = 'active'` only. With both flags
off the product page `notFound()`s but the sitemap keeps advertising the URL, so crawlers are handed
a 404 from an authoritative index.

**Fix:** Filter the sitemap product rows through `isPubliclyVisibleProduct` when
`giftCardSurfacesHidden(features)` is true. Leave it listed under sell=off/honor=on — the page still
renders there, which is the whole point of D-07.

---

### WR-02: `MIN(account.currency_code)` sums minor units across currencies

**File:** `lib/gift-cards/repository.ts:251`

**Issue:** `outstandingMinor` is a `SUM` over every active card regardless of `currency_code`, and
the reported currency is whichever code sorts first. A store with USD and EUR cards gets a number
that is not a total of anything, formatted in the alphabetically smaller currency on the admin
banner.

**Fix:** Either group by `currency_code` and return a per-currency array, or scope the aggregate to
`storeDefaults.commerce.currency` and count non-matching cards separately. If single-currency is a
deliberate assumption, assert it: `COUNT(DISTINCT account.currency_code) = 1` and report the
mismatch as a telemetry event.

---

### WR-03: The admin page reads the guard without the fail-open wrapper

**File:** `app/admin/gift-cards/page.tsx:30-35`

**Issue:** The page calls `readHonorGuard` directly. Any D1 error propagates out of the server
component and the page 500s. `app/api/admin/gift-cards/route.ts:45` uses `honorIsEffectivelyOn`,
which swallows the same error and returns "guard active". Two consumers of one measurement disagree
on what a failed read means, and the one an operator opens in a crisis is the one that breaks.

**Fix:** Wrap the read so the page degrades to `record: null` (which `balancesMayExist` and the
banner both already handle as "measurement unavailable"):

```ts
const guardRecord = !giftCardReconciliation && environment.DB
  ? await readHonorGuard(environment.DB).catch(() => null)
  : null;
```

---

### WR-04: The honor banner fires whenever honor is off, even with a clear guard

**File:** `components/admin/GiftCardHonorBanner.tsx:47-51`

**Issue:** The only early return is `if (honorConfigured) return null`. It never consults whether the
guard is actually active. With a fresh, zeroed record it still prints "Gift-card honoring is off,
but balances still owed keep being honored regardless" followed by "$0.00 outstanding across 0 open
reservations" — an alarm for a state that is the flag working correctly. The page reaches that state
whenever sell is on and honor is off, and will reach it in more states once CR-01 is fixed.

**Fix:** Pass `guardActive` (the page already computes it at `:33`) and return `null` when it is
false.

---

### WR-05: A negative outstanding total reads as "no money"

**File:** `lib/gift-cards/honor-guard.ts:179`, `tests/unit/lib/gift-cards/honor-guard.test.ts:86-90`

**Issue:** `record.outstanding_minor > 0` means a negative total — which can only come from ledger
corruption or a forged record (see CR-02) — turns honoring off. The module's own stated rule is "the
only way honoring turns off is a fresh, readable record that says zero", and a negative number is not
zero. The test at `:86` cements the fail-open direction as intended behaviour.

**Fix:** `return record.outstanding_minor !== 0 || record.open_reservations !== 0;` and flip the test
expectation, or treat a negative total as unreadable and return `true` alongside the NaN cases.

---

### WR-06: The banner formats untrusted numbers and currency codes without a guard

**File:** `components/admin/GiftCardHonorBanner.tsx:64`

**Issue:** `Money.fromMinor(record.outstanding_minor, record.currency).format()` runs on values that
`parseRecord` validated only as "finite number" and "string". An empty-string currency throws
`TypeError` in the `Money` constructor (`lib/money/money.ts:33`); a non-ISO code throws `RangeError`
out of `Intl.NumberFormat` (`:104`); a fractional total trips `assertSafeMinorUnits`. Any of them
crashes the admin server component. Reachable through CR-02.

**Fix:** Tighten `parseRecord` to require `Number.isSafeInteger(outstanding_minor)`,
`open_reservations >= 0`, and `/^[A-Z]{3}$/i.test(currency)`; return `null` otherwise so the banner
takes its "measurement unavailable" branch.

---

### WR-07: `/api/products` filters after slicing, so pages come back short

**File:** `app/api/products/route.ts:100-104`

**Issue:** `page` is fetched with `limit`/`offset` applied in SQL, then filtered in memory:

```ts
total = filterByVisibility(filterByStatus(allProducts)).length;
products = filterByVisibility(filterByStatus(page));
```

Under sell=off, whichever page contains the gift card returns `limit - 1` items while `total`
describes the fully filtered set. A client paginating on `total` sees a hole. The pattern predates
this phase (`filterByStatus` had the same shape) but the gift-card filter widens the blast radius.

**Fix:** Filter the full set once and slice from it, matching what the `category` branch at `:95-98`
already does.

---

### WR-08: The cron now touches gift-card tables on every tick regardless of the flags

**File:** `lib/observability/scheduled.ts:40`

**Issue:** `runGiftCardHonorGuard` is called unconditionally and always runs
`sumOutstandingGiftCardBalances` against `gift_card_accounts` and `gift_card_reservations`. Before
this change the tick touched nothing gift-card-shaped unless reconciliation was on. This phase's own
doc still promises the opposite:

> Before installing the additive schema and runtime factory, leave both off — that path opens no D1
> connection and parses no bearer-code keys.

Following that documented order on a fresh deploy means the guard query hits missing tables and logs
`[cron] gift-card honor guard unavailable` every five minutes. (Drains still run — the `.catch` at
`:49` is correct.)

**Fix:** Skip the measurement when neither table has been migrated, or short-circuit when both flags
are off *and* no guard record exists yet, and correct the sentence in
`docs/runtime-configuration.md`.

---

### WR-09: The writer source contract scans only `app/`

**File:** `tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts:41`

**Issue:** `collectSourceFiles(join(process.cwd(), "app"))`. A request-path writer added under
`lib/` (server actions, MCP tools, service modules — all reachable from a request) passes the test
untouched. The contract it claims to enforce is "no request path writes this record", which is
broader than one directory.

**Fix:** Walk `lib/` and `workers/` too, allowlisting `lib/gift-cards/honor-guard.ts` itself and
`lib/observability/scheduled.ts`.

---

### WR-10: MCP checkout surfaces a stopped sale as a generic failure

**File:** `lib/mcp/checkout.ts:116-117`

**Issue:** `priceCheckout` correctly throws `GiftCardSalesDisabledError` on the MCP path (the default
`giftCardSalesEnabled` dependency applies — sell=off is *not* bypassable here). But the throw happens
outside the try block and there is no `instanceof` mapping, so an agent gets an unstructured failure
where a browser client gets `{ code: 'gift_card_sales_disabled' }`. An agent cannot act on it.

**Fix:** Map it in the MCP tool response the same way `app/api/payment-intent/route.ts:171` does.

---

### WR-11: The home page caches the visibility decision for an hour

**File:** `app/page.tsx:86`

**Issue:** `export const revalidate = 3600`. The gift-card visibility decision is now part of the
cached render, unlike every other listing surface, which resolves per request. The flags are
deploy-time env vars so a flip normally implies a new build, but this is the one surface where the
phase's behaviour depends on cache-invalidation semantics and there is no test covering it.

**Fix:** Either confirm and document that the OpenNext R2 incremental cache is keyed by build id, or
drop the featured-products fetch below a `revalidate = 0` boundary.

---

### WR-12: The admin gift-card queue now lists cards in a state where it used to return empty

**File:** `app/api/admin/gift-cards/route.ts:38-49`

**Issue:** The old gate was `reconciliation !== true → { cards: [], total: 0 }`. The new gate fires
only when *both* flags are off. With sell=on and honor=off the route now returns the full card
projection where it previously returned nothing. That combination is the invalid state D-02 says
throws at capability resolution — but this route reads env directly and never resolves capabilities,
so nothing stops it. A behaviour change in a money surface that no plan discusses and no test covers.

**Fix:** Decide deliberately. If sell-on/honor-off should be unreachable, make the route fail closed
on it rather than opening up; add a case to
`tests/unit/app/api/gift-card-presentation-routes.test.ts` either way.

---

## Answers to the review questions

1. **Can sell=off be bypassed?** No. `priceCheckout` merges `defaultDependencies` first
   (`lib/services/checkout-pricing.ts:542`), so `giftCardSalesEnabled` is always present even when a
   caller passes a partial `dependencies` object. Both MCP call sites (`lib/mcp/checkout.ts:116-117`)
   pass no dependency override. `/api/setup-intent` never prices a gift-card line. `getStoreConfig`
   defaults both flags to `false` (`lib/store-config.ts:145`), so an unset var fails closed. Only
   defect on this path is WR-10 (error shape, not enforcement).

2. **Is the honor-guard override safe?** Mostly, with two exceptions. Correct: no per-request balance
   scan (one indexed `admin_settings` read, and only when honor is off *and* sell is off); the
   `.catch(() => true)` at `lib/commerce/runtime.ts:46` is genuinely redundant belt-and-braces since
   `honorIsEffectivelyOn` already catches internally; a missing `DB` binding throws inside and lands
   on `true`; first deploy with no record fails toward honoring (`balancesMayExist(null) → true`);
   900s vs a 300s cron is three missed ticks of headroom. Not safe: the record is not cron-only
   (CR-02), and the measurement itself is wrong for in-flight settlements (CR-01).

3. **Does the cron keep one `waitUntil` and still drain on guard failure?** Yes, both. One
   `ctx.waitUntil` for the `*/5` branch (`lib/observability/scheduled.ts:37`), with `.catch` placed
   *before* `.then` so a guard throw degrades to the configured flag and the three drains still run.
   `tests/unit/worker-cron-routing.test.ts` asserts `waits).toHaveLength(1)`.

4. **Are the listing filters complete?** Nine of eleven. The nine named surfaces are correct and use
   the shared predicate; admin listing is untouched and `lib/models/mach/products.ts` is clean.
   Missing: `/api/agent-chat` (CR-04) and `app/sitemap.ts` (WR-01).

5. **Product page and caching?** Correct. `notFound()` under off/off, unavailable copy under sell=off,
   `revalidate = 0` on the product page so no stale state survives a flip. Category page is dynamic.
   Home page is ISR at 3600s — see WR-11.

6. **Any loosened tests?** No. 269 tests across the new suites pass; no `.skip`, `.only`, `.todo`,
   `expect(true)`, or inverted RED evidence. Mocks are collaborators, not the unit under test
   (`runtime-honor-override.test.ts` mocks the guard while testing `runtime.ts`;
   `worker-cron-routing.test.ts` mocks the guard while testing routing). Two gaps in *coverage* rather
   than integrity: the writer contract scans only `app/` (WR-09), and the listing call-site list is
   hard-coded so it cannot notice a missing surface (CR-04).

7. **Telemetry envelope and tail parity?** Clean. `effect_type: 'gift_card'`, `trigger: 'scheduled'`,
   `outcome: 'needs_review'` are all in `ALLOWED_FIELD_ENUMS`
   (`lib/observability/telemetry.ts:110-131`); `count` is a declared number field. The event is
   registered `severity: 'critical', sampleRate: 1` and mirrored in `TAIL_CRITICAL_EVENTS`
   (`workers/observability-tail/src/core.ts:32`). No new enum values, so the byte-parity test between
   the two lists still holds.

---

_Reviewed: 2026-09-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
