# Phase 18: Tech-Debt Closure - Research

**Researched:** 2026-09-11 (orchestrator, via two thorough Explore scouts against live code; no external library research needed — every item is internal codebase archaeology)
**Confidence:** HIGH — every fact below was read from the code and test files this session, including exact line numbers and quoted source.

## Summary

Eight independent, small-to-medium fixes. No new dependency, no new migration except the check-migrations script change (not a D1 migration — a build-tool script). Three items (DEBT-05, DEBT-07's windows #5/#6, DEBT-08) need no code change once confirmed; the rest are targeted, well-isolated edits with existing patterns to copy.

## DEBT-01 — delete `/api/tax`

- `app/api/tax/route.ts` (216 lines): `FALLBACK_TAX_RATE = 0.07` hardcoded; `tax_code: 'txcd_99999999'` hardcoded on every line, no gift-card exemption.
- Zero non-test callers repo-wide. Test-only importers: `tests/unit/app/api/public-route-hardening.test.ts:33,62,88`, `tests/unit/api/tax-route.test.ts:3,7`.
- Authoritative service: `lib/services/checkout-pricing.ts` — `NONTAXABLE_TAX_CODE = 'txcd_00000000'` (:398), real Stripe Tax call via injected `deps.calculateTax` (:720), fallback uses `configuredRate(storeSettings['store.tax_rate'])` (:757) and zeroes gift-card lines (:773-775).
- Action: delete the route file and `tests/unit/api/tax-route.test.ts`; remove the three `/api/tax` references from `public-route-hardening.test.ts`'s route list (do not replace with a 404 assertion — the route no longer exists).

## DEBT-02 — remove the `{ DB }`-only fallback

- `lib/services/order-effects.ts:300`: `environment: runtime.giftCardEnvironment ?? (runtime.database ? { DB: runtime.database } : undefined)`.
- Confirmed dead in production traffic today: `lib/services/order-finalization.ts:81,191` call `drainOrderEffects` without `database` or `giftCardEnvironment`, so the fallback resolves to `undefined` in the live path; `fulfillPaidGiftCards` (`gift-card-fulfillment.ts:695`) then does its own `getCloudflareContext({ async: true })` fallback, which is correct. The cron path (`lib/observability/scheduled.ts:63`) always passes the full `giftCardEnvironment: env`. Only tests (`tests/integration/lib/services/order-effects.test.ts:442`) exercise the `{ DB }`-only branch today.
- Why it must still go: `fulfillPaidGiftCards` (`gift-card-fulfillment.ts:688-716`) calls `parseGiftCardDeliveryKeyRing(environment)` (:700) and `parseGiftCardCodeKeyRing(environment)` (:704) *before* any email step — these read `GIFT_CARD_DELIVERY_KEYS_JSON`/`GIFT_CARD_CODE_HMAC_KEYS_JSON` off the environment object and would throw on a `{ DB }`-only object, breaking issuance itself, not just delivery email. `emailEnvironmentFrom`'s own doc comment (:40-50, :543-547) says a `{ DB }`-only object is "strictly worse than handing over nothing."
- Action: `environment: runtime.giftCardEnvironment` (drop the `?? (... ? { DB: ... } : undefined)` clause entirely). Add a source-contract test asserting `order-effects.ts` contains no `{ DB:` object-literal construction.

## DEBT-03 — cart line with an invalid gift note

- `lib/gift-cards/line-identity.ts:70-94` `normalizeCartItemForStore`: catches `parseGiftCardCustomization` throwing, returns `null` (:93) on catch.
- `lib/stores/cart-store.ts:377-404` `migrateCartState`: `items.reduce`, `if (!normalized) return items;` (:395) — silently omits the line from the rebuilt array, no signal recorded.
- Existing precedent: `components/cart/CartItemCard.tsx:25` computes `giftCardLineUnavailable`; `:68-72` renders `<p className="text-xs sm:text-sm text-warning mt-1">No longer available — remove this line to check out.</p>` when true.
- Cart hydration entry point: Zustand `persist` middleware, `migrate: (persistedState) => migrateCartState(persistedState)` (`cart-store.ts:368`).
- No cart-line "edit gift note" UI exists anywhere — notes are set at add-to-cart time on the product page and rendered read-only via `GiftCardRecipientBlock` in the cart. Building inline editing is out of scope.
- Action: `normalizeCartItemForStore` returns the item (customization preserved verbatim, unparsed) with a new `giftCardNoteInvalid: true` field instead of `null` on catch; `migrateCartState` keeps it in the array. `CartItemCard.tsx` renders a warning (same slot/classes as `giftCardLineUnavailable`) when `giftCardNoteInvalid` is true, with copy directing the shopper to remove and re-add the item. Whatever currently gates checkout on `giftCardLineUnavailable` (find it — likely in `CheckoutClient.tsx` or a cart-validity selector) gets the same gate added for `giftCardNoteInvalid`.

## DEBT-04 — split delivery-retry telemetry

- `lib/observability/telemetry.ts:70` `'gift_card.delivery_failed': { severity: 'critical', sampleRate: 1 }` — static, unconditional.
- `:72` `'gift_card.delivery_note_dropped'` is the existing warning-severity template to copy for the new event's shape.
- `workers/observability-tail/src/core.ts:9-37` `TAIL_CRITICAL_EVENTS` includes `'gift_card.delivery_failed'` (:31); `parseEnvelope` (:176-207) pages on `severity === 'critical' && CRITICAL_EVENT_SET.has(event)` only — does not inspect `retryable`.
- `lib/services/gift-card-fulfillment.ts` `recordDeliveryFailure` (:113-127) always emits `gift_card.delivery_failed`; `deliverOne` (:427-516) has three call sites: `:458-460` (code material missing, always terminal, `retryable: false` — correctly stays critical), `:495-500` (post-send failure, `retryable: status !== 'needs_review'` — fires on every failed attempt, not just terminal), `:507-509` (catch block, `retryable: !exhausted` — same issue). `MAX_DELIVERY_ATTEMPTS = 8` (:36).
- Action: new `TELEMETRY_EVENTS` entry `'gift_card.delivery_retry': { severity: 'warning', sampleRate: <match delivery_note_dropped> }`, not added to `TAIL_CRITICAL_EVENTS`. At `:495-500` and `:507-509`, emit `gift_card.delivery_retry` when the outcome is `retryable`/not-exhausted, `gift_card.delivery_failed` only when `exhausted`/`needs_review`. `:458-460` unchanged (already terminal). Update the existing `TAIL_CRITICAL_EVENTS` parity test if one enumerates all `TELEMETRY_EVENTS` and asserts membership.

## DEBT-05 — digital-only cart rule (no code-shape change)

- Client: `lib/checkout/digital-only.ts:34-38` `isDigitalOnlyCart` — every item has `giftCardCustomization !== undefined`. File header (:1-14) already documents why the client can't use `fulfillment_type` (the field doesn't exist on `CartItem`).
- Server: `lib/gift-cards/checkout.ts:52-58` `isGiftCardOrderLine`/`hasPhysicalCheckoutLines` — keyed on `item.fulfillment_type !== 'digital'`.
- Invariant enforced: `checkout-pricing.ts:588-592` — a `giftCardCustomization` can only exist on a `type: 'gift_card'` + `fulfillment_type: 'digital'` + `shipping_required: false` line, so the two predicates cannot disagree today.
- Existing test: `tests/unit/lib/checkout/digital-only.test.ts:88-99` asserts `isDigitalOnlyCart(fixture) === !hasPhysicalCheckoutLines(fixture.orderItems)` across fixtures.
- Action: add a doc-comment cross-reference in both `digital-only.ts` and `checkout.ts` pointing at each other and at the invariant test by name/path, so an edit to either's semantics is flagged for a human to check the other. No behavior change.

## DEBT-06/D-07 — digital-only order billing address and confirmation email

- `app/api/payment-intent/route.ts:392-395`: `shipping_address` nulled for digital-only orders; `billing_address: shippingAddress` (sic — the checkout UI stores the billing-details step's address under the `shippingAddress` state var) is always persisted. **Confirm this persists correctly before changing anything downstream — read the exact lines.**
- `lib/services/order-confirmation.ts:65-69` `buildFulfillmentOrderData`: `const address = order.shipping_address; const addresslessDigitalOrder = extensions.subscription_shipping_required === false; if ((!address && !addresslessDigitalOrder) || !order.id || order.items.length === 0) return null;` — `subscription_shipping_required` is set only by `lib/subscriptions/invoice-service.ts:270` for subscription renewals, never by a plain gift-card checkout.
- Confirmed bug (own test proves it): `tests/unit/lib/services/order-confirmation.test.ts:93-117` — a non-subscription digital-only order resolves `{ success: true, skipped: true }` from `sendOrderConfirmation`. This is the **primary order confirmation email path** (`buildOrderEmailData` → `sendOrderConfirmationEmail`, and `buildMerchantOrderEmailData` → merchant notification — both call `buildFulfillmentOrderData`, so one fix closes both).
- `app/account/orders/[id]/page.tsx:17` `const address = order.shipping_address;` — no fallback; `{address && <section>Shipping address...}` omits the whole section when null.
- Action: replace the `addresslessDigitalOrder` guard with `!hasPhysicalCheckoutLines(order.items)` (import from `lib/gift-cards/checkout.ts`, the DEBT-05 authoritative rule — this also covers the subscription case, since a subscription renewal's items are digital too, so no regression). When `order.shipping_address` is null and the order is digital-only, use `order.billing_address` as the display address in the built order data, and thread a flag/label through so both the email template and `app/account/orders/[id]/page.tsx` render "Billing address" instead of "Shipping address" for that case only. `app/account/orders/[id]/page.tsx:17` becomes `order.shipping_address ?? order.billing_address` with the heading computed accordingly.

## DEBT-07 — windows and docs

- Window #5 (`docs/CLAUDE.md` "local-only" claim): current text at `docs/CLAUDE.md:123` reads "CI-wired"; the `## Testing` section (:201-208) has no "local-only" claim; `.github/workflows/ci.yml:43` runs `npm run scan:tokens`. Fixed by an unrelated Phase 8.2 commit (`1d5d2a2`). **No code change** — close via `gsd-tools windows fixed 5` with a note.
- Window #6 (REQUIREMENTS-wide verify check): lives only in `.planning/milestones/v2-phases/08.1-v2-tech-debt-closure/08.1-07-PLAN.md`, an already-archived plan file, not a reusable pattern anywhere active. **No code change** — close via `windows fixed 6`.
- IN-07 retroactive gift-note question: `.planning/milestones/v2.1-phases/12-content-assistant-live-proof/12-REVIEW-FIX.md:575-581,687-689` — explicitly deferred to "Russell's call." This phase's decision (D-10): ratify the existing behavior (the note is rendered on every send, old or new pending rows alike) as correct — **no code change needed**, `deliverOne` already does this; the action is recording the decision so the window/IN-07 thread is closed rather than perpetually open.
- Migration `0023` duplicate (`.planning/todos/pending/migration-0023-duplicate-number.md`): `migrations/0023_add_order_effects_payload.sql` and `migrations/0023_normalize_tax_category_codes.sql` both exist, both applied in production, `applyD1Migrations` orders by filename (deterministic). Action: `docs/database-migrations.md` gets a paragraph recording the collision and the "never rename an applied migration" rule; `scripts/check-migration-safety.mjs` (find its exact current logic first) gains a check that a new migration's number isn't already used by an existing file, with a unit test (check `tests/` for the script's existing test file, likely `tests/unit/scripts/check-migration-safety.test.ts` or similar — locate it, don't assume the path).

## DEBT-08 — admin Appearance metadata (already done)

- `components/admin/ThemePresetGrid.tsx:180-188` already renders `theme.meta.industry` and `theme.meta.synopsis`, sourced from `lib/themes/manifest.generated.ts`'s `meta: { industry, synopsis }`, generated by `scripts/build-themes.mjs` `parseThemeHeader` (:75-100) parsing each `themes/*.css` file's `/* @theme label: ... | industry: ... | synopsis: ... */` header. Confirmed present in all six theme files (`luxe.css:26`, `atelier.css:38`, `clinical.css:29`, `market.css:59`, `midnight.css:21`, `retro.css:44`, `volt-dark.css:11`).
- Action: **no code change.** Close `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md` and WINDOWS.md entry #2 with a note citing the manifest read as the code-level evidence standing in for the unrun human click-through.

## Validation Architecture

- Framework: vitest. Commands: `mise exec -- npx vitest run <files>` per item; `npm run lint && npm run typecheck && npm run scan:tokens`; `mise exec -- npm test`; `mise exec -- npm run test:workers` (D1/worker-pool tests, if any item needs one — DEBT-02's regression test may be integration-level); `npm run docs:lint`; `npm run check:migrations -- --base origin/main`; `npm run build`.
- Per-requirement test map: DEBT-01 → `public-route-hardening.test.ts` updated, `tax-route.test.ts` deleted; DEBT-02 → new source-contract test on `order-effects.ts`; DEBT-03 → `cart-store`/`line-identity` unit test + `CartItemCard` source contract; DEBT-04 → `telemetry.ts` map test + `gift-card-fulfillment.ts` retry-vs-terminal test; DEBT-05 → existing `digital-only.test.ts` stays green, no new test required; DEBT-06 → `order-confirmation.test.ts` (two new cases: non-subscription digital-only now sends; billing-address fallback used) + account order-detail test; DEBT-07 → migration-collision checker unit test; DEBT-08 → none.
- Wave 0: none — no new D1 migration.

## RESEARCH COMPLETE
