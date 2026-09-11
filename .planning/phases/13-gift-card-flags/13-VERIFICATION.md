---
phase: 13-gift-card-flags
verified: 2026-09-10T17:24:34Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:

  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/13-gift-card-flags/13-01-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-01-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-02-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-02-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-03-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-03-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-04-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-04-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-05-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-05-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-06-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-06-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-07-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-07-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-08-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-08-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-09-PLAN.md"
  - ".planning/phases/13-gift-card-flags/13-09-SUMMARY.md"
  - ".planning/phases/13-gift-card-flags/13-CONTEXT.md"
  - ".planning/phases/13-gift-card-flags/13-VALIDATION.md"
  - "app/admin/gift-cards/page.tsx"
  - "app/api/admin/gift-cards/route.ts"
  - "app/api/gift-cards/balance/route.ts"
  - "app/api/payment-intent/route.ts"
  - "app/api/products/route.ts"
  - "app/category/[slug]/page.tsx"
  - "app/page.tsx"
  - "app/product/[slug]/ProductDisplay.tsx"
  - "app/product/[slug]/page.tsx"
  - "components/admin/AdminSidebar.tsx"
  - "components/admin/GiftCardHonorBanner.tsx"
  - "components/cart/CartItemCard.tsx"
  - "components/checkout/CheckoutClient.tsx"
  - "docs/DEPLOYMENT_SETUP.md"
  - "docs/runtime-configuration.md"
  - "lib/cms/page-products.ts"
  - "lib/commerce/capabilities.ts"
  - "lib/commerce/runtime.ts"
  - "lib/gift-cards/checkout.ts"
  - "lib/gift-cards/honor-guard.ts"
  - "lib/gift-cards/repository.ts"
  - "lib/gift-cards/visibility.ts"
  - "lib/mcp/catalog.ts"
  - "lib/mcp/tools/assess.ts"
  - "lib/mcp/tools/recommend.ts"
  - "lib/mcp/tools/search.ts"
  - "lib/observability/scheduled.ts"
  - "lib/observability/telemetry.ts"
  - "lib/recommendations/index.ts"
  - "lib/services/checkout-pricing.ts"
  - "tests/integration/lib/gift-cards/honor-guard-cron.test.ts"
  - "tests/integration/lib/gift-cards/honor-guard.test.ts"
  - "tests/unit/app/admin-gift-card-gating.test.ts"
  - "tests/unit/app/api/gift-card-presentation-routes.test.ts"
  - "tests/unit/app/api/payment-intent-authority.test.ts"
  - "tests/unit/app/api/products-public.test.ts"
  - "tests/unit/app/product-slug-page.test.ts"
  - "tests/unit/components/gift-card-checkout-gating-source.test.ts"
  - "tests/unit/components/gift-card-unavailable-source.test.ts"
  - "tests/unit/docs/gift-card-flag-docs.test.ts"
  - "tests/unit/lib/commerce/capabilities.test.ts"
  - "tests/unit/lib/commerce/runtime-honor-override.test.ts"
  - "tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts"
  - "tests/unit/lib/gift-cards/honor-guard.test.ts"
  - "tests/unit/lib/gift-cards/listing-call-sites-source.test.ts"
  - "tests/unit/lib/gift-cards/visibility.test.ts"
  - "tests/unit/lib/services/checkout-pricing.test.ts"
  - "tests/unit/worker-cron-routing.test.ts"
  - "workers/observability-tail/src/core.ts"

  - ".planning/phases/13-gift-card-flags/13-SECURITY.md"
covered_digest: "v1:sha256:43c5d6341cdef26a6f880c9d7d5b2f2f8f4cbbee03e5a42178756fd2a038fbe9"
decision_coverage:
  honored: 17
  total: 17
  not_honored: []
human_verification: []
optional_confirmations:

  - test: "Set both gift-card flags to false in local .dev.vars, run npm run dev, and eyeball the admin sidebar, /admin/gift-cards and the home page."
    expected: "No Gift cards sidebar entry, an ordinary 404 on /admin/gift-cards, no gift card on the home grid."
    why_optional: "The same three truths are each pinned by an automated test (AdminSidebar source contract, the admin page's notFound() behavioural test, and the anonymous /api/products listing test against the shared predicate). This is a visual confirmation, not the evidence the truth rests on."
---

# Phase 13: Gift-Card Flags Verification Report

**Phase Goal:** The two gift-card flags do what their names say — sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) controls selling, honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) controls redeeming — so a store can stop selling cards while still honoring the balances it already took money for.
**Verified:** 2026-09-10T17:24:34Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | With sell off and honor on, a shopper cannot buy a gift card — the product page shows "not available" copy instead of the recipient form, and checkout rejects a gift-card line (ROADMAP SC1a, GCF-01) | ✓ VERIFIED | `app/product/[slug]/page.tsx:71` computes `giftCardSalesDisabled` server-side; `ProductDisplay.tsx:372-377` renders "Gift cards are not available right now" **before** the inventory branch, so no recipient form and no add-to-cart survive. `lib/services/checkout-pricing.ts:583-584` throws `GiftCardSalesDisabledError`; `app/api/payment-intent/route.ts:171-175` maps it to HTTP 400 `{ code: 'gift_card_sales_disabled' }`. Behavioural tests: `product-slug-page.test.ts:134`, `checkout-pricing.test.ts` "refuses to price a gift-card line while selling is off" + "refuses the sale before considering tender…", `payment-intent-authority.test.ts:426-444`. All green. |
| 2 | With sell off and honor on, a shopper holding an existing card still redeems its balance at checkout (ROADMAP SC1b, GCF-01, D-03) | ✓ VERIFIED | The acquisition-gated tender wrapper is gone: `lib/commerce/capabilities.ts:181-194` resolves `giftCards` on `acquisition \|\| reconciliation` and comments the honor-only rule. `CheckoutClient.tsx:513` gates `GiftCardApplyPanel` on `giftCardReconciliation`, never on sell. Behavioural tests: `capabilities.test.ts:161` "keeps redeeming an already-paid-for card with sell off and honor on"; `checkout-pricing.test.ts` "still redeems a gift-card code against a non-gift cart while selling is off"; `gift-card-checkout-gating-source.test.ts:39`. All green. |
| 3 | With both flags off, no gift-card surface renders anywhere — absent from listings, page 404s, no checkout panel, no admin nav entry, `/admin/gift-cards` unreachable (ROADMAP SC2, GCF-03, D-10) | ✓ VERIFIED | `giftCardSurfacesHidden()` (`lib/gift-cards/visibility.ts`) gates `app/product/[slug]/page.tsx:70` (`notFound()`) and `app/admin/gift-cards/page.tsx:36-37`. `AdminSidebar.tsx:146` hides the entry unless a flag is on. `app/api/admin/gift-cards/route.ts:44-48` and `app/api/gift-cards/balance/route.ts:29-32` return 404. Listing filter is applied (not just imported) at 11 public call sites — see Key Links. Behavioural tests: `product-slug-page.test.ts:143`, `admin-gift-card-gating.test.ts:71,93`, `gift-card-presentation-routes.test.ts:79,103`, `products-public.test.ts:176`. All green. A sweep of `app/` and `components/` found no ungated gift-card surface (`app/account/gift-cards` and `app/api/gift-cards/route.ts` do not exist; `AccountNav.tsx:17` records that gift cards are deliberately absent from the account nav). |
| 4 | Honor cannot be turned off while any active balance or open reservation exists — honoring keeps running and the operator gets a loud, named warning (ROADMAP SC3a, GCF-02, D-04/D-05) | ✓ VERIFIED | Behaviourally proven against real D1, not by symbol presence: `tests/integration/lib/gift-cards/honor-guard-cron.test.ts` runs two consecutive ticks and asserts `honorEffective === true` **and** one `gift_card.honor_disabled_with_balances` critical envelope **per tick** (the every-tick invariant), plus a fresh empty measurement flipping `honorEffective` to false with no alarm, plus single-row upsert. Request path: `runtime-honor-override.test.ts` "keeps honoring while the guard says balances may still exist" and "keeps honoring when the guard read fails outright". Operator half: `GiftCardHonorBanner.tsx` prints formatted outstanding total, open-reservation count and measurement time (`admin-gift-card-gating.test.ts:115,126,132`) and names no card material (`:138`). 21 integration tests green. |
| 5 | Sell on with honor off still refuses to start, and the honor guard never rescues that configuration (ROADMAP SC3b, GCF-04, D-02) | ✓ VERIFIED | `lib/commerce/capabilities.ts:158-161` still throws `CommerceCapabilityConfigurationError` before any factory runs. `lib/commerce/runtime.ts` short-circuits the override on `!sellsGiftCards`, so the guard cannot widen honor while selling is on. Behavioural tests: `capabilities.test.ts:212` "throws before any factory runs with sell on and honor off"; `runtime-honor-override.test.ts:89` "still refuses to sell cards it cannot honor, whatever the guard would say". Green. |
| 6 | An operator reading `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` §9 finds the flags described as sell and honor, with the four-state table and the "stop selling, keep honoring" rollback recipe (ROADMAP SC4, GCF-05) | ✓ VERIFIED | `docs/runtime-configuration.md:55-88` — sell/honor vocabulary, four-state table (rows 69-70), the "honor off does not always mean honor off" rule naming `gift_cards.honor_guard`, the 900s staleness window, the cron event and the admin banner, and the rollback recipe (84-88). `docs/DEPLOYMENT_SETUP.md` heading `## 9. Gift Card Enablement` at line 479, four-state table at 492-493, rollback at 581-596. `tests/unit/docs/gift-card-flag-docs.test.ts` pins the table against the capability code and the honor-guard constants. `npm run docs:lint` → 0 violations. |
| 7 | The honor measurement never runs on a request path: the cron is the sole writer, and request code reads one `admin_settings` row and only when honor is configured off (D-05, D-06, D-15) | ✓ VERIFIED | `runGiftCardHonorGuard` is imported only by `lib/observability/scheduled.ts:9` and called at `:40`. `honorIsEffectivelyOn` returns early on `configuredHonor === true` (no D1 touch) and otherwise reads one row via `readHonorGuard`. No aggregate SQL in `honor-guard.ts`. `honor-guard-writer-source.test.ts` walks `app/` and asserts no file imports the writer (and asserts it walked at least one file, so an empty directory cannot fake a pass). `runtime-honor-override.test.ts:50` "never reads the guard while honoring is configured on". Green. |
| 8 | Production is unchanged by the phase and the guard is live and quiet (13-09 must-haves, GCF-02) | ✓ VERIFIED | Live read-only checks — `GET https://voltique.russellkmoore.me/product/gift-card` → **200**; `GET /api/products?limit=100` → 33 products including `prod_33:gift_card:gift-card` (both flags on, so the card is correctly visible). Remote D1: exactly one `admin_settings` row for `gift_cards.honor_guard`, value `{"outstanding_minor":0,"currency":"USD","open_reservations":0,"measured_at":1789060545}` — measured 2026-09-10T17:15:45Z, **288 s old** against a 900 s staleness window, so the five-minute cron is writing in production. `wrangler.jsonc:131-132` still `"true"`/`"true"` and untouched by the phase (`git log ec8942c..HEAD -- wrangler.jsonc` empty). |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/gift-cards/visibility.ts` | Single shared predicate keyed on product type | ✓ VERIFIED | 5 exports; keys on `type === 'gift_card'`, no slug/id list; imported by 11 non-test modules and called at every one |
| `lib/gift-cards/honor-guard.ts` | Guard record read/write, staleness, alarm, cron entry point | ✓ VERIFIED | Key/category/900s constants, `parseRecord` fail-closed, `balancesMayExist`, `honorIsEffectivelyOn`, `runGiftCardHonorGuard` |
| `lib/gift-cards/checkout.ts` | `GiftCardSalesDisabledError`, distinct from tender-unavailable | ✓ VERIFIED | Class defined and thrown by `checkout-pricing.ts`, mapped by the payment-intent route |
| `components/admin/GiftCardHonorBanner.tsx` | Banner naming outstanding total, count, measured-at | ✓ VERIFIED | Renders `null` when honor configured on; three states (fresh / stale / missing); admin palette by design, not storefront tokens |
| `tests/unit/lib/gift-cards/visibility.test.ts` | Predicate table incl. slug/id decoys | ✓ VERIFIED | Green |
| `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts` | Call sites import the predicate; model layer does not | ✓ VERIFIED | Green; `lib/models/mach/products.ts` contains no `gift_card` reference at all |
| `tests/unit/components/gift-card-unavailable-source.test.ts` | Notice once, ahead of inventory branch, token classes only | ✓ VERIFIED | Green |
| `tests/unit/components/gift-card-checkout-gating-source.test.ts` | Cart mark + panel gated on honor, no explanatory copy | ✓ VERIFIED | Green |
| `tests/unit/lib/gift-cards/honor-guard.test.ts` | Missing / stale / malformed / unreadable all mean "may exist" | ✓ VERIFIED | Green (table-driven) |
| `tests/integration/lib/gift-cards/honor-guard.test.ts` | Aggregate against real D1 | ✓ VERIFIED | Green |
| `tests/integration/lib/gift-cards/honor-guard-cron.test.ts` | Cron tick against real D1, every-tick alarm | ✓ VERIFIED | Green |
| `tests/unit/docs/gift-card-flag-docs.test.ts` | Docs table pinned to code | ✓ VERIFIED | Green |
| `tests/unit/lib/commerce/runtime-honor-override.test.ts` | Request-path override, 5 cases | ✓ VERIFIED | Green |
| `tests/unit/app/admin-gift-card-gating.test.ts` | Admin page + sidebar + banner content | ✓ VERIFIED | Green |
| `tests/unit/lib/gift-cards/honor-guard-writer-source.test.ts` | No `app/` file imports the writer | ✓ VERIFIED | Green, with an anti-vacuous-pass assertion |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/page.tsx` | `lib/gift-cards/visibility.ts` | `filterListedProducts` | ✓ WIRED | import :44, call :54 |
| `app/category/[slug]/page.tsx` | visibility | `filterListedProducts` | ✓ WIRED | import :49, call :76 |
| `app/api/products/route.ts` | visibility | `filterListedProducts` on the **non-admin branch only** | ✓ WIRED | :84-87 `isAdmin ? products : filterListedProducts(...)` |
| `lib/mcp/catalog.ts` / `tools/search.ts` / `tools/assess.ts` / `tools/recommend.ts` | visibility | `filterListedProducts` | ✓ WIRED | calls at :43, :53, :51, :53 |
| `lib/recommendations/index.ts` | visibility | `filterListedProducts` | ✓ WIRED | call :19 |
| `lib/cms/page-products.ts` | visibility | `isPubliclyVisibleProduct` | ✓ WIRED | call :67 |
| `app/product/[slug]/page.tsx` | `ProductDisplay.tsx` | `giftCardSalesDisabled` prop computed server-side | ✓ WIRED | page :71 → :102; client does not re-derive flags |
| `lib/services/checkout-pricing.ts` | `app/api/payment-intent/route.ts` | `GiftCardSalesDisabledError` → `{ code: 'gift_card_sales_disabled' }`, 400 | ✓ WIRED | pricing :583, route :171-175 |
| `priceCheckout` | store config | injectable `giftCardSalesEnabled` dep defaulting to `getStoreConfig()` | ✓ WIRED | :85 type, :108 default, :551 read — server-side, not client-supplied |
| `lib/observability/scheduled.ts` | `runGiftCardHonorGuard` | cron tick, sole writer | ✓ WIRED | import :9, call :40; drains still run if the guard fails (:47-54) |
| `lib/commerce/runtime.ts` | `honorIsEffectivelyOn` | widens honor only while sell is off | ✓ WIRED | short-circuit `!sellsGiftCards &&`, `.catch(() => true)` |
| `lib/observability/telemetry.ts` | `workers/observability-tail/src/core.ts` | `gift_card.honor_disabled_with_balances` critical on both sides | ✓ WIRED | producer :68 `severity: 'critical', sampleRate: 1`; tail critical list :32 |
| `app/admin/gift-cards/page.tsx` | `app/api/admin/gift-cards/route.ts` | same reachability predicate (configured flags + active guard, D-17) | ✓ WIRED | page :36, route :44-48 — the queue never fetches a route that 404s under it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GiftCardHonorBanner` | `record` | `readHonorGuard(env.DB)` in `app/admin/gift-cards/page.tsx:31` | Yes — real `admin_settings` row | ✓ FLOWING |
| `ProductDisplay` | `giftCardSalesDisabled` | `getStoreConfig().commerce.features` on the server | Yes | ✓ FLOWING |
| `CartItemCard` | unavailable mark | `useStoreConfig()` public config (no new `NEXT_PUBLIC_*`) | Yes | ✓ FLOWING |
| Listing surfaces | filtered product arrays | real model queries, then `filterListedProducts` | Yes — filters, does not reshape or stub | ✓ FLOWING |
| Honor guard record | `outstanding_minor`, `open_reservations` | `sumOutstandingGiftCardBalances` reusing `availableBalanceExpression` | Yes — verified live in prod D1 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase unit tests | `vitest run` over the 18 phase-linked unit files | 18 files / 195 tests passed | ✓ PASS |
| Honor guard on real D1 (incl. every-tick alarm) | `npm run test:workers -- tests/integration/lib/gift-cards/honor-guard.test.ts tests/integration/lib/gift-cards/honor-guard-cron.test.ts` | 2 files / 21 tests passed | ✓ PASS |
| Tail-worker critical taxonomy | `vitest run tests/unit/workers/observability-tail-core.test.ts` + `npm run test:observability-worker` | 13 + 3 tests passed | ✓ PASS |
| Types | `npm run typecheck` | exit 0 | ✓ PASS |
| Docs contract | `npm run docs:lint` | 0 violations | ✓ PASS |
| Production product page | `curl -o /dev/null -w '%{http_code}' https://voltique.russellkmoore.me/product/gift-card` | `200` | ✓ PASS |
| Production listing | `curl https://voltique.russellkmoore.me/api/products?limit=100` | 33 products, `prod_33` type `gift_card` present | ✓ PASS |
| Production guard row | `wrangler d1 execute mercora-db --remote --command "SELECT key, value FROM admin_settings WHERE key='gift_cards.honor_guard'"` | 1 row, outstanding 0, reservations 0, measured 288 s ago | ✓ PASS |
| Deployment | `wrangler deployments list` | `4a0fed9a` (code push, 17:10Z) then `8f539122` (17:19Z, from the `docs(13-09)` push) — current version is `8f539122` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository and no plan declares one. SKIPPED (not applicable).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `capabilities.test.ts` | GCF-01, GCF-04 | 12 | 0 | No | Behavioral (all four flag states, tender exercised) | ✓ Sound |
| `runtime-honor-override.test.ts` | GCF-02, GCF-04 | 5 | 0 | No | Behavioral (real resolver, mocked env/guard) | ✓ Sound |
| `honor-guard.test.ts` (unit) | GCF-02 | table + 2 | 0 | No | Value | ✓ Sound |
| `honor-guard.test.ts` / `honor-guard-cron.test.ts` (integration) | GCF-02 | 21 | 0 | No | Behavioral, real D1 | ✓ Sound |
| `checkout-pricing.test.ts` | GCF-01 | 4 new | 0 | No | Behavioral (error identity + tender not consulted) | ✓ Sound |
| `payment-intent-authority.test.ts` | GCF-01 | 2 new | 0 | No | Value (`code`, status) | ✓ Sound |
| `product-slug-page.test.ts` | GCF-01, GCF-03 | 4 new | 0 | No | Behavioral (`notFound`, prop values) | ✓ Sound |
| `products-public.test.ts` | GCF-01, GCF-03 | 3 new | 0 | No | Behavioral (anon vs admin listing) | ✓ Sound |
| `admin-gift-card-gating.test.ts` | GCF-02, GCF-03 | 9 | 0 | No | Behavioral + rendered content | ✓ Sound |
| `gift-card-presentation-routes.test.ts` | GCF-02, GCF-03 | 7 | 0 | No | Status/value (401 before 404 proven) | ✓ Sound |
| `listing-call-sites-source.test.ts` | GCF-01, GCF-03 | 10 | 0 | No | Source contract | ⚠️ Weaker class, but backed by the behavioural `/api/products` test and by verified call-site invocation |
| `gift-card-unavailable-source.test.ts` | GCF-01 | 3 | 0 | No | Source contract | ⚠️ Weaker class, backed by `product-slug-page.test.ts` prop assertions |
| `gift-card-checkout-gating-source.test.ts` | GCF-01, GCF-03 | 4 | 0 | No | Source contract | ⚠️ Weaker class, backed by `capabilities.test.ts` tender behaviour |
| `honor-guard-writer-source.test.ts` | GCF-02 | 2 | 0 | No | Source contract with anti-vacuous guard | ✓ Sound |
| `gift-card-flag-docs.test.ts` | GCF-05 | — | 0 | No | Cross-checks docs against code constants (not self-referential) | ✓ Sound |

**Disabled tests on requirements:** 0 — no `it.skip`/`describe.skip`/`.only`/`todo` anywhere in the 20 phase test files.
**Circular patterns detected:** 0 — no phase test writes fixture values from the system under test.
**Insufficient assertions:** 0 blocking. Three source-contract files carry weaker assertions by project convention (`tests/unit/components/*-source.test.ts`), and each of the three truths they pin also has an independent behavioural test.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GCF-01 | 13-01/02/03/04/09 | Sell off + honor on: no purchase, no recipient form, pricing rejects, existing cards still redeem | ✓ SATISFIED | Truths 1, 2 |
| GCF-02 | 13-05/06/07/08/09 | Honor off with outstanding value: keeps honoring, loud named warning, docs say so | ✓ SATISFIED | Truths 4, 6, 7, 8 |
| GCF-03 | 13-02/03/04/08/09 | Both off: no surface renders | ✓ SATISFIED | Truth 3 |
| GCF-04 | 13-01/07/09 | Sell on + honor off still refuses to start | ✓ SATISFIED | Truth 5 |
| GCF-05 | 13-06/09 | Both docs describe sell/honor, four-state table, rollback recipe | ✓ SATISFIED | Truth 6 |

**Orphaned requirements:** none. REQUIREMENTS.md maps exactly GCF-01..05 to Phase 13, and every one is claimed by at least one plan.

### Prohibition Checks

| Prohibition | Verification | Status |
|-------------|--------------|--------|
| No visibility filter inside `lib/models/mach/products.ts` (D-14) | test | ✓ HELD — no `gift_card` string in that file at all; `listing-call-sites-source.test.ts:49` pins it |
| No slug- or id-based hiding (D-08) | test | ✓ HELD — predicate keys on `type`; decoys pinned in `visibility.test.ts` |
| Sell-without-honor throw not removed or relaxed (GCF-04) | test | ✓ HELD — `capabilities.ts:158`, two tests |
| No new migration | judgment | ✓ HELD — no file under `migrations/` in the phase diff; guard lives in `admin_settings` |
| No new `NEXT_PUBLIC_*` variable (D-11) | judgment | ✓ HELD — client reads `useStoreConfig()`; `gift-card-checkout-gating-source.test.ts:22` pins it |
| Writer never imported by request-path code (D-15) | test | ✓ HELD — `honor-guard-writer-source.test.ts` |
| `docs/checkout-trust-boundary.md` untouched (locked ADR) | judgment | ✓ HELD — absent from the phase diff |
| Banner uses the admin palette, not storefront tokens (AGENTS.md) | judgment | ✓ HELD — explicit in the component doc-comment; storefront notice separately pinned to token classes |
| No card code/hash/ciphertext/nonce in any response or banner | test | ✓ HELD — `admin-gift-card-gating.test.ts:138` |
| No production flag changed; both stay `"true"` | test | ✓ HELD — `wrangler.jsonc` outside the phase diff, values confirmed `true` |
| No secret-shaped example in either doc | test | ✓ HELD — `docs:lint` 0 violations |

No prohibition reached verification unenforced; none is flagged.

### Decision Coverage

17 of 17 CONTEXT.md decisions honored (D-01 … D-17), each traced to shipped code above. D-17's tension resolution is written into the code it governs (`app/api/admin/gift-cards/route.ts:41-43`, `app/api/gift-cards/balance/route.ts:28-29`). No decision was dropped in execution.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/cms/page-products.ts` | 8, 25, 29, 32, 34 | `PLACEHOLDER_IMAGE` constant | ℹ️ Info | Pre-existing product-image fallback, not a debt marker and not a stub |

**Debt markers (`TBD`/`FIXME`/`XXX`) in phase-modified files: 0.** `TODO`/`HACK`: 0. No empty implementations, no hollow props, no console-log-only handlers in the 49 files this phase touched.

### Advisory (New Scope, Unevidenced)

N/A — initial verification, not a re-verification pass. The evidence gate applies only when a prior VERIFICATION.md with a `gaps:` section exists.

### Notes for Russell (informational, not gaps)

1. **The current deployment is `8f539122`, not `4a0fed9a`.** `4a0fed9a` (17:10Z) is the build from the code push; `8f539122` (17:19Z) is the build triggered by the final `docs(13-09)` planning-only commit. Same application code — `HEAD` = `origin/main` = `b8fc86d`, working tree clean of source changes.
2. **The sell-off checkout error does reach the shopper with specific copy.** 13-04-SUMMARY notes the checkout client does not branch on the new `code`. It does render the server's `error` string, so the shopper sees "Gift cards aren't on sale right now. Remove the gift card from your cart to continue checking out." — not a generic pricing message. D-09's intent is met; a bespoke UI component for the `code` remains optional polish.
3. **In the both-off state, a cardholder cannot self-serve redeem even while the backend keeps honoring.** The checkout panel and the public balance route follow the configured flags only (D-10/D-17), while the runtime honors outstanding balances. This is the recorded design, and the admin banner names the remedy ("Set the honor flag back on until the balance is zero"). Flagging it because it is the one operator-visible consequence of the hiding/honoring split.

### Human Verification Required

None. Every roadmap success criterion is proven by an automated test, and the money-critical invariants (every-tick alarm, honoring-under-honor-off, cron-only writer) are proven behaviourally against real D1 rather than by symbol presence.

One optional visual confirmation is recorded in the frontmatter under `optional_confirmations` — the both-flags-off browser eyeball from 13-VALIDATION.md. It is optional because each of its three claims (no sidebar entry, `/admin/gift-cards` 404, no gift card on the home grid) is independently pinned by a passing automated test.

The three remaining 13-VALIDATION.md "manual-only" rows — §9 prose readability under pressure, the Cloudflare dashboard build log, and a live cron-window watch for alarm silence — stay as recorded there. The third is partially discharged here: production's guard row is fresh and zero, which is the state under which the alarm is correctly silent.

### Gaps Summary

None. All 8 truths verified, all 15 artifacts substantive and wired, all 13 key links connected, all 5 requirements satisfied, all 11 prohibitions held, 0 debt markers, 0 skipped or circular tests.

---

_Verified: 2026-09-10T17:24:34Z_
_Verifier: Claude (gsd-verifier)_
