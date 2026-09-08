---
phase: 10-gift-card-purchase-flow
reviewed: 2026-09-08T18:45:00Z
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
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 10: Code Review Report

**Reviewed:** 2026-09-08T18:45:00Z
**Depth:** standard
**Files Reviewed:** 20 (12 source, 8 test)
**Status:** clean

## Summary

Re-review, iteration 2 of the `--auto` fix loop. Verified the three fix commits
(`6fede44`, `362510e`, `7613703`) against WR-01, WR-02, WR-03, and IN-01 from the prior
review, and re-checked the sixteen untouched files for regressions.

- Only four files changed since the prior review's commit (`20e9480`):
  `app/product/[slug]/ProductDisplay.tsx`, `components/checkout/CheckoutClient.tsx`,
  `components/product/GiftCardRecipientForm.tsx`, `lib/gift-cards/customization.ts`.
  The other sixteen reviewed files are byte-identical to the prior review point, so no
  regression is possible there; confirmed with `git diff --stat 20e9480..HEAD`.
- **WR-01 (UTC "today" bound) — resolved.** Both `computeDeliveryDateBounds()` in
  `GiftCardRecipientForm.tsx` and the default `todayIso` in
  `validateGiftCardDeliveryDate` (`customization.ts`) now call a local `localIsoDate()`
  helper that builds the date string from `getFullYear()`/`getMonth()`/`getDate()`
  instead of `toISOString()`. The two helpers are line-for-line identical in logic
  (only quote style differs). Both call sites were updated, so the displayed `min`/`max`
  and the enforced validation bound stay in sync.
- **`lib/gift-cards/customization.ts` lines 1-123 — confirmed byte-identical to
  `2aa5f78`** (`diff` against `git show 2aa5f78:...`, exit 0). The new `localIsoDate`
  helper and its call site are appended/modified only after line 123.
- **WR-02 (Clerk-prefill setState-in-effect) — resolved.** The prefill logic was
  extracted into a standalone `useClerkAddressPrefill(setAddress)` hook above the
  component. The `isLoaded`/`isSignedIn`/`user` gate (`if (!isLoaded || !isSignedIn ||
  !user) return;`) and the empty-field-only guards (`if (!next.recipient &&
  user.fullName) ...`, `if (!next.email && clerkEmail) ...`) are unchanged from the
  original effect body — only the enclosing scope moved. `npx eslint
  components/checkout/CheckoutClient.tsx` now reports zero `react-hooks/set-state-in-effect`
  warnings (one unrelated, pre-existing `@next/next/no-location-assign-relative-destination`
  warning remains at line 453, confirmed present in `2aa5f78` too, out of scope).
- **WR-03 (unavailable gift card lacked "Coming soon") — resolved.** `ProductDisplay.tsx`
  now branches `available ? <GiftCardRecipientForm .../> : <p>Coming soon</p>` for
  `product.type === "gift_card"`, mirroring the pre-existing branch for regular products.
  Verified the `available` branch still renders `GiftCardRecipientForm` (not hidden) and
  the unavailable branch shows the same "Coming soon" copy/styling used elsewhere.
- **IN-01 (no `maxLength` on email/name inputs) — not fixed**, left open below as an
  Info item since it's cosmetic and the field-level validators already block submission.
- `mise exec -- npx eslint` on the three changed source files: 0 errors, 1 pre-existing
  unrelated warning. `mise exec -- npx tsc --noEmit`: clean. `mise exec -- npx vitest run`
  on the nine targeted test files: 108/108 passing, 9/9 files.

## Info

### IN-01: Recipient email/name inputs still have no `maxLength`

**File:** `components/product/GiftCardRecipientForm.tsx:145-159` (email `Input`),
`178-187` (name `Input`)

**Issue:** Unchanged from the prior review — the gift message `Textarea` is capped via
`maxLength={GIFT_CARD_MESSAGE_MAX_LENGTH}`, but the recipient-email and recipient-name
`Input` elements still have no `maxLength`, even though
`GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH` / `GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH` are
already imported and used for the live character counters. Functionally safe — the
field-level validators still block "Add to Cart" on blur — this is a small consistency
gap, not a defect.

**Fix:**
```tsx
<Input id="gift-card-recipient-email" ... maxLength={GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH} />
...
<Input id="gift-card-recipient-name" ... maxLength={GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH} />
```

(Note: `GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH` isn't currently imported in this file —
only `GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH` is — so applying this fix also needs adding
that import.)

### IN-02: `available` prop on `GiftCardRecipientForm` is now always `true`

**File:** `app/product/[slug]/ProductDisplay.tsx:363-368`,
`components/product/GiftCardRecipientForm.tsx:23,107-112`

**Issue:** The WR-03 fix gates `GiftCardRecipientForm` behind `available ? (...) : (...)`
in `ProductDisplay.tsx`, so the form is only ever mounted when `available` is `true`.
The `available` prop is still passed through and still participates in the form's
`isDisabled` check (`!available || emailError !== null || ...`), but that branch of
`isDisabled` can no longer evaluate to `true` — it's now dead weight left over from
before the gate existed. Not a bug (the Add button's disabled state is unaffected,
since the other conditions still gate it correctly), just a small redundancy introduced
by the fix.

**Fix:** Either drop the `available` prop from `GiftCardRecipientForm` entirely (since
the parent now only renders it when available), or keep it as a defensive prop but note
in a comment that it's belt-and-suspenders now that the parent gates rendering. Low
priority — no functional impact either way.

---

_Reviewed: 2026-09-08T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
