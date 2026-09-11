# Phase 13: Gift-Card Flags - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The two gift-card feature flags do what their names say. Sell (`STORE_FEATURE_GIFT_CARD_ACQUISITION`) controls whether a shopper can buy a gift card; honor (`STORE_FEATURE_GIFT_CARD_RECONCILIATION`) controls whether existing cards are redeemed, settled and refunded. Today sell=off only blocks redemption (backwards) and nothing hides the surfaces when both are off. This phase changes the behaviour behind the existing env var names, gates every gift-card surface (product, listings, checkout panel, admin nav and page) on the right flag, protects outstanding balances from a careless honor=off, and rewrites the two docs that describe the flags. Requirements GCF-01..05. The admin management UI itself is Phase 14; this phase only decides whether the admin entry renders.
</domain>

<decisions>
## Implementation Decisions

### Flag semantics
- **D-01:** The env var names stay (`STORE_FEATURE_GIFT_CARD_ACQUISITION`, `STORE_FEATURE_GIFT_CARD_RECONCILIATION`). Code, tests and docs call them **sell** and **honor**. No rename, no new var.
- **D-02:** Four states: sell on + honor on = normal; sell off + honor on = stopped selling, still honoring; both off = gift cards do not exist; sell on + honor off = invalid, capability resolution keeps throwing `CommerceCapabilityConfigurationError` as today (GCF-04).
- **D-03:** Sell=off stops sales, not redemption. The gift-card tender capability (`resolveTender` etc. in `lib/commerce/capabilities.ts`) is gated on **honor** only; the current "acquisition gates tender" wrapper is removed.

### Honor off with outstanding balances (Russell)
- **D-04:** Honor=off is **ignored while any active balance or open reservation exists**: redemption, settlement and refunds keep working exactly as if honor were on. The runtime never refuses to start over this.
- **D-05:** The condition is measured by one D1 query (sum of active-card available balances plus count of unreleased, uncommitted reservations that have not expired) run from the five-minute cron tick and from the admin gift-card page, not per request. The cron emits a critical telemetry event (new closed-taxonomy event, e.g. `gift_card.honor_disabled_with_balances`, registered in `TELEMETRY_EVENTS` and `TAIL_CRITICAL_EVENTS`) every tick the condition holds; the admin page shows a banner naming the outstanding total and count.
- **D-06:** How "honor effectively on" is decided at request time without a per-request query: the cron writes its measurement to `admin_settings` (a small JSON value: outstanding total, reservation count, measured-at); capability resolution reads that one setting when honor=off and treats honor as on while the recorded outstanding total is above zero or the record is missing/stale. Planner may pick a simpler equivalent if research finds one, but no per-request balance scan.

### Sell off, honor on — product visibility (Russell)
- **D-07:** The gift-card product is **hidden from every listing surface** (home, Featured and any category grid, search, `/api/products`, Volt's product results and recommendations) but a **direct link to `/product/gift-card` still renders** with "Gift cards are not available right now" copy in place of the recipient form and add-to-cart. Bookmarks and old emails do not dead-end.
- **D-08:** Hiding is data-driven by `product.type === 'gift_card'` at the listing/query layer (`lib/models/mach/products.ts` `listProducts`, `searchProducts`, `getProductsByCategory`, the home/Featured path and the Volt/recommendation projections), read from the runtime flags — never by slug or id.
- **D-09:** Checkout: with sell off, `priceCheckout` rejects any gift-card line (a clear error the client shows on the cart/checkout, not the generic pricing error), and the cart drawer marks an existing gift-card line as unavailable. Redemption (the payment-step gift-card panel) stays.

### Both flags off
- **D-10:** No gift-card surface renders: product absent from listings and `/product/gift-card` returns 404 (`notFound()`), checkout renders no gift-card panel and rejects gift-card lines, the admin sidebar has no Gift cards entry and `/admin/gift-cards` plus `/api/admin/gift-cards` return 404. The public balance endpoint returns 404 too. If balances exist, D-04 applies to honoring (the cron alarm fires) even though the surfaces are hidden — hiding is a presentation decision, honoring is a money decision.

### Client exposure
- **D-11:** Client components read the flags only through the public store config (`toPublicStoreConfig` / `useStoreConfig`), which already carries `commerce.features.giftCardAcquisition` and `giftCardReconciliation`. No new `NEXT_PUBLIC_*` var.

### Docs
- **D-12:** `docs/runtime-configuration.md` and `docs/DEPLOYMENT_SETUP.md` §9 describe the flags as sell and honor, carry the four-state table, the outstanding-balance rule (D-04/D-05), and the rollback recipe "set sell off, keep honor on until every balance is zero or refunded". The "acquisition without reconciliation throws" line stays. `docs:lint` stays green.

### UI design contract
- **D-13:** The plan-gate's frontend detector matched the word "page" in the success criteria. The UI in this phase is an unavailable notice on the product page, an unavailable mark on a cart line, and an admin banner, all in existing token classes; planning runs with `--skip-ui`, the same call as Phases 9 and 12.

### Research resolutions (Claude, after 13-RESEARCH.md)
- **D-14:** The listing filter lives at the public call sites through one shared predicate (e.g. `lib/gift-cards/visibility.ts` `hidesGiftCardsFromListings(features)` + a `filterListedProducts` helper), never inside `listProducts`/`searchProducts`/`getProductsByCategory`, which `/admin/products` also uses and Phase 14 depends on. CMS page-builder product blocks (`lib/cms/page-products.ts`) count as listing surfaces and use the same predicate.
- **D-15:** The honor-guard measurement is stored in `admin_settings` under category `gift_cards`, key `gift_cards.honor_guard`, value `{ outstanding_minor, currency, open_reservations, measured_at }`; written only by the cron tick, read by capability resolution (when honor=off) and the admin page. A missing or stale (> 15 min) record while honor=off counts as "balances may exist" — honor stays effectively on.
- **D-16:** With honor=off (and the guard clear), `GiftCardApplyPanel` simply does not render; no explanatory copy. `priceCheckout` under sell=off rejects gift-card lines with a distinct `GiftCardSalesDisabledError` surfaced by `/api/payment-intent` as `{ code: 'gift_card_sales_disabled' }`, read from `getStoreConfig().commerce.features.giftCardAcquisition` (synchronous), not a capability round trip.

### Planner resolution (accepted by Claude)
- **D-17:** Under both flags off, the sidebar entry and the public balance endpoint follow the configured flags only (always hidden/404). The admin gift-card page and its API stay reachable by URL while the honor guard is active (money outstanding), so the D-05 banner has somewhere to render; once the guard clears they 404 too. Hiding is presentation, honoring is money (D-10).

### Review reconciliation (iteration 2)
- **D-18:** D-16's parenthetical ("with honor=off and the guard clear") is subordinate to D-10: with both flags off the checkout gift-card panel never renders, whatever the guard says — hiding follows the configured flags, honoring keeps running server-side. The single source of truth for "is honoring effectively on" is one exported `resolveHonorEffective(database, flags, now)` in `lib/gift-cards/honor-guard.ts`, used by the runtime, the checkout page, the balance route, the admin page and the admin API route (`app/api/admin/gift-cards/route.ts`); the admin banner reads the guard record directly (`balancesMayExist`) because it shows a number, not a decision. Surfaces add their own `giftCardSurfacesHidden` check for presentation.

### Claude's Discretion
- Exact copy of the unavailable state on the product page and cart line; whether the product page keeps the image and description above the notice (recommended: yes).
- Whether the honor-off measurement lives in `admin_settings` (D-06) or a tiny dedicated table — no migration unless needed; prefer `admin_settings`.
- Test shape: unit tests on the capability matrix (all four states, with and without outstanding balances), source-contract tests for the surfaces, and one integration test on the cron alarm.
</decisions>

<specifics>
## Specific Ideas

- Russell: "we should never allow sales and not allow redemptions" — sell-without-honor stays a hard startup error.
- Russell: a single "gift cards off" switch is wrong once cards exist; two flags with "stop selling, keep honoring" is the model.
- The v2.1 production store has one card with a zero balance and no open reservations at the time of writing; the alarm should be quiet after deploy.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Flags and capabilities
- `lib/commerce/capabilities.ts` — flag matrix, the throw for sell-without-honor, the tender wrapper to remove
- `lib/commerce/runtime.ts` — where the env flags are read
- `lib/store-config.ts` — `commerce.features.giftCardAcquisition/giftCardReconciliation` and `toPublicStoreConfig`
- `lib/observability/scheduled.ts` — cron tick that gates the delivery drain on reconciliation; where the balance measurement and alarm go
- `lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts` — closed event taxonomy and critical list
- `docs/runtime-configuration.md`, `docs/DEPLOYMENT_SETUP.md` §9 — the docs to rewrite
- `.planning/todos/pending/gift-card-admin-and-flags.md` §1 — the seed with the four-state table

### Surfaces
- `app/product/[slug]/page.tsx`, `app/product/[slug]/ProductDisplay.tsx` — product page and its gift-card branch
- `lib/models/mach/products.ts` (`listProducts`, `searchProducts`, `getProductsByCategory`), `app/page.tsx`, `app/category/[slug]/page.tsx`, `app/api/products/route.ts`, Volt/recommendation product projections — listing surfaces to filter
- `lib/services/checkout-pricing.ts` — gift-card line acceptance (`product.type === 'gift_card'` branch)
- `components/checkout/CheckoutClient.tsx`, `components/checkout/GiftCardApplyPanel.tsx`, `components/cart/CartItemCard.tsx` — checkout panel and cart line
- `components/admin/AdminSidebar.tsx`, `app/admin/gift-cards/page.tsx`, `app/api/admin/gift-cards/route.ts`, `app/api/gift-cards/balance/route.ts` — admin and public routes to gate
- `lib/gift-cards/repository.ts` `availableBalanceExpression` — the balance arithmetic to reuse for the outstanding measurement

### Locked
- `docs/checkout-trust-boundary.md` (ADR-CTB, ADR-CTB-10) — gift-card backend semantics do not change; this phase only gates and measures
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveCommerceCapabilities(flags, factories)` already encodes the matrix; the change is which flag the tender wrapper reads and adding the outstanding-balance override.
- `availableBalanceExpression` in the repository gives the exact per-card available balance SQL; the outstanding measurement is a SUM over active accounts plus a reservation count.
- `recordTelemetry` + `TAIL_CRITICAL_EVENTS` parity test pattern from Phase 12 (`gift_card.delivery_failed`).
- `useStoreConfig()` on the client already exposes both feature booleans; `ProductDisplay` already has a gift-card branch with a "Currently unavailable" state to extend.

### Established Patterns
- Source-contract tests pin surface behaviour (`tests/unit/components/*-source.test.ts`).
- `admin_settings` holds small operational values (`store.tax_rate`, layout switches) read through `getSettings`.
- Public route gating returns 404 via `notFound()` on pages and `NextResponse.json({error}, {status: 404})` on routes when a feature is off (see `app/account/subscriptions` for the subscription flag pattern).

### Integration Points
- The scheduled handler already computes `giftCardsEnabled` from the reconciliation flag; the measurement and alarm hang off the same tick.
- `priceCheckout` already rejects an uncustomised gift-card line; the sell=off rejection sits beside it and must surface a distinct error through `/api/payment-intent` (the Phase 12 `code:` pattern).
</code_context>

<deferred>
## Deferred Ideas

- Admin UI to flip the flags from the dashboard (they stay deploy-time vars).
- Per-card management, reissue, notes — Phase 14.
- A "coming back soon" notification signup on the unavailable product page.
</deferred>

---

*Phase: 13-gift-card-flags*
*Context gathered: 2026-09-10 with Russell (two decisions) and Claude's discretion on the rest*
