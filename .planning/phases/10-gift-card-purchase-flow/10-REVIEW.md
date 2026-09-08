---
phase: 10-gift-card-purchase-flow
reviewed: 2026-09-08T18:30:02Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/account/orders/[id]/page.tsx
  - app/product/[slug]/ProductDisplay.tsx
  - components/cart/CartItemCard.tsx
  - components/checkout/CheckoutClient.tsx
  - components/checkout/OrderConfirmationModal.tsx
  - components/checkout/OrderItemCard.tsx
  - components/checkout/ProgressBar.tsx
  - components/checkout/ShippingForm.tsx
  - components/gift-cards/GiftCardRecipientBlock.tsx
  - components/product/GiftCardRecipientForm.tsx
  - lib/checkout/digital-only.ts
  - lib/gift-cards/customization.ts
  - tests/unit/app/order-detail-gift-card-source.test.ts
  - tests/unit/components/cart-line-source.test.ts
  - tests/unit/components/checkout-digital-only-source.test.ts
  - tests/unit/components/checkout-step-props-source.test.ts
  - tests/unit/components/gift-card-recipient-block-source.test.ts
  - tests/unit/components/gift-card-recipient-form-source.test.ts
  - tests/unit/components/order-confirmation-items-source.test.ts
  - tests/unit/lib/checkout/digital-only.test.ts
  - tests/unit/lib/gift-cards/customization-field-validators.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-09-08T18:30:02Z
**Depth:** standard
**Files Reviewed:** 20 (12 source, 8 test)
**Status:** issues_found

## Summary

Reviewed the gift-card purchase flow: recipient form on the product page, the shared
`GiftCardRecipientBlock` across cart/checkout/confirmation/account-order surfaces, the
digital-only checkout branch in `CheckoutClient`, and the new field-level validators in
`lib/gift-cards/customization.ts`.

Verified against the review's specific focus areas:

- `lib/gift-cards/customization.ts` lines 1-123 (`parseGiftCardCustomization`,
  `canonicalGiftCardCustomization`, and the private normalisers) are byte-identical to
  `2aa5f78` — the new field validators are pure appended code that delegates to the
  same normalisers, so the client can never be more permissive than the parse gate.
- The customization object `GiftCardRecipientForm` hands to `addItem` is re-normalized
  by `normalizeCartItemForStore` → `parseGiftCardCustomization` before it's ever
  persisted to the store, so trimming/casing/NFC/omitted-optional-key invariants hold
  regardless of what the form's raw draft state looks like.
  `isDigitalOnlyCart` correctly returns `false` for an empty cart and keys purely on
  `giftCardCustomization` presence; the step-index remap in `CheckoutClient` /
  `ProgressBar` (3-label vs 4-label) is internally consistent and covered by both a
  source-contract test and `tsc`/`eslint` runs (no errors).
- The stale-closure fix (`addressOverride ?? shippingAddress` in `createPaymentIntent`,
  with the digital branch always passing `billingAddress` explicitly) is correct; the
  physical flow's `createPaymentIntent(option)` call site is unaffected and still reads
  the already-committed `shippingAddress` from a prior render.
- `GiftCardRecipientBlock` is hook-free, imports nothing from `react`, is used directly
  from an async server component (`app/account/orders/[id]/page.tsx`) without a
  `"use client"` boundary conflict, truncates by code point (verified against the
  astral-character test), and never renders a bearer code/redemption token field (no
  such field exists on `GiftCardCustomization`).
- All 9 targeted test files pass (108/108), `tsc --noEmit` is clean project-wide, and
  `eslint` reports zero errors on the 12 reviewed source files.

Four issues surfaced during manual tracing, none of them security- or data-loss-grade,
but two are functional/UX defects worth fixing before ship.

## Warnings

### WR-01: Delivery-date "today" bound is computed in UTC, not the shopper's local date

**File:** `components/product/GiftCardRecipientForm.tsx:55-61`, `lib/gift-cards/customization.ts:189`

**Issue:** Both `computeDeliveryDateBounds()` (drives the `<input type="date">` `min`/`max`)
and `validateGiftCardDeliveryDate`'s default `todayIso` use
`new Date().toISOString().slice(0, 10)`. `toISOString()` always returns the date in UTC,
not the browser's local calendar date. For any shopper west of UTC (all US time zones),
once local clock time crosses into the UTC-midnight rollover — e.g. after ~5–8 PM
depending on time zone — `toISOString()` already reports *tomorrow's* date. The date
picker's `min` then becomes tomorrow, and `validateGiftCardDeliveryDate` rejects the
shopper's actual "today" as `out_of_range` (`value < referenceDay`), even though the
copy explicitly promises "a delivery date between today and one year from now." The
inverse (looser, not stricter) happens for shoppers east of UTC in the early morning.

This is validation-only (the server's `normalizedDeliveryDate` doesn't enforce a range at
all, per the comment at customization.ts:173-178), so it can't corrupt stored data — but
it incorrectly blocks a valid "today" selection for a large fraction of US shoppers during
normal evening shopping hours.

**Fix:** Build the bound from local date components instead of `toISOString()`:
```ts
function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// computeDeliveryDateBounds(): const today = localIsoDate(new Date());
// validateGiftCardDeliveryDate default: todayIso ?? localIsoDate(new Date())
```
Apply the same fix to both call sites so the displayed bounds and the enforced bounds
stay in sync.

### WR-02: Clerk-prefill effect sets state synchronously inside `useEffect`

**File:** `components/checkout/CheckoutClient.tsx:102-112`

**Issue:** The new prefill effect calls `setAddress` directly and unconditionally in the
effect body:
```tsx
useEffect(() => {
  if (!isLoaded || !isSignedIn || !user) return;
  setAddress((prev) => {
    const next = { ...prev };
    if (!next.recipient && user.fullName) next.recipient = user.fullName;
    ...
    return next;
  });
}, [isLoaded, isSignedIn, user]);
```
This is exactly the anti-pattern the project's own ESLint config flags
(`react-hooks/set-state-in-effect`, confirmed via `npx eslint` on this file — 1 warning
at line 105). The updater always returns a new object reference via `{ ...prev }` even
when `user.fullName`/email are absent or the fields are already filled, so every effect
run forces a re-render regardless of whether anything actually changed. Not currently
harmful (the effect only re-runs when `isLoaded`/`isSignedIn`/`user` change), but it's a
real instance of the pattern the lint rule exists to catch, and is new code from this
phase, not pre-existing.

**Fix:** Only call `setAddress` when a field would actually change, and prefer deriving
the values once `isLoaded && isSignedIn` becomes true rather than on every `user`
reference change:
```tsx
useEffect(() => {
  if (!isLoaded || !isSignedIn || !user) return;
  const clerkEmail = user.primaryEmailAddress?.emailAddress;
  setAddress((prev) => {
    if ((prev.recipient || !user.fullName) && (prev.email || !clerkEmail)) return prev;
    return {
      ...prev,
      recipient: prev.recipient || user.fullName || prev.recipient,
      email: prev.email || clerkEmail || prev.email,
    };
  });
}, [isLoaded, isSignedIn, user]);
```

### WR-03: Unavailable gift cards give no explanation, unlike regular products

**File:** `app/product/[slug]/ProductDisplay.tsx:363-377`, `components/product/GiftCardRecipientForm.tsx:93-98,241-243`

**Issue:** For a regular product, the unavailable case shows explicit copy:
```tsx
) : (
  <p className="text-lg font-semibold text-warning sm:text-xl">Coming soon</p>
)
```
For `product.type === "gift_card"`, `GiftCardRecipientForm` is always rendered regardless
of availability, and `available` only feeds into `isDisabled` on the Add button
(`!available || emailError !== null || ...`). When a gift card is unavailable, the
shopper sees the full recipient form with a silently-disabled "Add to Cart" button and no
indication of why — a design-conscious storefront should surface the same "Coming soon"
signal it gives every other unavailable product.

**Fix:** Gate the form on `available` in `ProductDisplay.tsx`, mirroring the existing
branch:
```tsx
{product.type === "gift_card" ? (
  available ? (
    <GiftCardRecipientForm available={available} onAdd={(c) => handleGiftCardAdd(c)} />
  ) : (
    <p className="text-lg font-semibold text-warning sm:text-xl">Coming soon</p>
  )
) : available ? (
  ...
```

## Info

### IN-01: Recipient email/name inputs have no `maxLength`, unlike the message field

**File:** `components/product/GiftCardRecipientForm.tsx:137-148` (email), `169-178` (name)

**Issue:** The gift message `Textarea` is hard-capped in the browser via
`maxLength={GIFT_CARD_MESSAGE_MAX_LENGTH}` (line 201), but the recipient-email and
recipient-name `Input` elements have no `maxLength`, so a shopper can type well past 254
/ 100 characters before the (already-correct) field-level validator flags it on blur and
disables Add to Cart. Functionally safe — the character-count constants
(`GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH`, `GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH`) are
already imported and used for the counters, so wiring them into `maxLength` is a small,
low-risk consistency fix that would also pass the source-contract test's ban on literal
`maxLength={254|100|500}` (it only forbids the numeric literal, not the constant).

**Fix:**
```tsx
<Input
  id="gift-card-recipient-email"
  ...
  maxLength={GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH}
/>
...
<Input
  id="gift-card-recipient-name"
  ...
  maxLength={GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH}
/>
```

---

_Reviewed: 2026-09-08T18:30:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
