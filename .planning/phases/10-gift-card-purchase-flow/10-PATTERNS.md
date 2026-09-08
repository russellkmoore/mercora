# Phase 10: Gift Card Purchase Flow - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 11 (2 new, 9 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/product/GiftCardRecipientForm.tsx` (new) | component (form) | request-response (client validate + addItem) | `components/checkout/ShippingForm.tsx` (controlled form + submit gating); secondary `components/agent/AgentDrawer.tsx` for `useUser()` | role-match |
| `components/gift-cards/GiftCardRecipientBlock.tsx` (new) | component (presentational, RSC-safe) | transform (props → JSX) | The inline "For …" `<p>` fragment already in `CartItemCard.tsx` (lines 60-67) and `OrderItemCard.tsx` (lines 40-44) | exact (extraction of existing inline pattern) |
| `lib/gift-cards/customization.ts` (edit) | utility/validator | transform | itself — existing private normalisers (`normalizedEmail`, `normalizedOptionalText`, `normalizedMessage`, `normalizedDeliveryDate`) | exact |
| `app/product/[slug]/ProductDisplay.tsx` (edit) | component (client) | CRUD (addItem) | itself — existing add-to-cart block (lines 326-365) | exact |
| `components/checkout/CheckoutClient.tsx` (edit) | component (client, step machine) | request-response | itself — existing `handleAddressSubmit`/`clearCart()` call sites | exact |
| `components/checkout/ShippingForm.tsx` (edit — add optional props) | component (form) | request-response | itself | exact |
| `components/checkout/ProgressBar.tsx` (edit — add `steps?` prop) | component (presentational) | transform | itself | exact |
| `components/checkout/OrderConfirmationModal.tsx` (edit) | component (modal) | request-response | itself; `components/checkout/OrderItemCard.tsx` for the item-row shape to reuse in the new items section | exact |
| `components/cart/CartItemCard.tsx` (edit — swap inline block) | component (client) | CRUD | itself | exact |
| `components/checkout/OrderItemCard.tsx` (edit — swap inline block) | component (server/client presentational) | transform | itself | exact |
| `app/account/orders/[id]/page.tsx` (edit) | route/page (RSC) | request-response (server read) | itself — existing `order.items.map(...)` `<li>` row | exact |

## Pattern Assignments

### `lib/gift-cards/customization.ts` (utility, transform) — D-06 per-field validators

**Analog:** itself. Full current file read (125 lines).

The four private normalisers already exist and throw a single generic `GiftCardCustomizationValidationError`:

```typescript
// lines 29-91 — normalizedOptionalText, normalizedMessage, normalizedEmail, normalizedDeliveryDate
// each: validate type/control-chars/length/format, throw on failure, return normalized value or undefined
```

**Core pattern to add (additive, do not touch existing exports):**
```typescript
export type GiftCardFieldError =
  | 'required' | 'invalid_format' | 'too_long' | 'control_characters' | 'out_of_range';

export function validateRecipientEmail(value: string): GiftCardFieldError | null {
  if (value.trim().length === 0) return 'required';
  try { normalizedEmail(value); return null; }
  catch { return CONTROL_CHARACTERS.test(value) ? 'control_characters' : 'invalid_format'; }
}
// validateRecipientName, validateMessage, validateDeliveryDate: same try/normaliser/catch shape,
// each treats empty/undefined input as valid (optional fields)
```

**Error handling pattern:** every normaliser throws `GiftCardCustomizationValidationError` (no message payload) — wrap in try/catch and return a discriminated `GiftCardFieldError` code instead of re-throwing. Do not change `parseGiftCardCustomization` (lines 97-115) or `canonicalGiftCardCustomization` (lines 117-125) — they stay the whole-object gate used by `checkout.ts`/`line-identity.ts`.

**Constants to reuse, not duplicate:** `GIFT_CARD_RECIPIENT_EMAIL_MAX_LENGTH` (254), `GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH` (100), `GIFT_CARD_MESSAGE_MAX_LENGTH` (500), `EMAIL_PATTERN`, `CONTROL_CHARACTERS` — all already exported or module-scoped in this file.

**Test analog:** `tests/unit/lib/gift-cards/customization.test.ts` (36 lines, read in full):
```typescript
import { describe, expect, it } from 'vitest';
import {
  GiftCardCustomizationValidationError,
  parseGiftCardCustomization,
} from '@/lib/gift-cards/customization';

describe('gift-card customization', () => {
  it('normalizes the exact public recipient projection', () => { /* toEqual(...) */ });
  it.each([ /* malformed cases */ ])('rejects malformed, oversized, or extra-key input', (value) => {
    expect(() => parseGiftCardCustomization(value)).toThrow(GiftCardCustomizationValidationError);
  });
});
```
New per-field-validator tests should extend this same file (or a sibling in the same directory) with the same `it.each` boundary-table style, asserting on the returned `GiftCardFieldError` code rather than a thrown error.

---

### `components/product/GiftCardRecipientForm.tsx` (new component, request-response)

**Analog:** `components/checkout/ShippingForm.tsx` (full 151 lines read) for controlled-input + submit-disabled-until-valid gating; `components/agent/AgentDrawer.tsx` (lines 39, 71) for the Clerk `useUser()` call shape.

**Imports pattern** (from `ShippingForm.tsx` lines 1-12, adapted):
```tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  validateRecipientEmail,
  validateRecipientName,
  validateMessage,
  validateDeliveryDate,
} from "@/lib/gift-cards/customization";
```

**Clerk auth/prefill pattern** (`components/agent/AgentDrawer.tsx:39,71`):
```tsx
import { useUser } from "@clerk/nextjs";
// ...
const { user } = useUser();
```
Per UI-SPEC, gate on `isLoaded && isSignedIn` (destructure all three: `const { isLoaded, isSignedIn, user } = useUser();`) so the "Send to myself" checkbox never flashes for guests during the loading tick.

**Core controlled-form + submit-gating pattern** (`ShippingForm.tsx` lines 31-41, 121-142):
```tsx
const isSubmitDisabled =
  disabled ||
  !(/* all required fields truthy */);
// ...
<Button onClick={() => onSubmit(...)} disabled={isSubmitDisabled}>Use Address</Button>
```
Adapt to: disable Add to Cart until `validateRecipientEmail(email) === null` and every optional-field validator returns `null` for whatever is currently filled in.

**Error display pattern** (per UI-SPEC, not yet in any existing file as inline field errors — `ShippingForm.tsx` only has one form-level error at lines 145-147: `<div className="text-danger text-sm font-medium mt-2">{error}</div>`). New pattern for this component:
```tsx
<p role="alert" id={`${field}-error`} className="mt-1 text-xs text-danger">{message}</p>
// paired with: <Input aria-invalid={!!error} aria-describedby={error ? `${field}-error` : undefined} />
```
`Input`/`Textarea` already carry `aria-invalid:border-danger` / `aria-invalid:ring-danger/20` built in — no new CSS needed.

**Add-to-cart submission pattern** (`app/product/[slug]/ProductDisplay.tsx` lines 326-365 — the block this form replaces):
```tsx
useCartStore.getState().addItem({
  productId: product.id,
  variantId: selectedVariant?.id,
  name: fullName,
  price: Money.fromMinor(price).toJSON(),
  quantity: 1,
  primaryImageUrl: /* ... */,
  giftCardCustomization: { recipientEmail, recipientName, message, deliveryDate }, // new — raw, un-normalized (D-09/Pitfall 3)
});
toast("Added to Cart", {
  description: `${fullName} has been added to your cart.`,
  icon: "🔥",
  action: { label: "View Cart", onClick: () => useCartUIStore.getState().openCart() },
});
```
Do not pre-normalize the customization before calling `addItem` — `normalizeCartItemForStore` inside the store already calls `parseGiftCardCustomization`.

---

### `components/gift-cards/GiftCardRecipientBlock.tsx` (new, RSC-safe presentational)

**Analog:** the inline "For …" fragments already in `CartItemCard.tsx` (lines 60-67) and `OrderItemCard.tsx` (lines 40-44) — this component is a direct extraction/generalization of that existing pattern, not a new design.

**Current inline pattern being replaced, `CartItemCard.tsx:60-67`:**
```tsx
{item.giftCardCustomization && (
  <p className="mt-1 text-xs text-muted-on-inverse">
    For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
    {item.giftCardCustomization.deliveryDate
      ? ` · Delivery ${item.giftCardCustomization.deliveryDate}`
      : ''}
  </p>
)}
```

**Current inline pattern being replaced, `OrderItemCard.tsx:40-44`:**
```tsx
{item?.giftCardCustomization && (
  <div className="text-xs text-muted-foreground">
    For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
  </div>
)}
```

**Required shape (no hooks, no handlers — pure props → JSX, must import cleanly into the RSC `app/account/orders/[id]/page.tsx`):**
```tsx
import type { GiftCardCustomization } from "@/lib/types/cartitem";

interface GiftCardRecipientBlockProps {
  customization: GiftCardCustomization;
  tone?: "default" | "inverse";
}

export default function GiftCardRecipientBlock({ customization, tone = "default" }: GiftCardRecipientBlockProps) {
  const toneClasses =
    tone === "inverse"
      ? { to: "text-on-inverse", rest: "text-muted-on-inverse" }
      : { to: "text-foreground", rest: "text-muted-foreground" };
  const to = customization.recipientName
    ? `To: ${customization.recipientName} <${customization.recipientEmail}>`
    : `To: ${customization.recipientEmail}`;
  const message = customization.message
    ? customization.message.length > 80
      ? `${customization.message.slice(0, 80)}…`
      : customization.message
    : undefined;
  return (
    <div className="text-xs">
      <p className={`mt-1 ${toneClasses.to}`}>{to}</p>
      {customization.deliveryDate && (
        <p className={`mt-1 ${toneClasses.rest}`}>Deliver: {customization.deliveryDate}</p>
      )}
      {message && (
        <p className={`mt-1 ${toneClasses.rest}`} title={customization.message}>{message}</p>
      )}
    </div>
  );
}
```
No `"use client"` directive — keeps this importable from both client components (`CartItemCard`, `OrderItemCard`) and the async RSC `app/account/orders/[id]/page.tsx` (Pitfall 6 in RESEARCH.md).

---

### `components/checkout/ShippingForm.tsx` (edit — additive optional props, D-01)

**Analog:** itself (full file, 151 lines read).

**Exact current heading and required-field code to extend, not replace:**
```tsx
// line 49
<h2 className="text-lg font-semibold mb-4">Shipping Address</h2>

// lines 31-41
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

**Additive props pattern:**
```tsx
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
// ...
<h2 className="text-lg font-semibold mb-4">{heading ?? "Shipping Address"}</h2>
{helperText && <p className="text-sm text-muted-foreground mb-4">{helperText}</p>}
```
`isSubmitDisabled` and every field stay byte-identical — do not relax required fields for the digital-only case (Pitfall 2).

---

### `components/checkout/ProgressBar.tsx` (edit — additive `steps?` prop, D-02)

**Analog:** itself (full file, 73 lines read). Note: current file has **no** `steps` prop today — labels are a hardcoded local array (`RESEARCH.md`'s claim of a pre-existing optional `steps?` prop is inaccurate; this prop must be added net-new).

**Exact current signature and hardcoded array to change:**
```tsx
// lines 6-12
export default function ProgressBar({ step }: { step: number }) {
  const steps = [
    "Shipping Address",
    "Shipping Method",
    "Payment Information",
    "Order Submitted",
  ];
```

**Additive pattern:**
```tsx
const DEFAULT_STEPS = [
  "Shipping Address",
  "Shipping Method",
  "Payment Information",
  "Order Submitted",
];

export default function ProgressBar({ step, steps = DEFAULT_STEPS }: { step: number; steps?: string[] }) {
  // fillWidths/isCompleted/isCurrent logic (lines 14-24, 29-30) already generic over steps.length — no other change
```
Caller (`CheckoutClient.tsx` line 267) must pass both the 3-item `steps` array and the shifted `step` index together (Pitfall 4): `steps={['Billing details', 'Payment', 'Order Submitted']}` with `step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 1 : 2}` for digital-only; omit both props (or pass the default 4-item array with `0/2/3`) otherwise.

---

### `components/checkout/CheckoutClient.tsx` (edit — digital-only derivation, snapshot-before-clear, D-01/D-02/D-11)

**Analog:** itself — existing step machine, `handleAddressSubmit`, two `clearCart()` call sites.

**Core pattern — digital-only boolean (no new store field, Pattern 3 in RESEARCH.md):**
```typescript
const isDigitalOnly = items.length > 0 &&
  items.every((item) => item.giftCardCustomization !== undefined);
```

**`handleAddressSubmit` branch** (existing fetch at line ~101 to `/api/shipping-options`) — skip the round trip for digital-only carts and call `createPaymentIntent` directly with a synthetic shipping option (`{ id: 'digital', label: 'Digital delivery', cost: Money.zero().toJSON(), estimatedDays: 0 }`); `createPaymentIntent` (line ~170) already only reads `selectedShippingOption.id` for `shippingMethodId`.

**Snapshot-before-`clearCart()` pattern (D-11) — both existing call sites:**
```tsx
// noCash branch, ~line 195
if (data.noCash) {
  setConfirmedItems(items);   // new — snapshot before clear
  clearCart();
  setGiftCardToken('');
  giftCardRequestKey.current = undefined;
  setCurrentStep('confirmation');
}

// handlePaymentSuccess, ~line 231
setConfirmedItems(items);   // new — snapshot before clear
clearPendingCheckout(paymentIntentId);
clearCart();
setCurrentStep('confirmation');
```
`items` is already destructured from `useCartStore()` at the top of the component — reuse it, don't re-fetch.

**Progress bar call site to update** (line 267):
```tsx
<ProgressBar step={currentStep === 'shipping' ? 0 : currentStep === 'payment' ? 2 : 3} />
```
becomes conditional per `isDigitalOnly` as described in the ProgressBar section above.

**Test analog** for new source-contract test (`tests/unit/components/cart-line-source.test.ts`, full 23 lines, read):
```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('...', () => {
  it('...', () => {
    const checkout = readFileSync(join(root, 'components/checkout/CheckoutClient.tsx'), 'utf8');
    expect(checkout).toContain('items.every((item) => item.giftCardCustomization !== undefined)');
    // ...
  });
});
```

---

### `components/checkout/OrderConfirmationModal.tsx` (edit — items list, D-11)

**Analog:** itself (existing `Dialog`/`DialogContent` shell, read lines 1-40+); `components/checkout/OrderItemCard.tsx` for the compact item-row shape to reuse inside the new section.

**Current imports/shell (lines 1-16):**
```tsx
"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  userId?: string | null;
}
```
Add `items?: StableCartItem[]` to the props interface; render a new `Order items` section between the existing order-ID block and `DialogFooter`, iterating `items` with the same `flex items-center gap-3 ... bg-surface-elevated` row shape `OrderItemCard.tsx` already establishes (lines 22-51), plus `<GiftCardRecipientBlock tone="default" customization={item.giftCardCustomization} />` under any line carrying `giftCardCustomization`. If `items` is empty/undefined, omit the section (no empty-state UI, per UI-SPEC).

---

### `components/cart/CartItemCard.tsx` (edit — swap inline block, D-10)

**Analog:** itself.

**Exact block to replace (lines 60-67):**
```tsx
{item.giftCardCustomization && (
  <p className="mt-1 text-xs text-muted-on-inverse">
    For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
    {item.giftCardCustomization.deliveryDate
      ? ` · Delivery ${item.giftCardCustomization.deliveryDate}`
      : ''}
  </p>
)}
```
**Replacement:**
```tsx
{item.giftCardCustomization && (
  <GiftCardRecipientBlock customization={item.giftCardCustomization} tone="inverse" />
)}
```
Add `import GiftCardRecipientBlock from "@/components/gift-cards/GiftCardRecipientBlock";` alongside the existing imports (lines 1-8).

---

### `components/checkout/OrderItemCard.tsx` (edit — swap inline block, D-10)

**Analog:** itself.

**Exact block to replace (lines 40-44):**
```tsx
{item?.giftCardCustomization && (
  <div className="text-xs text-muted-foreground">
    For {item.giftCardCustomization.recipientName || item.giftCardCustomization.recipientEmail}
  </div>
)}
```
**Replacement:**
```tsx
{item?.giftCardCustomization && (
  <GiftCardRecipientBlock customization={item.giftCardCustomization} />
)}
```
(tone defaults to `"default"`, no prop needed.)

---

### `app/account/orders/[id]/page.tsx` (edit — persisted `gift_card` block, D-12)

**Analog:** itself — async RSC, existing single-line `<li>` item row.

**Exact current row (line 17, minified JSX within the async component):**
```tsx
<li key={item.id ?? `${item.product_id}-${index}`} className="flex justify-between gap-4 py-3">
  <span>{item.product_name} × {item.quantity}</span>
  <span>{Money.fromStored(item.total_price).format()}</span>
</li>
```
**Pattern to extend to** (per UI-SPEC): when `item.gift_card` is present, wrap in `flex flex-col gap-1 py-3` and append a `<div className="text-sm text-muted-foreground space-y-0.5">` block rendering the same to/deliver/message lines as `GiftCardRecipientBlock` at `tone="default"`, full message (`whitespace-pre-line`, no 80-char truncation — detail view). `GiftCardRecipientBlock` itself has no hooks, so it can be imported directly here (see RSC-safety note above) — or, if the planner prefers not to truncate inside the shared component's fixed 80-char rule, inline the three lines directly using the same class conventions. No `"use client"` needed either way.

**Imports pattern already in this file (unchanged, lines 1-6):**
```tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getOrderByCustomerAndId } from "@/lib/models/mach/orders";
import { buildShipmentView } from "@/lib/fulfillment/shipment-view";
import { Money } from "@/lib/money";
```
Add `GiftCardRecipientBlock` import if reused directly.

---

## Shared Patterns

### Token-only styling (all files)
**Source:** every file above already uses only the frozen token classes (`bg-surface-elevated`, `text-muted-foreground`, `text-on-inverse`, `text-muted-on-inverse`, `text-danger`, `border-border`, `text-primary`). No new token role is introduced; `npm run scan:tokens` gate applies to every new/edited file.

### Additive-only validators
**Source:** `lib/gift-cards/customization.ts`
**Apply to:** `GiftCardRecipientForm.tsx`'s inline validation. Never re-implement the email regex, length caps, or control-character check anywhere else — always import from this module.

### Clerk `useUser()` gating
**Source:** `components/agent/AgentDrawer.tsx:39,71`
```tsx
import { useUser } from "@clerk/nextjs";
const { isLoaded, isSignedIn, user } = useUser();
```
**Apply to:** `GiftCardRecipientForm.tsx` ("Send to myself" checkbox, D-08) and `CheckoutClient.tsx`'s Billing details prefill (D-03).

### Source-contract test style (no jsdom)
**Source:** `tests/unit/components/cart-line-source.test.ts` (full file, 23 lines) and `tests/unit/lib/gift-cards/customization.test.ts` (full file, 36 lines).
**Apply to:** every new component test — `readFileSync` the `.tsx`/`.ts` source, assert literal substrings (prop names, function calls); pure-function tests import and call directly. Vitest environment is `"node"`, no `@testing-library/react` installed.

## No Analog Found

None — every file in scope has a direct or near-direct analog already in the codebase (this phase is explicitly additive UI over already-shipped server logic per RESEARCH.md's Summary).

## Metadata

**Analog search scope:** `lib/gift-cards/`, `components/checkout/`, `components/cart/`, `components/product/`, `components/agent/`, `app/product/[slug]/`, `app/account/orders/[id]/`, `tests/unit/components/`, `tests/unit/lib/gift-cards/`
**Files scanned:** 11 target files + 6 analog source files + 2 test analogs, all read in full this session
**Pattern extraction date:** 2026-09-08
