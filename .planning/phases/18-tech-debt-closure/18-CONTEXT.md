# Phase 18: Tech-Debt Closure - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss. Russell was away; grey areas took the recommended, safest answer. Eight DEBT requirements from v2.1's audit, verified fact-by-fact against the current codebase before deciding what each actually needs (three of the eight turned out to be partially or fully already satisfied).

<domain>
## Phase Boundary

Close DEBT-01..08: the orphaned `/api/tax` route, the gift-card delivery env fallback that could silently degrade issuance, a cart line that vanishes instead of asking the shopper to fix it, delivery-retry telemetry that pages on every attempt instead of only terminal failure, the client/server digital-only-cart rule, a digital-only order's billing address and confirmation email, three broken-windows doc/test entries, and the admin Appearance theme metadata (already done, confirm only). No feature work beyond what closes these eight.
</domain>

<decisions>
## Implementation Decisions

### DEBT-01: `/api/tax` — delete, not wire up
- **D-01:** `app/api/tax/route.ts` has zero real callers (grep across `app/`, `components/`, `lib/` found only its own two test files) and its logic actively diverges from the authoritative `lib/services/checkout-pricing.ts` (a different hardcoded fallback rate, a single hardcoded Stripe tax code with no gift-card exemption). It is deleted along with `tests/unit/api/tax-route.test.ts`; `tests/unit/app/api/public-route-hardening.test.ts`'s three references to it are removed from that test's route list, not left asserting against a 404. `docs/` gets no new "why we deleted this" doc — the git history and this phase's SUMMARY are the record.

### DEBT-02: gift-card delivery env fallback
- **D-02:** `lib/services/order-effects.ts:300`'s `runtime.giftCardEnvironment ?? (runtime.database ? { DB: runtime.database } : undefined)` fallback is removed entirely; the expression becomes `runtime.giftCardEnvironment` (no `{ DB }`-only construction ever happens). `fulfillPaidGiftCards`'s own `getCloudflareContext` fallback already handles the "no full env supplied" case correctly (this is what actually runs in production today, since no live caller currently passes `database` without `giftCardEnvironment`) — this change removes a landmine, not a live bug. Add a regression test asserting `order-effects.ts` never constructs an object with `DB` as its only key.

### DEBT-03: cart line with an invalid gift note
- **D-03:** `lib/gift-cards/line-identity.ts` `normalizeCartItemForStore` stops returning `null` on a `parseGiftCardCustomization` throw. It instead returns the item with the customization preserved as-is plus a new `giftCardNoteInvalid: true` flag (mirroring the shape of the existing `giftCardLineUnavailable` signal `CartItemCard.tsx` already reads). `migrateCartState` keeps the line in the array. `CartItemCard.tsx` renders a warning in the same visual slot as `giftCardLineUnavailable` ("This gift note can no longer be sent — remove this line and add the item again to fix it.") when `giftCardNoteInvalid` is true. There is no inline note-editing UI in the cart today (notes are set at add-to-cart time on the product page) and building one is out of scope for a tech-debt phase — "asked to fix it" means an actionable, visible prompt to remove-and-re-add, the same remediation path `giftCardLineUnavailable` already uses, not a new edit flow. Checkout continues to block on this line the same way it blocks on `giftCardLineUnavailable` (Claude's discretion on the exact block mechanism — mirror whatever gates checkout today for that flag).

### DEBT-04: delivery-retry telemetry
- **D-04:** New event `gift_card.delivery_retry` (warning severity, sampleRate matching the existing `gift_card.delivery_note_dropped` warning entry in `lib/observability/telemetry.ts`'s `TELEMETRY_EVENTS`) — not in `TAIL_CRITICAL_EVENTS`, so it never pages. `lib/services/gift-card-fulfillment.ts` `recordDeliveryFailure`'s two non-terminal call sites (`deliverOne`'s post-send-failure branch, `:495-500`, and the catch block, `:507-509`) emit `gift_card.delivery_retry` when `retryable`/not-exhausted, and continue to emit `gift_card.delivery_failed` (critical) only for the code-material-missing case (`:458-460`, already terminal) and whenever `exhausted`/`needs_review` is reached. The `retryable` field stays on both events for continuity. Update the `TAIL_CRITICAL_EVENTS` parity test and `workers/observability-tail/src/core.ts` if it enumerates event names anywhere that would need the new one added to a non-critical list.

### DEBT-05: digital-only cart rule — documented equivalence, not literal code sharing
- **D-05 (Claude's call, recorded for Russell):** The client (`lib/checkout/digital-only.ts` `isDigitalOnlyCart`, keyed on "every line has a gift-card customization") and server (`lib/gift-cards/checkout.ts` `hasPhysicalCheckoutLines`, keyed on `fulfillment_type`) use different signals because the client `CartItem` type does not carry `fulfillment_type` at all — plumbing it through would mean widening the product-to-cart data flow, a materially bigger change than "tech-debt closure" scope. Today the two signals cannot disagree (`checkout-pricing.ts` enforces that a `giftCardCustomization` can only exist on a `type: 'gift_card'`/`fulfillment_type: 'digital'` line), and a paired-invariant test (`tests/unit/lib/checkout/digital-only.test.ts`) already proves `isDigitalOnlyCart(items) === !hasPhysicalCheckoutLines(items)` across fixtures. This phase strengthens rather than replaces that: the invariant test gets a cross-reference doc comment in **both** files pointing at each other and at the test, so an edit to one that breaks the equivalence fails CI immediately instead of drifting silently — this is what "pinned by a test" already means for this rule and is treated as DEBT-05's completion, not a rewrite. If Russell wants literal single-function sharing later, that is a bigger refactor (plumb `fulfillment_type` to the client), logged as a Phase 19+ or future-milestone todo, not done here.

### DEBT-06: digital-only order billing address
- **D-06:** `app/api/payment-intent/route.ts` already persists `billing_address` on every order (digital-only included) — that part already works. The bug is entirely on the read side: `lib/services/order-confirmation.ts` `buildFulfillmentOrderData`'s guard (`extensions.subscription_shipping_required === false`) only recognizes subscription-renewal digital orders as legitimately addressless, so a plain gift-card-only order (no subscription involved) has `address` null and `addresslessDigitalOrder` false, and the function returns `null` — **the order-confirmation and merchant-notification emails are silently skipped entirely for non-subscription digital-only orders** (confirmed by the existing test `tests/unit/lib/services/order-confirmation.test.ts` asserting `{ success: true, skipped: true }`). Fix: replace the subscription-specific flag check with the general, already-authoritative `hasPhysicalCheckoutLines(order.items) === false` (`lib/gift-cards/checkout.ts`, the DEBT-05 server rule) as the "this order is legitimately addressless" signal, so it covers gift-card-only orders too, not just subscription ones. When `address` is null but the order is digital-only, `buildFulfillmentOrderData` uses `order.billing_address` in place of `shipping_address` for display, and the built order-data's address section is labeled "Billing address" (email template and `app/account/orders/[id]/page.tsx`'s section heading both change from "Shipping address" to "Billing address" only when `order.shipping_address` is null and `order.billing_address` is present — a physical order's shipping address display is unchanged).
- **D-07:** `app/account/orders/[id]/page.tsx` gets the same address-source fallback: `const address = order.shipping_address ?? order.billing_address;` with the section heading computed from which one was actually used.

### DEBT-07: broken windows and doc hygiene
- **D-08:** Window #5 (`docs/CLAUDE.md` "scan:tokens is local-only") is stale-but-already-fixed by unrelated Phase 8.2 doc work (confirmed: the current text says "CI-wired", `.github/workflows/ci.yml` runs it). No code change; close the window with `windows fixed 5` and a note citing the confirming read.
- **D-09:** Window #6 (the REQUIREMENTS-wide "zero unchecked" verify check) lived only in an already-archived Phase 8.1 plan file (`.planning/milestones/v2-phases/08.1-v2-tech-debt-closure/08.1-07-PLAN.md`) and is not a reusable pattern anywhere active. No code change; close the window with `windows fixed 6` and a note.
- **D-10 (needs Russell's confirmation — flagged, not silently decided):** The retroactive-note question from Phase 12's `IN-07` (do gift-card deliveries that were still `pending`/`needs_review` from before the gift-note-rendering fix, `48b2e42`, retroactively pick up and send the buyer's note on their next drain, or should that be suppressed since the buyer wrote the note when it was never going to be sent?) is a genuine open product decision Phase 12's own review explicitly declined to make unilaterally. This phase's default, safest answer: **send the note** — the buyer's intent was always to include it, the delivery was simply delayed, and a delivery that goes out today with the note attached matches what the buyer asked for; the alternative (suppressing it) requires distinguishing "old" from "new" pending deliveries by a timestamp cutoff, which is more code for a worse default (a note the buyer wrote just silently never appears). This phase does **not** need a code change for this — `deliverOne` already renders the note on every send, including for old pending rows, which *is* "send the note." The decision here is to explicitly ratify that existing behavior as correct rather than build suppression logic, and record it so `IN-07`'s retroactive half is closed rather than perpetually open. Logged in the milestone decisions for Russell to override if he disagrees.
- **D-11 (adjacent hygiene, same "docs/tests match code" spirit, from the Phase 14 planning scout's own todo):** `docs/database-migrations.md` records the `0023` duplicate-number collision (`0023_add_order_effects_payload.sql` / `0023_normalize_tax_category_codes.sql`, both applied in production, ordering is deterministic by filename) and the rule that neither gets renamed. `scripts/check-migration-safety.mjs` (the `check:migrations` gate) gains a check that refuses a new migration file reusing an already-used number, with a unit test using a fixture pair. This closes `.planning/todos/pending/migration-0023-duplicate-number.md`.

### DEBT-08: admin Appearance theme metadata — already done
- **D-12:** `components/admin/ThemePresetGrid.tsx` already renders `theme.meta.industry` and `theme.meta.synopsis` from `lib/themes/manifest.generated.ts`, itself generated from each `themes/*.css` file's `@theme` header comment by `scripts/build-themes.mjs`. Confirmed present for all six theme files. No code change. This phase closes `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md` and WINDOWS.md entry #2 (the unrun human-check — closed via the same code-level-evidence convention this whole run has used: the manifest data and the component's render logic are read directly, standing in for the click-through).

### UI design contract
- **D-13:** Every visual change (the cart-line warning, the address-section label swap) reuses existing token classes and an existing pattern (`giftCardLineUnavailable`'s warning slot, the account order-detail address section). Planning runs with `--skip-ui`, the same call as Phases 9, 12, 13, 14, and 16.

### Tests
- **D-14:** Tests per item: DEBT-01 — `public-route-hardening.test.ts` updated, no test asserts `/api/tax` exists; DEBT-02 — a test on `order-effects.ts` proving no `{ DB }`-only object is ever constructed; DEBT-03 — a cart-migration test with a pre-existing invalid-note item proving the line survives with `giftCardNoteInvalid: true`, plus a `CartItemCard` source-contract test for the warning; DEBT-04 — telemetry event-map test plus a `deliverOne` test proving a non-terminal failure emits `gift_card.delivery_retry` not `gift_card.delivery_failed`; DEBT-05 — the existing invariant test kept green, doc comments added; DEBT-06 — `order-confirmation.test.ts` cases for a non-subscription digital-only order (email now sends) and the billing-address fallback, plus an account-order-detail test for the label swap; DEBT-07 — a migration-number-collision unit test on the checker; DEBT-08 — no new test (already covered).

### Claude's Discretion
- Exact wording of the cart-line and account-page copy.
- Whether the migration-collision check lives in `scripts/check-migration-safety.mjs` directly or a small extracted helper (recommended: inline, matching the script's existing style).
</decisions>

<specifics>
## Specific Ideas

- Roadmap: "no orphaned tax route, no silently degrading gift-card delivery, no cart line dropped without telling the shopper, and docs that say what the code does."
- v2.1 audit is the source of DEBT-01..08; three (04's telemetry split, 06's silently-skipped email, and the migration collision) turned out to be more consequential than their one-line descriptions suggested — surfaced explicitly rather than minimized.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DEBT-01
- `app/api/tax/route.ts`, `tests/unit/api/tax-route.test.ts`, `tests/unit/app/api/public-route-hardening.test.ts`
- `lib/services/checkout-pricing.ts` (`NONTAXABLE_TAX_CODE`, the real tax path ~680-780) — the authoritative service, unchanged

### DEBT-02
- `lib/services/order-effects.ts:300` (the fallback to remove), `lib/services/order-finalization.ts` (confirms no live caller is affected)
- `lib/services/gift-card-fulfillment.ts` `fulfillPaidGiftCards`, `emailEnvironmentFrom` (~40-86), `parseGiftCardDeliveryKeyRing`/`parseGiftCardCodeKeyRing`
- `lib/observability/scheduled.ts` (the cron path, already correct — untouched)

### DEBT-03
- `lib/gift-cards/line-identity.ts` `normalizeCartItemForStore` (~70-94)
- `lib/stores/cart-store.ts` `migrateCartState` (~377-404)
- `components/cart/CartItemCard.tsx` (`giftCardLineUnavailable` ~25, ~68-72) — the pattern to mirror

### DEBT-04
- `lib/observability/telemetry.ts` `TELEMETRY_EVENTS` (`gift_card.delivery_failed` ~70, `gift_card.delivery_note_dropped` ~72 as the warning-severity template)
- `workers/observability-tail/src/core.ts` `TAIL_CRITICAL_EVENTS` (~9-37), `parseEnvelope` (~176-207)
- `lib/services/gift-card-fulfillment.ts` `recordDeliveryFailure` (~113-127), `deliverOne` (~427-516, three call sites at ~458-460, ~495-500, ~507-509), `MAX_DELIVERY_ATTEMPTS`

### DEBT-05
- `lib/checkout/digital-only.ts` `isDigitalOnlyCart`, `lib/gift-cards/checkout.ts` `isGiftCardOrderLine`/`hasPhysicalCheckoutLines`
- `tests/unit/lib/checkout/digital-only.test.ts` — the existing invariant test to strengthen with doc comments

### DEBT-06/07 (address)
- `lib/services/order-confirmation.ts` `buildFulfillmentOrderData` (~65-69), `buildOrderEmailData`, `buildMerchantOrderEmailData`, `sendOrderConfirmation`
- `app/api/payment-intent/route.ts` (~392-397, where `billing_address` is already persisted — confirm, do not change)
- `app/account/orders/[id]/page.tsx` (~17, the address read to fallback)
- `tests/unit/lib/services/order-confirmation.test.ts` (the existing `{ success:true, skipped:true }` test that proves the bug — becomes a "now sends" test)

### DEBT-07 (docs)
- `.planning/WINDOWS.md` entries #5, #6 — close via `windows fixed`
- `.planning/milestones/v2.1-phases/12-content-assistant-live-proof/12-REVIEW-FIX.md` (~575-581, ~687-689) — IN-07's retroactive half, ratified not re-decided
- `docs/database-migrations.md`, `scripts/check-migration-safety.mjs`, `.planning/todos/pending/migration-0023-duplicate-number.md`

### DEBT-08
- `components/admin/ThemePresetGrid.tsx` (~180-188), `lib/themes/manifest.generated.ts`, `scripts/build-themes.mjs` `parseThemeHeader` (~75-100)
- `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md`, `.planning/WINDOWS.md` entry #2

### Locked
- No change to `lib/gift-cards/repository.ts`, reservation/settlement/release semantics, or any Phase 13-17 flag/honor-guard/customer-binding logic — this phase only touches the eight named items.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hasPhysicalCheckoutLines` is already the authoritative "is this order digital-only" server-side check — DEBT-06's fix reuses it rather than inventing a second one.
- `giftCardLineUnavailable`'s warning-slot pattern in `CartItemCard.tsx` is the exact UI shape DEBT-03 needs.
- The `gift_card.delivery_note_dropped` warning-severity telemetry entry is the exact template for DEBT-04's new event.

### Established Patterns
- Non-critical telemetry events omit themselves from `TAIL_CRITICAL_EVENTS`; a parity test enforces the taxonomy stays closed.
- `.planning/WINDOWS.md` entries close via `windows fixed <id>` with a note, not by deleting the row.

### Integration Points
- `order-effects.ts`'s gift-card branch is the single call site for DEBT-02; no other caller constructs a partial env.
- `buildFulfillmentOrderData` is shared by both the customer confirmation and merchant notification emails — one fix closes both.
</code_context>

<deferred>
## Deferred Ideas

- Plumbing `fulfillment_type` onto client cart items to let DEBT-05 become one literally-shared function (D-05's noted future option).
- An inline "edit gift note" UI in the cart drawer (DEBT-03's deeper fix, out of scope for tech-debt closure).
- Consolidating `payment_customers`/`subscription_provider_customers` (Phase 17's D-02, already logged as its own todo — not this phase).
</deferred>

---

*Phase: 18-tech-debt-closure*
*Context gathered: 2026-09-11 autonomously; D-10 (retroactive gift-note behavior) is a product decision ratified by default, flagged for Russell to override*
