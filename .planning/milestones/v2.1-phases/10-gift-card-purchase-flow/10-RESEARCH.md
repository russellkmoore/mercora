# Phase 10: Gift Card Purchase Flow - Research

**Researched:** 2026-09-08
**Domain:** Next.js/React storefront checkout flow — client-side form validation, Clerk client auth, Zustand cart persistence, Stripe checkout step machine
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Digital-only checkout (SHOP-06)**
- **D-01:** An all-digital cart replaces the Shipping Address step with a **Billing details** step: the existing address form (name, email, line1, line2, city, region, postal code, country) relabelled for billing, because `normalizeAddress` in `app/api/payment-intent/route.ts` requires non-empty `line1`, `city`, `region`, `postal_code` and `country` and Stripe Tax is called with that address. The client posts it in the existing `shippingAddress` slot and sends `shippingMethodId: "digital"`; the Shipping Method step is skipped entirely. The server route, `checkout-pricing.ts` (which already prices digital-only carts with the `digital` method, $0 shipping, and stores `shipping_address: null`) and ADR-CTB stay untouched. Russell chose this over relaxing the route or sending placeholder address fields (2026-09-08). — **Reversibility:** reversible — client-only; relaxing the route later is a separate decision.
- **D-02:** The checkout progress bar derives its steps from the cart: digital-only shows Billing details → Payment → Confirmation; any cart with a physical line keeps the existing four labels. Mixed carts are byte-identical to today (SHOP-06).
- **D-03:** On the Billing details step a signed-in shopper's name and email are prefilled from Clerk and remain editable; guests type them.
- **D-04:** The order summary shows whatever tax the server quote returns for a gift-card-only cart (expected $0.00 under `txcd_00000000`); no client special-casing or hiding of the tax line.

**Recipient form on the product page (SHOP-01, SHOP-02, SHOP-03)**
- **D-05:** The recipient form is an inline block under the amount `Select` on the product page, rendered when `product.type === 'gift_card'` (data-keyed; the template never learns a slug or id). It replaces the plain Add to Cart button; Add to Cart stays disabled until the form is valid.
- **D-06:** Client and server share one rule set: `lib/gift-cards/customization.ts` gains exported **per-field validators** (email, name, message, delivery date) that wrap the existing normalisers and return a field-level error code, and `parseGiftCardCustomization` stays the whole-object gate. The form calls the per-field validators for inline errors. This is an additive, non-money change to a validation module and is explicitly allowed; the tender/reservation/issuance/refund paths are not touched. — **Reversibility:** reversible.
- **D-07:** Delivery date is an optional native date input, min today, max one year out, with honest helper text: delivery is by email as soon as payment completes and the date is recorded on the card (scheduled delivery is SHOP-08, deferred). The value is stored as canonical `YYYY-MM-DD` exactly as the server expects.
- **D-08:** "Send to myself" is a checkbox shown only when Clerk reports `isSignedIn`; ticking it fills recipient email from the primary email address and recipient name from `fullName`; the fields stay editable afterwards. Guests never see the control.
- **D-09:** Add to Cart submits `giftCardCustomization` on the cart item exactly as `parseGiftCardCustomization` would normalise it (trimmed, NFC, lower-cased email, absent optional keys omitted), so the cart's `sameCartLineFacts` merge behaves per SHOP-04 with no cart-store change.

**Recipient details across cart, checkout, confirmation, account (SHOP-04, SHOP-05)**
- **D-10:** One small shared presentational component renders the recipient block — "To: {name} <{email}>" (or email alone), "Deliver: {date}" when set, and the message truncated to about 80 characters with an ellipsis — and is used by `components/cart/CartItemCard.tsx` and `components/checkout/OrderItemCard.tsx`, replacing their current one-line "For …" text.
- **D-11:** The order confirmation modal gains an items list; gift-card lines show the full recipient block. Data comes from the pending-checkout payload / `POST /api/orders` response already available on the success page; no new API.
- **D-12:** `app/account/orders/[id]/page.tsx` renders the persisted `item.gift_card` block (name, email, message, delivery date) under each gift-card item, server-rendered from the order record.
- **D-13:** Recipient details are not editable from the cart in this phase: the shopper removes the line and re-adds it. Line identity is derived from the customization, so an edit is a new line by construction. Recorded as a deferred idea.

**Carried forward**
- Phase 9 D-12 interim (live product with the physical add-to-cart) ends when this phase ships; Phase 9 D-08 name "Voltique Gift Card" and the amount-select behaviour stay.
- Storefront changes render through the 23-token classes only (`npm run scan:tokens` in CI); the admin palette is untouched.

### Claude's Discretion
- Exact copy for labels, helper text, error messages, and the Billing details step heading; the step stores its values through the existing `setShippingAddress` so the payment step and pending-checkout payload need no change.
- Whether the recipient form is a new `components/product/GiftCardRecipientForm.tsx` or lives inside `ProductDisplay.tsx`; the shared block's file name and props.
- Test strategy: unit tests for the per-field validators and the form's validity gating, a render test for the shared recipient block, a cart-store test for merge-vs-separate lines with two customizations, and a CheckoutClient test for step derivation (digital-only vs mixed). Existing patterns: `tests/unit/components/*.test.ts` source-contract tests and vitest.
- Whether the cart drawer shows a quantity stepper for gift-card lines (merging increments quantity today; keeping the stepper is fine).

### Deferred Ideas (OUT OF SCOPE)
- In-cart editing of recipient details (D-13) — would need an edit affordance that replaces the line; revisit after Phase 12.
- Relaxing `/api/payment-intent` to accept a minimal contact record (name, email, country, postal code) for digital-only carts, and a slim Contact step — the alternative to D-01 Russell declined on 2026-09-08; a checkout-route change with its own ADR discussion.
- Scheduled delivery honouring the delivery date (SHOP-08), custom amounts (SHOP-09), Gift Cards category (CAT-05) — already tracked in REQUIREMENTS.md v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | On a gift card product page the shopper sees a recipient form (recipient email required; recipient name, message, and delivery date optional) in place of the physical-product add-to-cart controls | Pattern: `GiftCardRecipientForm` (D-05) gated on `product.type === 'gift_card'`, confirmed field present and public via `WireProduct = Omit<Product, 'variants'>` in `lib/models/mach/product-serializer.ts`. Test: `gift-card-recipient-form-source.test.ts` |
| SHOP-02 | The form validates client-side with the same limits the server enforces (email format, 254/100/500 character caps, no control characters) and shows field-level errors; add to cart stays disabled until the form is valid | Pattern 1: additive per-field validators wrapping the existing private normalisers in `lib/gift-cards/customization.ts` (exact current code read and quoted). Test: extend `customization.test.ts` + new form source test |
| SHOP-03 | A signed-in shopper can choose "Send to myself", which fills the recipient email and name from their account; guests do not see the option | Clerk `useUser()` confirmed via Context7 (`isLoaded`/`isSignedIn`/`user`) and existing codebase precedent (`components/agent/AgentDrawer.tsx:39,71`). Field paths flagged `[ASSUMED]` (A1/A2 in Assumptions Log) |
| SHOP-04 | Adding to cart creates a line that carries the recipient customization; two gift cards for different recipients stay as separate lines, the same recipient and denomination merge into one line | Already fully implemented and tested — `lib/gift-cards/line-identity.ts` + `tests/unit/lib/stores/cart-store-lines.test.ts` (read in full, proves this exact behavior today). No cart-store change needed (D-09) |
| SHOP-05 | The recipient name, email, message, and delivery date are visible on the cart item, the checkout order summary, the order confirmation, and the account order detail page | Pattern: shared `GiftCardRecipientBlock` (D-10) used by `CartItemCard.tsx`/`OrderItemCard.tsx`; snapshot-before-`clearCart()` pattern for `OrderConfirmationModal` (D-11, both call sites cited); direct read of persisted `order.items[].gift_card` for account detail (D-12, `hydrateOrder` confirmed) |
| SHOP-06 | When every line in the cart is digital, web checkout hides the shipping address and shipping method steps and submits the order without an address; carts that also hold physical items are unchanged | Pattern 2/3/4: `ShippingForm` reused with two optional props (D-01), `isDigitalOnly` boolean derived from `giftCardCustomization` presence (no `fulfillment_type` on `CartItem`, confirmed), `/api/shipping-options` fetch skipped, `ProgressBar` optional `steps?` prop (D-02) |

</phase_requirements>

## Summary

This phase is almost entirely a storefront UI change layered on server contracts that already exist and are locked. Every piece of server-side logic this phase depends on — `parseGiftCardCustomization`, cart line identity/merge (`normalizeCartItemForStore`/`sameCartLineFacts`), digital-only pricing (`checkout-pricing.ts`), and `OrderItem.gift_card` persistence — is already shipped, already tested, and already correct. Phase 10's job is to (1) build a recipient form on the gift-card product page that gates Add to Cart on the same rules the server enforces, (2) surface the already-carried recipient data on four read surfaces (cart, checkout summary, confirmation, account detail), and (3) make checkout skip two steps for an all-digital cart by relabeling and reusing `ShippingForm` rather than building a new form.

The single biggest risk in this phase is not code complexity — it's scope discipline. `CheckoutClient.tsx`, `ShippingForm.tsx`, and `ProgressBar.tsx` are simple, well-tested files with tight existing behavior; the temptation is to over-engineer a new "digital checkout" abstraction where two optional props (`heading`, `helperText`) and a boolean branch are enough. The plan should treat `ShippingForm` as reused byte-identical (per D-01) and treat the "is this cart digital-only" check as a one-line derived boolean in `CheckoutClient.tsx`, computed from `items.every((item) => item.giftCardCustomization !== undefined)` — there is no `fulfillment_type` field on `CartItem`/`StableCartItem` (confirmed by reading `lib/types/cartitem.ts`), so this presence check is the only signal available client-side, exactly as CONTEXT.md's Specific Ideas section requires.

The second risk is the confirmation surface. `OrderConfirmationModal` is rendered inline by `CheckoutClient.tsx` (not by `app/checkout/success/page.tsx`, which is a separate Stripe-redirect fallback with no items list today). D-11's snapshot-before-`clearCart()` pattern targets `CheckoutClient.tsx`'s two `clearCart()` call sites and is fully implementable with local component state — no new API, confirmed by reading both call sites.

**Primary recommendation:** Build one new form component (`GiftCardRecipientForm`) and one new shared presentational component (`GiftCardRecipientBlock`); touch six existing files with small, additive diffs (`ProductDisplay.tsx`, `CheckoutClient.tsx`, `ShippingForm.tsx`, `ProgressBar.tsx`, `OrderItemCard.tsx`, `CartItemCard.tsx`, `OrderConfirmationModal.tsx`, `app/account/orders/[id]/page.tsx`); add per-field validators to `lib/gift-cards/customization.ts`. No new npm packages, no new API routes, no schema changes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recipient field validation (client-side gating) | Browser/Client | — | `GiftCardRecipientForm` is a client component; validation must be instant, no round trip |
| Recipient field validation (authoritative) | API/Backend | — | `parseGiftCardCustomization` in `/api/payment-intent` → `checkout-pricing.ts` remains the sole source of truth (ADR-CTB); client validation is UX only, never trusted |
| Cart line identity/merge | Browser/Client (Zustand) | — | `lib/gift-cards/line-identity.ts` runs client-side inside the Zustand store; already shipped, untouched this phase |
| Digital-only cart detection | Browser/Client | — | Derived from `items` in `CheckoutClient.tsx`; no server round trip needed since the signal (`giftCardCustomization` presence) is already in the client cart |
| Checkout step machine / progress bar | Browser/Client | — | `CheckoutClient.tsx`/`ProgressBar.tsx`; purely presentational state derived from cart contents |
| Billing address collection + submission | Browser/Client | API/Backend | Client collects via reused `ShippingForm`; server (`/api/payment-intent`) re-validates via `normalizeAddress` — unchanged contract |
| Pricing/tax/shipping-method resolution | API/Backend | — | `checkout-pricing.ts` is the sole pricer; already handles digital-only carts (`shippingMethod = { id: 'digital', ... }`) |
| Order persistence (`gift_card` field) | API/Backend / Database | — | Already written by `checkout-pricing.ts`'s `orderItems` map and persisted via the `orders.items` JSON column; this phase only reads it back |
| Order confirmation display | Browser/Client | — | `OrderConfirmationModal` (inline in `CheckoutClient.tsx`); snapshot taken client-side before cart clear, no new API |
| Account order detail display | Frontend Server (RSC) | — | `app/account/orders/[id]/page.tsx` is an async Server Component; reads persisted `order.items[].gift_card` directly, no client fetch |

## Package Legitimacy Audit

**No new external packages are installed by this phase.** Every component referenced (`Input`, `Label`, `Textarea`, `Checkbox`, `Select`, `Button`, `Dialog`) is an already-vendored `shadcn`-sourced file under `components/ui/*`, confirmed present by the approved UI-SPEC's Component Inventory (`10-UI-SPEC.md`, cross-referenced against `components/ui/*.tsx`, 19 files). The delivery-date field is a native `<input type="date">` — UI-SPEC explicitly rejects adding a shadcn date-picker dependency ("no shadcn date-picker exists in inventory; a native control is the only option without adding a dependency"). Clerk (`@clerk/nextjs`), Next.js, and Zustand are already-installed dependencies this phase reads but does not upgrade.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — no new packages this phase) | — | N/A |

## Architecture Patterns

### System Architecture Diagram

```
Product page (/product/gift-card)
  ProductDisplay.tsx [client]
    product.type === 'gift_card'? ──yes──▶ GiftCardRecipientForm [new, client]
                                              │ per-field validate (blur, then live)
                                              │ on valid + submit:
                                              ▼
                                   useCartStore.getState().addItem({
                                     ...line, giftCardCustomization
                                   })
                                              │
                                              ▼
                          lib/gift-cards/line-identity.ts (existing, untouched)
                            normalizeCartItemForStore → parseGiftCardCustomization
                            sameCartLineFacts → merge-or-append in Zustand cart-store.ts

Cart drawer (any page)                      Checkout (/checkout)
  CartItemCard.tsx [client]                   CheckoutClient.tsx [client]
    item.giftCardCustomization?                 digitalOnly = items.every(
      ──▶ GiftCardRecipientBlock                    i => i.giftCardCustomization !== undefined)
          (tone="inverse")                          │
                                                      ├─digitalOnly─▶ ShippingForm
                                                      │                 heading="Billing details"
                                                      │                 helperText="Nothing ships…"
                                                      │                 (skips /api/shipping-options,
                                                      │                  skips ShippingOptions panel)
                                                      │                 submit → shippingMethodId:'digital'
                                                      │
                                                      └─physical────▶ ShippingForm (default heading)
                                                                        → /api/shipping-options
                                                                        → ShippingOptions → select
                                                      │
                                                      ▼
                                          POST /api/payment-intent (unchanged contract)
                                            normalizeAddress() [server, unchanged]
                                            priceCheckout() [server, unchanged]
                                              hasPhysicalCheckoutLines? no
                                                ⇒ shippingMethod = {id:'digital', label:'Digital delivery'}
                                                ⇒ shipping_address: null, shipping_method: null (persisted)
                                              gift_card lines validated, priced, persisted on order.items[]
                                              │
                                              ▼
                                    snapshot items into local state
                                    (before clearCart(), both call sites)
                                              │
                                              ▼
                                    OrderConfirmationModal [inline, client]
                                      items? prop → GiftCardRecipientBlock per line

Account (/account/orders/[id])
  page.tsx [server, RSC]
    getOrderByCustomerAndId → hydrateOrder → order.items[].gift_card (already persisted)
      ──▶ render "To:/Deliver:/message" block inline (no new component call needed;
          UI-SPEC specifies the same three-line shape, not necessarily the shared
          component, since this is a server component and GiftCardRecipientBlock
          may be a client or server component — see Pitfalls)
```

### Recommended Project Structure
```
components/
├── product/
│   └── GiftCardRecipientForm.tsx     # new — recipient form, client component
├── gift-cards/
│   └── GiftCardRecipientBlock.tsx    # new — shared presentational block, tone prop
├── checkout/
│   ├── CheckoutClient.tsx            # edit — digital-only derivation, snapshot-before-clear
│   ├── ShippingForm.tsx              # edit — optional heading/helperText props
│   ├── ProgressBar.tsx               # edit — optional steps?: string[] prop
│   ├── OrderItemCard.tsx             # edit — swap inline "For …" for GiftCardRecipientBlock
│   └── OrderConfirmationModal.tsx    # edit — optional items?: StableCartItem[] prop
├── cart/
│   └── CartItemCard.tsx              # edit — swap inline "For …" for GiftCardRecipientBlock (tone="inverse")
app/
├── product/[slug]/ProductDisplay.tsx # edit — branch to GiftCardRecipientForm
└── account/orders/[id]/page.tsx      # edit — render gift_card block per item
lib/
└── gift-cards/customization.ts       # edit — additive per-field validators (D-06)
```

### Pattern 1: Additive per-field validators wrapping existing normalisers (D-06)

**What:** `lib/gift-cards/customization.ts` already has four internal normaliser functions (`normalizedEmail`, `normalizedOptionalText`, `normalizedMessage`, `normalizedDeliveryDate`) that throw `GiftCardCustomizationValidationError` on failure — all currently unexported. `parseGiftCardCustomization` (the whole-object gate, lines 97–115) is the only exported entry point today.

**When to use:** The client form needs field-level errors (e.g. "Enter a valid email address" under just the email field), but the existing normalisers only throw a single generic error with no field identity or reason code. D-06 asks for new exported functions that wrap these normalisers and return a discriminated result instead of throwing.

**Recommended shape** (file: `lib/gift-cards/customization.ts` — exact current content read this session, lines 1–125):
```typescript
// Additive export — existing normalizedEmail/normalizedOptionalText/normalizedMessage/
// normalizedDeliveryDate (private, unexported) become the single source of truth for both
// the whole-object parseGiftCardCustomization gate AND these new per-field validators.
export type GiftCardFieldError =
  | 'required' | 'invalid_format' | 'too_long' | 'control_characters' | 'out_of_range';

export function validateRecipientEmail(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return 'required';
  try { normalizedEmail(value); return null; }
  catch { return CONTROL_CHARACTERS.test(value) ? 'control_characters' : 'invalid_format'; }
}
// validateRecipientName, validateMessage, validateDeliveryDate follow the same
// try/normaliser/catch shape, each optional (undefined/empty input passes).
```
This is additive-only: `ALLOWED_KEYS`, `EMAIL_PATTERN`, `CONTROL_CHARACTERS`, the four `GIFT_CARD_*_MAX_LENGTH` constants, and `parseGiftCardCustomization`/`canonicalGiftCardCustomization` are unchanged. `GiftCardCustomizationValidationError`'s existing single-message shape stays untouched for the whole-object path (server-side callers `checkout.ts` and `line-identity.ts` only ever call `parseGiftCardCustomization`, confirmed by `grep -rln "from '@/lib/gift-cards/customization'" lib/ app/` returning only those two files — neither needs the new field-error codes).

### Pattern 2: `ShippingForm` reused byte-identical via two optional props (D-01)

**What:** `ShippingForm.tsx` (full 151-line file read this session) currently hardcodes `<h2 className="text-lg font-semibold mb-4">Shipping Address</h2>` at line 49 with no heading prop. D-01/UI-SPEC calls for adding `heading?: string` (default `"Shipping Address"`) and `helperText?: string` (default none) props — every field, `isSubmitDisabled` gating (lines 31–41), and the `onSubmit` contract stay unchanged.

**When to use:** `CheckoutClient.tsx` passes `heading="Billing details"` and `helperText="Nothing ships — we need this for your receipt and tax."` only when the cart is digital-only; otherwise no props are passed and the form renders exactly as it does today.

```tsx
// components/checkout/ShippingForm.tsx — additive props only
interface Props {
  address: Partial<Address>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectCountry: (value: string) => void;
  onSubmit: (address: Partial<Address>) => void;
  error?: string | null;
  disabled?: boolean;
  heading?: string;       // new, default "Shipping Address"
  helperText?: string;    // new, default undefined (no <p> rendered)
}
```

### Pattern 3: Digital-only cart derivation is a pure boolean, no new store field

**What:** `CartItem`/`StableCartItem` (`lib/types/cartitem.ts`, read this session, lines 3–24) has exactly five required fields plus `giftCardCustomization?: GiftCardCustomization` — there is no `fulfillment_type` on the client cart type. `lib/gift-cards/checkout.ts`'s `hasPhysicalCheckoutLines(items: OrderItem[])` (read this session) operates on the server-side `OrderItem[]` shape (which does carry `fulfillment_type`), not on `StableCartItem[]` — it cannot be reused client-side without a shape mismatch.

**Recommendation:** Compute locally in `CheckoutClient.tsx`:
```typescript
const isDigitalOnly = items.length > 0 &&
  items.every((item) => item.giftCardCustomization !== undefined);
```
This is `[VERIFIED: lib/types/cartitem.ts:11-24]` — the type has no other digital signal, confirming CONTEXT.md's Specific Ideas assumption ("the presence of `giftCardCustomization`" is the only available client signal today) is correct, not merely convenient.

### Pattern 4: Skipping the shipping-options round trip for a digital-only cart

**What:** `handleAddressSubmit` (`CheckoutClient.tsx` lines 95–134, read this session) always calls `POST /api/shipping-options` and populates `shippingOptions` state, which in turn gates the `ShippingOptions` panel's render condition (`currentStep === 'shipping' && shippingOptions.length > 0`, line 313).

**Recommendation:** For a digital-only cart, `handleAddressSubmit` should skip the fetch entirely and instead directly call `createPaymentIntent()` with a synthetic `ShippingOption` object (the function's existing parameter type, `lib/types/shipping.ts`: `{ id: string; label: string; cost: StoredMoney; estimatedDays: number }`):
```typescript
if (isDigitalOnly) {
  setShippingAddress({ ...address, type: 'shipping', status: 'unverified' } as Address);
  await createPaymentIntent({ id: 'digital', label: 'Digital delivery', cost: Money.zero().toJSON(), estimatedDays: 0 });
  return;
}
// existing /api/shipping-options fetch path, unchanged, for physical/mixed carts
```
`createPaymentIntent` (lines 159–208) already reads only `selectedShippingOption.id` for the `shippingMethodId` field sent to `/api/payment-intent` (line 170: `shippingMethodId: selectedShippingOption.id`) — passing `id: 'digital'` satisfies D-01 with zero change to `createPaymentIntent`'s body. `setShippingOption` is never called on this path, so `OrderSummary`'s shipping line naturally falls back to `Money.zero()` (line 47: `shippingOption ? Money.fromStored(shippingOption.cost) : Money.zero(subtotal.currency)`) until the authoritative quote arrives and overrides it — no cart-store change needed, confirming D-01's claim.

### Anti-Patterns to Avoid
- **Building a new `ContactForm` component:** D-01 explicitly supersedes this design (`ShippingForm` reused byte-identical). Do not build a slimmed four-field form — `normalizeAddress` (server) requires `line1`/`city`/`region`/`postal_code`/`country` unconditionally (confirmed, `app/api/payment-intent/route.ts` lines 34–64, no branch skips these for digital carts).
- **Adding a `fulfillment_type` field to `CartItem`:** Not needed and not requested — the presence of `giftCardCustomization` is a sufficient and already-endorsed signal for this milestone (only gift cards are digital today).
- **Calling `hasPhysicalCheckoutLines` client-side:** Type mismatch (`OrderItem[]` vs `StableCartItem[]`) — do not attempt to reuse it; write the one-line boolean locally instead.
- **Editing `checkout-pricing.ts`, `/api/payment-intent`, `/api/orders`, or `lib/gift-cards/{domain,repository,code,encryption,capability,runtime,config,presentations}.ts`:** Explicitly out of scope (CONTEXT.md domain boundary and AGENTS.md-cited hard rule). Confirmed these money-path files do not import `customization.ts` at all (`grep -rln "from '@/lib/gift-cards/customization'"` returns only `checkout.ts` and `line-identity.ts`), so D-06's additive validators cannot touch them even transitively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/name/message/date validation rules | A second copy of the length caps, email regex, control-character ban | The four existing private normalisers in `lib/gift-cards/customization.ts`, wrapped by new exported per-field functions (D-06) | The server is the single source of truth (ADR-CTB); duplicating the regex risks drift where the client accepts something the server later rejects |
| Cart line merge/split logic | A new "does this line match" comparator inside `GiftCardRecipientForm` or `ProductDisplay` | `useCartStore.getState().addItem()`, which already calls `sameCartLineFacts` internally | Already implemented, already tested (`tests/unit/lib/stores/cart-store-lines.test.ts`), and correct per SHOP-04 with zero new code |
| A "digital checkout" date picker | A shadcn date-picker package/component | Native `<input type="date" min max>` styled with `Input`'s existing border/radius/focus classes | UI-SPEC explicitly rejects a new dependency; the native control satisfies D-07 without adding a package |
| Clerk email/name prefill logic | Manual `fetch` to a Clerk API or a custom `/api/me` endpoint | `useUser()` from `@clerk/nextjs`, already used the same way in `components/agent/AgentDrawer.tsx:39,71` | Client-side Clerk state is already wired into this codebase; no new integration surface |

**Key insight:** Every non-UI piece of logic this phase might be tempted to write (validation rules, merge rules, digital-cart pricing, persistence) already exists, is already tested, and is explicitly locked out of scope. The actual net-new logic surface is small: four per-field validator wrappers, one boolean derivation, and two optional component props.

## Common Pitfalls

### Pitfall 1: Assuming `OrderConfirmationModal` is reachable from `app/checkout/success/page.tsx`
**What goes wrong:** A plan that tries to pass an `items` snapshot through `app/checkout/success/page.tsx` will find there is no `OrderConfirmationModal` render there at all — that page (read in full this session) is a standalone Stripe-redirect-return handler (3D Secure / delayed-confirmation path) showing only plain title/message text (`copy[phase]`), never an items list, for physical orders or gift cards alike today.
**Why it happens:** The phase description says "order confirmation" as one surface, but there are architecturally two: the inline `OrderConfirmationModal` (`CheckoutClient.tsx`'s `'confirmation'` step — the path every standard Stripe test card takes) and the redirect-fallback `success/page.tsx` (only reached for redirect-based payment methods or `processing`/`received` intermediate states).
**How to avoid:** Scope D-11's items list to `CheckoutClient.tsx` → `OrderConfirmationModal` only, matching the UI-SPEC's Component Anatomy section precisely. Do not attempt to add an items list to `success/page.tsx` unless Russell explicitly asks — it would require a different data source (the pending-checkout payload only carries `{ orderId, paymentIntentId, savedAt }`, confirmed by reading `lib/checkout/order-payload.ts`) and is not mentioned anywhere in the approved UI-SPEC.
**Warning signs:** A task that tries to modify `app/checkout/success/page.tsx` to render `GiftCardRecipientBlock` — flag this as scope creep during plan review, or raise it to Russell as an explicit open question (see below) if the 3DS path is considered in-scope.

### Pitfall 2: Forgetting `ShippingForm`'s existing `isSubmitDisabled` already requires the "billing" fields
**What goes wrong:** A plan that tries to relax `ShippingForm`'s required-field gating for the digital-only case (since "nothing ships") will break D-01's design, which is specifically that the *same* full address is collected (for tax purposes), not a relaxed one.
**Why it happens:** "Billing details" naming might suggest fewer required fields than "Shipping Address" did.
**How to avoid:** `isSubmitDisabled` (lines 31–41) stays completely unchanged — line1/city/region/postal_code/country/recipient/email all remain required, exactly as today, for both the physical and digital-only cases.

### Pitfall 3: Client-side pre-normalization duplicating (and potentially diverging from) server normalization
**What goes wrong:** If `GiftCardRecipientForm` trims/lower-cases/NFC-normalizes the email before calling `addItem`, and the per-field validator wrapper independently re-implements that logic slightly differently, the value stored in the cart could differ from what `parseGiftCardCustomization` would produce server-side, causing a mismatched-merge bug (SHOP-04) or a surprising diff between what the shopper typed and what shows in the cart.
**Why it happens:** `normalizeCartItemForStore` (called inside `useCartStore.getState().addItem`) already calls `parseGiftCardCustomization` internally (confirmed, `lib/gift-cards/line-identity.ts` lines 89–91) — so the cart-store normalizes on every `addItem` call regardless of what the client sends.
**How to avoid:** Per D-09, the form should submit `giftCardCustomization` as the shopper typed it (raw, un-normalized) — `addItem` → `normalizeCartItemForStore` → `parseGiftCardCustomization` already does the trim/NFC/lower-case/omit-empty-optional-keys work identically to what the server will later re-validate. Do not pre-normalize on the client before calling `addItem`; let the existing pipeline do it once. The per-field validators (D-06) are purely for *inline error display*, not for producing the value passed to `addItem`.

### Pitfall 4: `ProgressBar`'s numeric `step` index math when going from 4 labels to 3
**What goes wrong:** `CheckoutClient.tsx`'s current call (line 267) is `step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 2 : 3}` — hardcoded against the 4-label array. Passing `steps={3-item array}` without also changing this ternary's `2`/`3` to `1`/`2` will show the wrong circle filled/labeled for the digital-only 3-step bar.
**Why it happens:** The index math and the label array are two separate pieces of state that must be kept in sync manually — there is no single source of truth linking them today.
**How to avoid:** When `isDigitalOnly`, pass both `steps={['Billing details', 'Payment', 'Order Submitted']}` and compute `step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 1 : 2}`; otherwise pass neither prop and keep `0/2/3`. `ProgressBar.tsx` itself (72 lines, read in full) needs only an optional `steps?: string[]` prop defaulting to the existing 4-item array — the `fillWidths`/`isCompleted`/`isCurrent` logic (lines 14–24, 29–30) is already generic over `steps.length` and needs no other change.

### Pitfall 5: `useUser()` inside a component that isn't already a client component
**What goes wrong:** `ProductDisplay.tsx` is already `"use client"` (line 34, confirmed) — so adding `useUser()` inside `GiftCardRecipientForm` (also a new client component rendered from `ProductDisplay`) is safe. The risk is if a future edit moves recipient-form logic into a server-rendered wrapper without checking this.
**Why it happens:** Easy to overlook when a component tree mixes RSC and client boundaries.
**How to avoid:** Keep `GiftCardRecipientForm.tsx` as `"use client"` from the start (it needs local `useState` for validation state regardless of Clerk), matching `ProductDisplay.tsx`'s existing client boundary.

### Pitfall 6: `GiftCardRecipientBlock` tone/RSC mismatch on the account order detail page
**What goes wrong:** `app/account/orders/[id]/page.tsx` (read in full this session) is an `async` Server Component with no `"use client"` directive. If `GiftCardRecipientBlock` is written with any client-only hook or event handler, importing it here will fail the RSC boundary (Next.js will error at build/runtime).
**Why it happens:** The UI-SPEC's Component Anatomy section describes `GiftCardRecipientBlock` generically without specifying whether it's server- or client-safe, and says the account page "renders the same … lines as `GiftCardRecipientBlock` at `tone='default'`" — ambiguous about direct reuse vs. inline JSX.
**How to avoid:** `GiftCardRecipientBlock` as specified (pure props → JSX, no hooks, no event handlers, just a `title` attribute for hover text) is RSC-safe by construction — it can be imported directly into the server-rendered account page with no `"use client"` needed on the block itself. Confirm during planning that the component is written with zero client-only APIs so it works in both the client cart/checkout contexts and the server account-page context without a second copy.

### Pitfall 7: Pre-existing carts without gift-card lines are not a migration risk (verified, not a pitfall)
For completeness: `lib/stores/cart-store.ts`'s `persist` config already carries `version: 2` and a `migrate: (persistedState) => migrateCartState(persistedState)` (lines 365–368, confirmed), and `migrateCartState` (lines 377–409+) already re-runs every persisted item through `normalizeCartItemForStore` and re-derives `lineId` via `sameCartLineFacts`-based deduplication. This groundwork predates Phase 10 and needs no new work — flagged here only so the planner doesn't spend a task re-verifying it.

## Code Examples

### `ShippingForm`'s exact current heading/required-field code (before edit)
```tsx
// Source: components/checkout/ShippingForm.tsx:49, 31-41 (read in full this session)
<h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
// ...
const isSubmitDisabled =
  disabled ||
  !(
    address.recipient &&
    address.email &&
    address.line1 &&
    address.city &&
    address.region &&
    address.postal_code &&
    address.country
  );
```

### `CheckoutClient.tsx`'s two `clearCart()` call sites (snapshot targets for D-11)
```tsx
// Source: components/checkout/CheckoutClient.tsx:194-203 (noCash branch, inside createPaymentIntent)
if (data.noCash) {
  clearCart();
  setGiftCardToken('');
  giftCardRequestKey.current = undefined;
  setCurrentStep('confirmation');
} else { /* payment step, unchanged */ }

// Source: components/checkout/CheckoutClient.tsx:228-234 (handlePaymentSuccess)
clearPendingCheckout(paymentIntentId);
clearCart();
setCurrentStep('confirmation');
```
Both sites need `setConfirmedItems(items)` (new local state) called immediately before their respective `clearCart()` call, using the `items` value already destructured from `useCartStore()` at the top of the component (line 53).

### `checkout-pricing.ts`'s digital-only branch (unchanged, read for confirmation)
```typescript
// Source: lib/services/checkout-pricing.ts:614-616 (approx, read this session)
let shipping = Money.zero(currency);
let shippingMethod: CheckoutQuote['shippingMethod'] = { id: 'digital', label: 'Digital delivery' };
if (hasPhysicalLines) {
  // ...address-country validation, method lookup, cost calc — skipped entirely when !hasPhysicalLines
}
// Tax calculation (lines ~685-699) still runs unconditionally against input.shippingAddress —
// confirms D-01's requirement that a real address is always collected, digital or not.
```

### Persisted `gift_card` field, already written server-side (confirmed for D-12)
```typescript
// Source: lib/services/checkout-pricing.ts orderItems map (read this session)
return {
  id: line.lineId ?? `line_${crypto.randomUUID()}`,
  product_id: product.id,
  // ...
  fulfillment_type: variant.shipping_required === false ? 'digital' : 'physical',
  ...(giftCardCustomization ? { gift_card: giftCardCustomization } : {}),
};
```
```typescript
// Source: lib/types/order.ts:25 (read this session)
gift_card?: import('@/lib/types/cartitem').GiftCardCustomization;
```
```typescript
// Source: lib/models/mach/orders.ts, hydrateOrder() (read this session)
items: parseJson<OrderItem[]>(orderRecord.items, []),
```
This confirms Q6: `order.items[].gift_card` is present on every loaded order with no further work — `app/account/orders/[id]/page.tsx` can read `item.gift_card` directly today, D-12 is purely a rendering task.

### Account order detail's current single-line item row (exact text to extend, D-12)
```tsx
// Source: app/account/orders/[id]/page.tsx:17 (read in full this session — single line, minified JSX)
<li key={item.id ?? `${item.product_id}-${index}`} className="flex justify-between gap-4 py-3">
  <span>{item.product_name} × {item.quantity}</span>
  <span>{Money.fromStored(item.total_price).format()}</span>
</li>
```

### Clerk `useUser()` shape (Context7, `@clerk/nextjs` — verify exact version below)
```tsx
// Source: Context7 /clerk/clerk-docs, docs/reference/hooks/use-user.mdx
'use client'
import { useUser } from '@clerk/nextjs'
export default function Page() {
  const { isSignedIn, isLoaded, user } = useUser()
  if (!isLoaded) return <div>Loading...</div>
  if (!isSignedIn) return <div>Sign in to view this page</div>
  return <div>Hello {user.id}!</div>
}
```
`isLoaded` is `false` while loading (`isSignedIn`/`user` both `undefined`); once loaded, `isSignedIn` is `true`/`false` and `user` is `null` when signed out. For D-08 ("guests never see the control"), gate the "Send to myself" checkbox on `isLoaded && isSignedIn` — not `isSignedIn` alone — to avoid a flash of the checkbox during the loading tick (see Pitfall/Open Question below on hydration).

## State of the Art

No deprecated-vs-current API distinctions apply in this phase — every touched library (Clerk, Next.js App Router, Zustand persist, shadcn) is already the version pinned in this repo's `package.json`, and this phase does not upgrade any of them.

| Area | Status |
|------|--------|
| `@clerk/nextjs` | `^7.8.3` in `package.json` — current major, `useUser()` API used matches this session's Context7 lookup |
| `next` | `^16.3.3` in `package.json` |
| `zustand` | version not directly queried; `persist`/`createJSONStorage` middleware already in use, `migrate`/`version` already wired (v2) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client-side `user.primaryEmailAddress?.emailAddress` and `user.fullName` are the correct field paths on the Clerk frontend `UserResource` for D-08/D-03 prefill | Pattern/Code Examples (Clerk) | If Clerk's frontend `User` object nests email differently in `^7.8.3`, "Send to myself" would silently fill nothing; low risk since these are Clerk's long-standing, stable field names, but Context7's docs excerpt returned confirmed only `user.firstName`/`user.lastName`/`user.id` code samples, not a literal `primaryEmailAddress.emailAddress` code sample this session — recommend a one-line runtime check (`console.log` or a unit assertion against a mocked `UserResource`) during implementation rather than trusting blind |
| A2 | The 3D-Secure/redirect confirmation path (`app/checkout/success/page.tsx`) is out of scope for D-11's items list | Pitfall 1 | If Russell expects gift-card recipient details to also show on the redirect-return page (reached only for 3DS or delayed payment methods), this phase would ship an inconsistent confirmation experience between the two paths. Recommend the planner surface this explicitly as a scope confirmation rather than silently deciding it, since the UI-SPEC's Component Anatomy section only names `CheckoutClient.tsx`/`OrderConfirmationModal.tsx` |
| A3 | `GiftCardRecipientBlock` can be written with zero client-only hooks/handlers, making it safe to import unchanged into the server-rendered `app/account/orders/[id]/page.tsx` | Pitfall 6 | If the planner instead treats it as always a client component (e.g. adds a `"use client"` directive out of habit), the account order detail page would need a second, duplicate inline block instead of reusing the shared component — not a functional bug, just a missed reuse opportunity the UI-SPEC intends |

**If this table is empty:** N/A — see above; all other package/version/API claims in this document were confirmed by direct `Read`/`grep` against the working tree this session, tagged `[VERIFIED: <path>:<lines>]` inline, or by a Context7 lookup tagged `[CITED: ...]`.

## Open Questions

1. **Does the 3DS-redirect confirmation page (`app/checkout/success/page.tsx`) need an items list too?**
   - What we know: The approved UI-SPEC's Component Anatomy section only describes changes to `OrderConfirmationModal.tsx` (rendered inline by `CheckoutClient.tsx`); `success/page.tsx` shows no items list for any order type today, gift card or physical.
   - What's unclear: Whether "order confirmation" in SHOP-05's requirement text is meant to cover both surfaces or just the primary (non-redirect) one.
   - Recommendation: Plan for `OrderConfirmationModal` only, matching the UI-SPEC exactly. If Russell wants parity on the redirect path, that's a follow-up (the redirect path already has less information available — only `pending.orderId`/`pending.paymentIntentId` from `lib/checkout/order-payload.ts`, no item snapshot — since the cart is often already cleared or not currently held in memory when this page mounts after a full page navigation).

2. **Exact Clerk frontend field paths for email/name prefill (D-03/D-08)**
   - What we know: `useUser()` returns `{ isLoaded, isSignedIn, user }`; `user.fullName`, `user.firstName`, `user.lastName` are confirmed via Context7 code samples this session. `user.primaryEmailAddress.emailAddress` is the standard Clerk frontend pattern from training knowledge but was not shown in a literal code sample by this session's Context7 queries.
   - What's unclear: Whether any recent Clerk major shipped a breaking rename to this specific nested path.
   - Recommendation: Treat as `[ASSUMED]` (A1 above); the executor should do a quick runtime/type check against the installed `@clerk/nextjs` types (`UserResource` from `@clerk/types`) before wiring the prefill, rather than trusting this research blind.

## Environment Availability

Skipped — no new external dependency, service, or CLI tool is introduced by this phase. All required tooling (Node 24.18.1, npm, Clerk/Stripe/Cloudflare accounts) is already covered by `AGENTS.md`'s Prerequisites section and unchanged by this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`), environment `"node"` (not `jsdom`) — `[VERIFIED: vitest.config.mts]` |
| Config file | `vitest.config.mts` (repo root) |
| Quick run command | `mise exec -- npx vitest run <file>` |
| Full suite command | `mise exec -- npm test` (repo `test` script → `vitest run`) |

**No `@testing-library/react` / `jsdom` is installed** — `[VERIFIED: package.json]` shows no `@testing-library/*` dependency and `vitest.config.mts`'s `test.environment` is `"node"`. This confirms UI-SPEC's and CONTEXT.md's "source contract" test pattern is the only available approach for component-level assertions in this repo: tests `readFileSync` a component's `.tsx` source and assert on literal substrings (prop names, function calls, JSX attribute values), rather than rendering into a DOM. Two exemplars read in full this session: `tests/unit/components/order-card-source.test.ts` and `tests/unit/components/cart-line-source.test.ts`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-02 | Per-field validators return correct error codes for email/name/message/date at each boundary (required, too-long, invalid format, control chars, out-of-range date) | unit (pure function) | `mise exec -- npx vitest run tests/unit/lib/gift-cards/customization.test.ts` | ✅ extend existing file |
| SHOP-01/02 | `GiftCardRecipientForm` source wires validators to the four fields and disables Add to Cart until all pass | unit (source-contract) | `mise exec -- npx vitest run tests/unit/components/product/gift-card-recipient-form-source.test.ts` | ❌ Wave 0 |
| SHOP-03 | "Send to myself" checkbox only renders when `isSignedIn` is checked, and prefills from `user.primaryEmailAddress`/`user.fullName` | unit (source-contract) | same file as above | ❌ Wave 0 |
| SHOP-04 | Two gift-card lines for different recipients stay separate; same recipient+denomination merge | unit (pure function + store) | `mise exec -- npx vitest run tests/unit/lib/gift-cards/line-identity.test.ts tests/unit/lib/stores/cart-store-lines.test.ts` | ✅ already exists and already proves this — no new test strictly required, only confirm coverage during plan-checker |
| SHOP-04/09 | `ProductDisplay`/`GiftCardRecipientForm`'s `addItem` call passes `giftCardCustomization` un-normalized (raw shopper input), matching D-09's intended pipeline | unit (source-contract) | `mise exec -- npx vitest run tests/unit/components/product/gift-card-recipient-form-source.test.ts` | ❌ Wave 0 (same file as above) |
| SHOP-05 | `GiftCardRecipientBlock` renders "To:/Deliver:/message" per D-10 copy contract, truncates message at 80 chars, respects `tone` prop | unit (source-contract or pure function if block logic is extracted) | `mise exec -- npx vitest run tests/unit/components/gift-cards/gift-card-recipient-block-source.test.ts` | ❌ Wave 0 |
| SHOP-05 | `CartItemCard.tsx`/`OrderItemCard.tsx` both call `GiftCardRecipientBlock` with the correct `tone` | unit (source-contract) | `mise exec -- npx vitest run tests/unit/components/cart-line-source.test.ts` | ✅ extend existing file |
| SHOP-06 | `CheckoutClient.tsx` derives `isDigitalOnly` from `giftCardCustomization` presence, skips `/api/shipping-options` fetch, submits `shippingMethodId: 'digital'`, passes `ShippingForm` the digital heading/helper props | unit (source-contract) | `mise exec -- npx vitest run tests/unit/components/cart-line-source.test.ts` (extend) or a new `checkout-client-digital-source.test.ts` | ❌ Wave 0 (new file recommended — cart-line-source.test.ts is scoped to line-identity concerns, not checkout-step derivation) |
| SHOP-06 | `ProgressBar` renders 3 labels + correct step index for digital-only, 4 labels otherwise | unit (source-contract or prop-shape test) | `mise exec -- npx vitest run tests/unit/components/checkout/progress-bar-source.test.ts` | ❌ Wave 0 |
| SHOP-05 (confirmation) | `CheckoutClient.tsx` snapshots `items` into local state immediately before each `clearCart()` call, passes it to `OrderConfirmationModal` | unit (source-contract) | same new checkout-client source test file | ❌ Wave 0 (same file as SHOP-06 above) |
| SHOP-05 (account) | `app/account/orders/[id]/page.tsx` renders `item.gift_card`'s four fields when present, omits the block when absent | unit (source-contract, since page is an RSC with no jsdom render) | `mise exec -- npx vitest run tests/unit/app/account/order-detail-gift-card-source.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `mise exec -- npx vitest run <changed-file's-test>`
- **Per wave merge:** `mise exec -- npm test` (full unit suite)
- **Phase gate:** `npm run lint && npm run typecheck && npm run cf-typecheck && npm run scan:tokens && npm test && npm run test:workers && npm run build` — matches AGENTS.md's CI gate order `[VERIFIED: .github/workflows/ci.yml order, per AGENTS.md's Gates section]` and CONTRIBUTING.md's pre-commit subset `[VERIFIED: CONTRIBUTING.md:24-33]`

### Wave 0 Gaps
- [ ] `tests/unit/components/product/gift-card-recipient-form-source.test.ts` — covers SHOP-01, SHOP-02, SHOP-03, SHOP-04(submission shape)
- [ ] `tests/unit/components/gift-cards/gift-card-recipient-block-source.test.ts` — covers SHOP-05 (shared block)
- [ ] `tests/unit/components/checkout/checkout-client-digital-source.test.ts` (or extend `cart-line-source.test.ts`) — covers SHOP-06 and the confirmation-snapshot half of SHOP-05
- [ ] `tests/unit/components/checkout/progress-bar-source.test.ts` — covers SHOP-06 (progress bar label/step derivation)
- [ ] `tests/unit/app/account/order-detail-gift-card-source.test.ts` — covers SHOP-05 (account order detail)
- No framework install needed — Vitest is already configured and in use throughout `tests/unit/`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Clerk handles auth; this phase only reads `isSignedIn`/`user` client-side for UX prefill, no auth decision made in this phase's code |
| V3 Session Management | no | Unchanged — Clerk session cookies, untouched |
| V4 Access Control | no | `app/account/orders/[id]/page.tsx` already gates on `auth()`/`getOrderByCustomerAndId(userId, id)` (unchanged, existing code, read this session lines 9-13) — a shopper cannot view another account's gift-card recipient details through this phase's changes |
| V5 Input Validation | yes | Client-side per-field validators (D-06) are UX-only; the authoritative validator remains server-side `parseGiftCardCustomization` inside `/api/payment-intent` → `checkout-pricing.ts`, unchanged this phase. Every client-side value is re-validated server-side before it can affect price, order persistence, or gift-card issuance |
| V6 Cryptography | no | No crypto touched — gift-card code HMAC keys (`lib/gift-cards/encryption.ts`, `code.ts`) are explicitly out of scope (Phase 11) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses per-field validation (disables JS, crafts a raw `addItem` call) to add an invalid customization (e.g. oversized message, control characters) | Tampering | Already mitigated — `normalizeCartItemForStore` (called inside every `addItem`) calls `parseGiftCardCustomization` and returns `null` on any invalid value, silently rejecting the add; the checkout API re-validates independently. No new mitigation needed this phase — inherited from already-shipped code |
| Recipient email/message injected with control characters or oversized payloads to abuse email delivery (Phase 12's send path) | Injection | Already mitigated server-side by `CONTROL_CHARACTERS` regex and the 254/100/500 length caps in `parseGiftCardCustomization`; this phase's client validators mirror (not replace) these limits for UX only |
| A shopper crafts a `shippingMethodId: 'digital'` payload for a cart that actually contains physical lines, to skip shipping cost | Tampering | Already mitigated — `checkout-pricing.ts`'s `hasPhysicalLines` check (server-computed from `orderItems`, derived from the *product/variant* records looked up server-side, not from client input) ignores the client-sent `shippingMethodId` for pricing purposes when physical lines are present (it still requires and validates `input.shippingMethodId` against `enabledShippingMethods`) — ADR-CTB's "server recomputes all pricing" holds unchanged |

## Sources

### Primary (HIGH confidence)
- Direct `Read`/`cat -n` of working-tree source files this session: `lib/gift-cards/customization.ts`, `lib/gift-cards/line-identity.ts`, `lib/gift-cards/checkout.ts`, `lib/types/cartitem.ts`, `lib/types/order.ts`, `app/product/[slug]/ProductDisplay.tsx`, `app/api/payment-intent/route.ts`, `lib/services/checkout-pricing.ts` (lines 550-720), `components/checkout/CheckoutClient.tsx`, `components/checkout/ShippingForm.tsx`, `components/checkout/ProgressBar.tsx`, `components/checkout/ShippingOptions.tsx`, `components/checkout/OrderSummary.tsx`, `components/checkout/OrderItemCard.tsx`, `components/checkout/OrderConfirmationModal.tsx`, `app/checkout/success/page.tsx`, `lib/checkout/order-payload.ts`, `lib/stores/cart-store.ts`, `components/cart/CartItemCard.tsx`, `app/account/orders/[id]/page.tsx`, `lib/models/mach/orders.ts`, `lib/models/mach/product-serializer.ts`, `lib/types/mach/Product.ts`, `lib/types/shipping.ts`, `tests/unit/lib/gift-cards/customization.test.ts`, `tests/unit/lib/gift-cards/line-identity.test.ts`, `tests/unit/lib/stores/cart-store-lines.test.ts`, `tests/unit/components/order-card-source.test.ts`, `tests/unit/components/cart-line-source.test.ts`, `tests/unit/components/cart-hydration-contract.test.ts`, `vitest.config.mts`, `package.json`, `CONTRIBUTING.md`, `docs/checkout-trust-boundary.md`, `docs/theming.md`
- Context7 `/clerk/clerk-docs` — `useUser()` hook return shape, loading/signed-out/signed-in state table

### Secondary (MEDIUM confidence)
- `.planning/phases/10-gift-card-purchase-flow/10-CONTEXT.md` and `10-UI-SPEC.md` — already-approved design contracts, treated as locked scope rather than re-derived

### Tertiary (LOW confidence)
- Clerk frontend `UserResource.primaryEmailAddress.emailAddress` field path — training knowledge, not shown in a literal Context7 code sample this session (see Assumption A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every touched file read directly this session
- Architecture: HIGH — every integration point (digital-only detection, snapshot timing, ShippingForm reuse) verified against actual current source, not inferred
- Pitfalls: HIGH — each pitfall traced to a specific line range in the current codebase, not a generic checkout-flow concern

**Research date:** 2026-09-08
**Valid until:** 2026-10-08 (30 days — stable, no fast-moving external dependency; re-verify if `@clerk/nextjs` is upgraded before this phase is planned)
