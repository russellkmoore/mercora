# Phase 10: Gift Card Purchase Flow - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — Russell accepted all recommended answers across three areas

<domain>
## Phase Boundary

A shopper on `/product/gift-card` fills a recipient form (email required; name, message, delivery date optional), adds the customised line to the cart, and carries those details unaltered through the cart drawer, the checkout order summary, the order confirmation, and the account order detail page. An all-digital cart skips the shipping address and shipping method steps. Line identity, server validation, pricing, tender, issuance and delivery already exist (PR #79, ADR-CTB-10) and are not changed; this phase is storefront UI plus the additive per-field validators it needs (SHOP-01..SHOP-06).

Not in this phase: production flags and key secrets (Phase 11); the support article, Volt re-index, Terms section and the live paid-order proof SHOP-07 (Phase 12); scheduled delivery (SHOP-08), custom amounts (SHOP-09), a Gift Cards category (CAT-05); any change to `lib/gift-cards/` money paths (tender, reservation, issuance, refunds); any change to `/api/payment-intent`, `/api/orders`, the webhook, or `lib/services/checkout-pricing.ts`.

</domain>

<decisions>
## Implementation Decisions

### Digital-only checkout (SHOP-06)
- **D-01:** An all-digital cart replaces the Shipping Address step with a slim **Contact** step (name, email, country, postal code). The client posts those values in the existing `shippingAddress` slot of `POST /api/payment-intent` and sends `shippingMethodId: "digital"`; the Shipping Method step is skipped entirely. The server route, `checkout-pricing.ts` (which already prices digital-only carts with the `digital` method and $0 shipping and stores `shipping_address: null`) and ADR-CTB stay untouched. — **Reversibility:** reversible — client-only; relaxing the route later is a separate decision.
- **D-02:** The checkout progress bar derives its steps from the cart: digital-only shows Contact → Payment → Confirmation; any cart with a physical line keeps the existing four labels. Mixed carts are byte-identical to today (SHOP-06).
- **D-03:** On the Contact step a signed-in shopper's name and email are prefilled from Clerk and remain editable; guests type them.
- **D-04:** The order summary shows whatever tax the server quote returns for a gift-card-only cart (expected $0.00 under `txcd_00000000`); no client special-casing or hiding of the tax line.

### Recipient form on the product page (SHOP-01, SHOP-02, SHOP-03)
- **D-05:** The recipient form is an inline block under the amount `Select` on the product page, rendered when `product.type === 'gift_card'` (data-keyed; the template never learns a slug or id). It replaces the plain Add to Cart button; Add to Cart stays disabled until the form is valid.
- **D-06:** Client and server share one rule set: `lib/gift-cards/customization.ts` gains exported **per-field validators** (email, name, message, delivery date) that wrap the existing normalisers and return a field-level error code, and `parseGiftCardCustomization` stays the whole-object gate. The form calls the per-field validators for inline errors. This is an additive, non-money change to a validation module and is explicitly allowed; the tender/reservation/issuance/refund paths are not touched. — **Reversibility:** reversible.
- **D-07:** Delivery date is an optional native date input, min today, max one year out, with honest helper text: delivery is by email as soon as payment completes and the date is recorded on the card (scheduled delivery is SHOP-08, deferred). The value is stored as canonical `YYYY-MM-DD` exactly as the server expects.
- **D-08:** "Send to myself" is a checkbox shown only when Clerk reports `isSignedIn`; ticking it fills recipient email from the primary email address and recipient name from `fullName`; the fields stay editable afterwards. Guests never see the control.
- **D-09:** Add to Cart submits `giftCardCustomization` on the cart item exactly as `parseGiftCardCustomization` would normalise it (trimmed, NFC, lower-cased email, absent optional keys omitted), so the cart's `sameCartLineFacts` merge behaves per SHOP-04 with no cart-store change.

### Recipient details across cart, checkout, confirmation, account (SHOP-04, SHOP-05)
- **D-10:** One small shared presentational component renders the recipient block — "To: {name} <{email}>" (or email alone), "Deliver: {date}" when set, and the message truncated to about 80 characters with an ellipsis — and is used by `components/cart/CartItemCard.tsx` and `components/checkout/OrderItemCard.tsx`, replacing their current one-line "For …" text.
- **D-11:** The order confirmation modal gains an items list; gift-card lines show the full recipient block. Data comes from the pending-checkout payload / `POST /api/orders` response already available on the success page; no new API.
- **D-12:** `app/account/orders/[id]/page.tsx` renders the persisted `item.gift_card` block (name, email, message, delivery date) under each gift-card item, server-rendered from the order record.
- **D-13:** Recipient details are not editable from the cart in this phase: the shopper removes the line and re-adds it. Line identity is derived from the customization, so an edit is a new line by construction. Recorded as a deferred idea.

### Carried forward
- Phase 9 D-12 interim (live product with the physical add-to-cart) ends when this phase ships; Phase 9 D-08 name "Voltique Gift Card" and the amount-select behaviour stay.
- Storefront changes render through the 23-token classes only (`npm run scan:tokens` in CI); the admin palette is untouched.

### Claude's Discretion
- Exact copy for labels, helper text, error messages, and the Contact step heading; where the Contact step stores its values in the cart store (reuse `setShippingAddress` with the slim record is acceptable).
- Whether the recipient form is a new `components/product/GiftCardRecipientForm.tsx` or lives inside `ProductDisplay.tsx`; the shared block's file name and props.
- Test strategy: unit tests for the per-field validators and the form's validity gating, a render test for the shared recipient block, a cart-store test for merge-vs-separate lines with two customizations, and a CheckoutClient test for step derivation (digital-only vs mixed). Existing patterns: `tests/unit/components/*.test.ts` source-contract tests and vitest.
- Whether the cart drawer shows a quantity stepper for gift-card lines (merging increments quantity today; keeping the stepper is fine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gift card contract (locked)
- `docs/checkout-trust-boundary.md` — ADR-CTB and ADR-CTB-10: server recomputes all pricing; gift cards are an optional capability; the browser asserts nothing about money.
- `lib/gift-cards/customization.ts` — `parseGiftCardCustomization`, `canonicalGiftCardCustomization`, the limits (254/100/500), email regex, control-character ban, `YYYY-MM-DD` date rule. D-06 adds per-field validators here.
- `lib/gift-cards/line-identity.ts` — `normalizeCartItemForStore`, `sameCartLineFacts`, `createCartLineId`, `projectCartLineForCheckout`: line identity already includes the customization (SHOP-04 is satisfied by data, not new code).
- `lib/gift-cards/checkout.ts` — `isGiftCardOrderLine`, `hasPhysicalCheckoutLines`.
- `lib/types/cartitem.ts` — `GiftCardCustomization`, `CartItem.giftCardCustomization`; `lib/types/order.ts` — `OrderItem.gift_card` (persisted, never a bearer code).

### Checkout surfaces (read, do not change server contracts)
- `app/api/payment-intent/route.ts` (lines ~85–110) — requires a normalised `shippingAddress` and a bounded `shippingMethodId`; stores `shipping_address: null` and `shipping_method: null` when no physical lines. D-01 works inside this contract.
- `lib/services/checkout-pricing.ts` (lines ~600–640) — `shippingMethod = { id: 'digital', label: 'Digital delivery' }` when no physical lines; tax still needs the address.
- `components/checkout/CheckoutClient.tsx`, `ShippingForm.tsx`, `ShippingOptions.tsx`, `ProgressBar.tsx`, `OrderSummary.tsx`, `OrderItemCard.tsx`, `OrderConfirmationModal.tsx`, `app/checkout/success/page.tsx`, `lib/checkout/order-payload.ts` — the step machine and the surfaces D-01/D-02/D-10/D-11 change.
- `lib/stores/cart-store.ts` — zustand cart with `addItem` merge via `sameCartLineFacts`; `setShippingAddress`.

### Product page and account
- `app/product/[slug]/ProductDisplay.tsx` — amount `Select`, add-to-cart block (D-05 replaces it for gift cards); `components/cart/CartItemCard.tsx` (D-10).
- `app/account/orders/[id]/page.tsx` and `lib/models/mach/orders.ts` (`getOrderByCustomerAndId`) — D-12.
- Clerk: `useUser` from `@clerk/nextjs` (see `components/agent/AgentDrawer.tsx`) — D-03, D-08.

### Milestone framing
- `.planning/REQUIREMENTS.md` — SHOP-01..SHOP-06; SHOP-07 is Phase 12; SHOP-08/09 deferred.
- `.planning/ROADMAP.md` §"Phase 10" — success criteria; `**UI hint**: yes` (a UI-SPEC is generated before planning).
- `.planning/phases/09-gift-card-catalogue/09-CONTEXT.md` — Phase 9 decisions (D-08 name, D-12 interim) and the live product this phase builds against.
- `docs/theming.md` — token contract for every new storefront element.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Server-side validation and normalisation for the whole customization object already exists and is the single source of truth (`parseGiftCardCustomization`); the constants for the caps are exported.
- Cart line identity and merging already account for the customization; `normalizeCartItemForStore` re-validates on every add.
- `CartItemCard` and `OrderItemCard` already render a one-line "For {name|email}" (and the delivery date on the cart line); they are the seams D-10 upgrades.
- `checkout-pricing.ts` already prices digital-only carts with a `digital` method and zero shipping; `payment-intent` already nulls `shipping_address`/`shipping_method` on the persisted order for such carts.
- `OrderItem.gift_card` is persisted on paid orders, so the account order page has the data it needs (D-12).
- Clerk `useUser()` is already used client-side (`AgentDrawer.tsx`) for name/email.

### Established Patterns
- Data-keyed rendering: components branch on `product.type` / `fulfillment_type`, never on ids or slugs (Phase 9 D-04 rationale).
- Storefront is token-only (`bg-surface-elevated`, `text-muted-foreground`, `text-primary`, `text-danger` …); shadcn primitives under `components/ui/` (Dialog, Select, Button).
- Checkout is a client step machine (`CheckoutStep = 'shipping' | 'payment' | 'confirmation'`) in `CheckoutClient.tsx`; the server quote is authoritative for money (`authoritativeQuote` in `OrderSummary`).
- Tests: vitest under `tests/unit/`; component "source contract" tests (e.g. `cart-line-source.test.ts`, `order-card-source.test.ts`) assert on file contents and pure helpers rather than DOM rendering; pure-function tests for `lib/`.
- Commands run with `mise exec --`; gates: lint, typecheck, cf-typecheck, unit tests, scan:tokens, build.

### Integration Points
- `ProductDisplay.tsx` add-to-cart block → recipient form (D-05) → `useCartStore.getState().addItem({..., giftCardCustomization})`.
- `CheckoutClient.tsx` step derivation from `items` (any `fulfillment_type`/gift-card line check via the cart items' `giftCardCustomization` presence or a product-type lookup already available on the item) → Contact step (D-01) → `POST /api/payment-intent` with the slim address and `shippingMethodId: 'digital'`.
- `ProgressBar.tsx` labels (D-02); `OrderSummary`/`OrderItemCard` (D-10); `OrderConfirmationModal` + success page (D-11); `app/account/orders/[id]/page.tsx` (D-12).

</code_context>

<specifics>
## Specific Ideas

- Russell's live observation (2026-09-08): with only a gift card in the cart, checkout still shows shipping options. This phase removes that: an all-digital cart must never show the Shipping Address or Shipping Method steps (D-01, D-02).
- Copy on the delivery-date field must be honest about immediate email delivery (D-07); nothing in the storefront may promise scheduled delivery until SHOP-08 ships.
- No template code may reference the gift card's id or slug; everything keys off `product.type` / `fulfillment_type` / the presence of `giftCardCustomization`.

</specifics>

<deferred>
## Deferred Ideas

- In-cart editing of recipient details (D-13) — would need an edit affordance that replaces the line; revisit after Phase 12.
- Relaxing `/api/payment-intent` to accept a minimal contact record for digital-only carts (alternative to D-01) — a checkout-route change with its own ADR discussion.
- Scheduled delivery honouring the delivery date (SHOP-08), custom amounts (SHOP-09), Gift Cards category (CAT-05) — already tracked in REQUIREMENTS.md v2.

</deferred>

---

*Phase: 10-gift-card-purchase-flow*
*Context gathered: 2026-09-08*
