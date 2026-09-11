# Phase 18: Tech-Debt Closure - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 8 DEBT items, ~14 files touched
**Analogs found:** all resolved against real code read this session (no guessing)

## Locate-don't-assume resolutions (from the orchestrator's brief)

### 1. What gates checkout on `giftCardLineUnavailable` today

**Finding: nothing gates checkout on it client-side.** `components/cart/CartItemCard.tsx:16-25` computes the flag and its own doc comment says why:

```tsx
// A StableCartItem carries no product type, so the recipient details are what
// identify a gift-card line (D-09). Advisory only: the server refuses the
// line whatever this renders.
const giftCardLineUnavailable =
  item.giftCardCustomization !== undefined && !commerce.features.giftCardAcquisition;
```

It is rendered as a warning (`:68-72`) and nothing else — no `disabled` prop, no submit-blocking selector, no cart-store gate anywhere in the repo (`grep -rn "giftCardLineUnavailable"` returns only these two lines in `CartItemCard.tsx`). `CheckoutClient.tsx`'s `disabled={isLoading}` props are unrelated (loading-state only). The actual enforcement is server-side: `app/api/payment-intent/route.ts` and the checkout-pricing service reject/zero invalid gift-card lines on the authoritative path.

**Implication for DEBT-03:** `giftCardNoteInvalid` should follow the *exact same* pattern — an advisory-only warning in `CartItemCard.tsx`, no new client-side submit-blocking code to write, because there isn't one to mirror. D-03's "checkout continues to block the same way" is already true by construction: the server already can't parse/trust an unparseable gift-card customization on that line, so it fails there regardless of what the cart UI shows. Do not invent a client gate that doesn't exist for the flag being mirrored.

### 2. `scripts/check-migration-safety.mjs` exact current logic + existing test file

**Script:** `scripts/check-migration-safety.mjs` is a thin CLI wrapper. It:
1. `git diff --diff-filter=A --name-only <base>...HEAD -- migrations/` to find *added* `.sql` files only (already-applied history is never re-litigated — this matters for DEBT-07: the 0023 pair predates any diff base, so a duplicate-number check must compare against *all* files in `migrations/`, not just the added set, or it will never fire for historical collisions — it should fire when a *new* added file reuses a number already present in an existing file).
2. Calls `inspectMigration(file, text)` and `summarize(reports)` from `scripts/lib/migration-safety.mjs` (the pure/testable logic module).
3. Prints per-file status (`expand` / `acknowledged` / `contract`) and exits 1 if anything is `blocked`.

**Pure logic module:** `scripts/lib/migration-safety.mjs` exports `stripSqlComments`, `acknowledgement`, `inspectMigration(file, text)`, `summarize(reports)`. All are plain functions with no I/O — this is the natural home for a new `duplicateNumber`-style pure helper, matching Claude's-discretion note in CONTEXT.md ("recommended: inline, matching the script's existing style").

**Existing test file (the exact path RESEARCH said to locate):** `tests/unit/scripts/migration-safety.test.ts` — imports directly from `@/scripts/lib/migration-safety.mjs` (not the `.mjs` CLI script), asserting on `stripSqlComments`, `acknowledgement`, `inspectMigration`, `summarize`. A new duplicate-number test belongs in this same file, following its existing `describe(...)`/`it(...)` structure (see excerpt below).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/api/tax/route.ts` (delete) | route | request-response | n/a (deletion) | n/a |
| `lib/services/order-effects.ts` (edit) | service | event-driven | itself (surgical one-line removal) | exact |
| `lib/gift-cards/line-identity.ts` (edit) | utility | transform | itself; pattern to preserve: existing `null`-return branch becomes flagged-object branch | exact |
| `lib/stores/cart-store.ts` (edit) | store | transform | itself (`migrateCartState`'s existing `reduce`) | exact |
| `components/cart/CartItemCard.tsx` (edit) | component | request-response | itself — `giftCardLineUnavailable` block is the literal template to copy | exact |
| `lib/observability/telemetry.ts` (edit) | config | event-driven | itself — `gift_card.delivery_note_dropped` entry is the literal template | exact |
| `lib/services/gift-card-fulfillment.ts` (edit) | service | event-driven | itself — `recordDeliveryFailure` / `deliverOne` call sites | exact |
| `workers/observability-tail/src/core.ts` (edit, maybe) | config | pub-sub | itself — `TAIL_CRITICAL_EVENTS` array | exact |
| `lib/checkout/digital-only.ts`, `lib/gift-cards/checkout.ts` (doc-comment only) | utility | transform | each other (cross-reference) | exact |
| `lib/services/order-confirmation.ts` (edit) | service | request-response | itself — `buildFulfillmentOrderData` | exact |
| `app/account/orders/[id]/page.tsx` (edit) | route (RSC page) | request-response | itself — `address` read at `:17` | exact |
| `lib/utils/email.ts` (edit) | utility | transform | itself — two "Shipping Address" heading blocks (`:241`, `:436`) | exact |
| `scripts/check-migration-safety.mjs` / `scripts/lib/migration-safety.mjs` (edit) | utility/config | batch | itself — `inspectMigration`/`summarize` pattern | exact |
| `docs/database-migrations.md` (edit) | config (doc) | n/a | itself | exact |
| `tests/unit/scripts/migration-safety.test.ts` (edit) | test | batch | itself | exact |

## Pattern Assignments

### `app/api/tax/route.ts` — DEBT-01 (delete)

No pattern needed — delete the file and `tests/unit/api/tax-route.test.ts`. In `tests/unit/app/api/public-route-hardening.test.ts`, remove the three `/api/tax` references from whatever list/array enumerates hardened public routes (lines `:33,62,88` per RESEARCH — verify at edit time since line numbers drift). Do not add a 404 assertion.

---

### `lib/services/order-effects.ts` — DEBT-02

**Current line (~300):**
```ts
environment: runtime.giftCardEnvironment ?? (runtime.database ? { DB: runtime.database } : undefined)
```

**Target:**
```ts
environment: runtime.giftCardEnvironment
```

Regression test pattern: a source-contract test (grep-the-file-text style), same family as whatever asserts route-hardening lists — assert the string `{ DB:` never appears in `lib/services/order-effects.ts`'s source text. Place near existing `order-effects` tests (`tests/integration/lib/services/order-effects.test.ts` already exercises this code path at `:442`).

---

### `lib/gift-cards/line-identity.ts` — DEBT-03

**Current shape (~70-94), `normalizeCartItemForStore`:**
```ts
} catch {
  // ...
  return null;
}
```
(catch branch on `parseGiftCardCustomization` throwing, at the return-null point, line ~93)

**Target:** return the item unchanged (customization preserved verbatim, unparsed) plus `giftCardNoteInvalid: true`, mirroring the shape `giftCardLineUnavailable` already has as a boolean flag read by `CartItemCard.tsx`. Do not attempt to re-parse or repair the customization — pass it through as-is.

---

### `lib/stores/cart-store.ts` — DEBT-03

**Current (~377-404), `migrateCartState`:**
```ts
if (!normalized) return items;
```
inside `items.reduce(...)`. **Target:** keep the (now-never-null) normalized item in the accumulated array unconditionally — since `normalizeCartItemForStore` no longer returns `null`, this branch either becomes dead or is simplified away. Confirm the reduce's exact accumulator shape before editing (RESEARCH flags this as one of the smaller drift risks).

---

### `components/cart/CartItemCard.tsx` — DEBT-03

**Analog: the file's own existing `giftCardLineUnavailable` block — copy this pattern exactly, renamed.**

**Flag computation** (`:24-25`):
```tsx
const giftCardLineUnavailable =
  item.giftCardCustomization !== undefined && !commerce.features.giftCardAcquisition;
```
Add alongside:
```tsx
const giftCardNoteInvalid = item.giftCardNoteInvalid === true;
```

**Warning render** (`:68-72`):
```tsx
{giftCardLineUnavailable && (
  <p className="text-xs sm:text-sm text-warning mt-1">
    No longer available — remove this line to check out.
  </p>
)}
```
Add a sibling block using the same classes for `giftCardNoteInvalid`, copy text from D-03: "This gift note can no longer be sent — remove this line and add the item again to fix it."

**Type dependency:** `StableCartItem` (`lib/types/cartitem.ts`) needs the new `giftCardNoteInvalid?: boolean` field added — check that type definition before editing the component (not in the canonical refs list explicitly, but required for the flag to type-check).

---

### `lib/observability/telemetry.ts` — DEBT-04

**Analog: the existing `gift_card.delivery_note_dropped` entry (~:72) — copy its shape exactly.**

```ts
'gift_card.delivery_note_dropped': { severity: 'warning', sampleRate: <existing value — read at edit time> },
```

New entry to add:
```ts
'gift_card.delivery_retry': { severity: 'warning', sampleRate: <same value as delivery_note_dropped> },
```

Do **not** add this key to `workers/observability-tail/src/core.ts`'s `TAIL_CRITICAL_EVENTS` array (~:9-37) — that is the point of the split (it must stay non-paging).

---

### `lib/services/gift-card-fulfillment.ts` — DEBT-04

**Three call sites of `recordDeliveryFailure`** inside `deliverOne` (~427-516):
- `:458-460` — code-material-missing, always terminal, `retryable: false` — **unchanged**, stays `gift_card.delivery_failed`.
- `:495-500` — post-send failure branch, `retryable: status !== 'needs_review'` — **change**: emit `gift_card.delivery_retry` when `retryable`/not exhausted; emit `gift_card.delivery_failed` only when `exhausted`/`needs_review`.
- `:507-509` — catch block, `retryable: !exhausted` — same split as above.

Read `recordDeliveryFailure`'s exact signature (~113-127) before editing — it currently always emits `gift_card.delivery_failed`; the event name needs to become a parameter or the call sites need to choose the event name themselves before calling a shared emit helper. Keep `retryable` field on both events per D-04 ("stays on both events for continuity").

---

### `lib/checkout/digital-only.ts` / `lib/gift-cards/checkout.ts` — DEBT-05

No code-logic change. Add a doc comment in each file pointing at the other and at `tests/unit/lib/checkout/digital-only.test.ts` by path — e.g.:
```ts
/**
 * Client-side digital-only signal. Must stay logically equivalent to the
 * server-side `hasPhysicalCheckoutLines` in `lib/gift-cards/checkout.ts` —
 * the invariant is pinned by `tests/unit/lib/checkout/digital-only.test.ts`.
 * If you change this predicate's semantics, check that file too.
 */
```
Mirror in `checkout.ts` pointing back.

---

### `lib/services/order-confirmation.ts` — DEBT-06/07

**Current (`buildFulfillmentOrderData`, ~65-69):**
```ts
const address = order.shipping_address;
const extensions = order.extensions ?? {};
const addresslessDigitalOrder = extensions.subscription_shipping_required === false;
if ((!address && !addresslessDigitalOrder) || !order.id || order.items.length === 0) return null;
```

**Target:** import `hasPhysicalCheckoutLines` from `lib/gift-cards/checkout.ts` and replace the guard:
```ts
const address = order.shipping_address ?? (hasPhysicalCheckoutLines(order.items) ? undefined : order.billing_address);
const addresslessDigitalOrder = !hasPhysicalCheckoutLines(order.items);
if ((!address && !addresslessDigitalOrder) || !order.id || order.items.length === 0) return null;
```
(exact fallback expression to be finalized by the planner/executor — the key change is: `addresslessDigitalOrder` keys off `hasPhysicalCheckoutLines(order.items)` not the subscription extension flag, and when `shipping_address` is null on a digital-only order, `billing_address` becomes the display address.)

**Address rendering block** (~immediately after, inside the same function, `...(address ? { shippingAddress: {...} } : {})`) — this spread populates `OrderData.shippingAddress`, which both `lib/utils/email.ts` and `app/account/orders/[id]/page.tsx` read. To get a "Billing address" label swap without renaming the field everywhere, thread a boolean (e.g. `addressLabel: 'shipping' | 'billing'` or `isBillingAddressFallback: boolean`) onto the returned object alongside `shippingAddress`, consumed by the two render sites below. Confirm `OrderData`/`MerchantOrderData` type shape (imported from `lib/utils/email.ts`) before adding the field.

**Both consumers of `buildFulfillmentOrderData`:**
```ts
export async function buildOrderEmailData(order: Order): Promise<OrderData | null> {
  const data = await buildFulfillmentOrderData(order);
  ...
}
export async function buildMerchantOrderEmailData(order: Order): Promise<MerchantOrderData | null> {
  const data = await buildFulfillmentOrderData(order);
  ...
}
```
One fix in `buildFulfillmentOrderData` closes both emails, confirmed by CONTEXT.md D-06.

---

### `lib/utils/email.ts` — DEBT-06 (label swap)

**Two near-identical "Shipping Address" heading blocks to update, both currently hardcoded:**

Customer confirmation template (~:238-246):
```ts
${orderData.shippingAddress ? `
  <!-- Shipping Address -->
  <div style="padding: 24px 32px;">
    <h3 style="color: ${tokens.onInverse}; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Shipping Address</h3>
    ...
```

Merchant notification template (~:434-441, no ternary — assumes address always present):
```ts
<!-- Shipping Address -->
<div style="padding: 24px 32px;">
  <h3 style="color: ${tokens.onInverse}; font-size: 18px; font-weight: bold; margin: 0 0 12px;">Shipping Address</h3>
  ...
```

**Target:** both headings become conditional on whatever label signal `order-confirmation.ts` now threads through (e.g. `orderData.addressLabel === 'billing' ? 'Billing Address' : 'Shipping Address'`). Only the heading text changes — the address fields below it (`street`, `city`, `state`, `zipCode`, `country`) stay under the same `orderData.shippingAddress.*` property names (D-06 explicitly keeps this a label swap, not a field rename). There's a third reference at `:513-518` building a plain-text address block for (likely) a notification digest — check whether it needs the same label treatment.

---

### `app/account/orders/[id]/page.tsx` — DEBT-07 (D-07)

**Current (`:17`, and inline in the JSX return at the same block):**
```tsx
const address = order.shipping_address;
...
{address && <section ...><h2 className="font-semibold">Shipping address</h2>
  <p ...>{[address.recipient, address.line1, address.line2, `${address.city}, ${address.region ?? ""} ${address.postal_code ?? ""}`, address.country].filter(Boolean).join("\n")}</p>
</section>}
```

**Target:**
```tsx
const address = order.shipping_address ?? order.billing_address;
const addressLabel = order.shipping_address ? "Shipping address" : "Billing address";
```
and the heading becomes `<h2 className="font-semibold">{addressLabel}</h2>`. This file's JSX is a single unbroken expression (no intermediate variables today) — the executor will need to either extract a local variable before the `return` or restructure minimally; don't let that turn into a larger refactor of the page.

---

### `scripts/lib/migration-safety.mjs` / `scripts/check-migration-safety.mjs` — DEBT-07 (D-11)

**Analog: `inspectMigration`/`summarize`'s existing pure-function style — copy this shape for the new check.**

```ts
export function inspectMigration(file, text) {
  const statements = stripSqlComments(text);
  const contractions = CONTRACT_PATTERNS
    .filter(({ pattern }) => pattern.test(statements))
    .map(({ label }) => label);

  if (!contractions.length) return { file, status: "expand" };

  const reason = acknowledgement(text);
  return reason
    ? { file, status: "acknowledged", contractions, reason }
    : { file, status: "contract", contractions };
}
```

New logic needed: extract each migration filename's leading number (e.g. `/^(\d+)_/`), compare newly-added files' numbers against numbers already present among **all** files in `migrations/` (not just the diff's added set — existing files are the collision universe). This differs from `inspectMigration`'s single-file scope; it needs to read the full `migrations/` directory listing, which `check-migration-safety.mjs`'s CLI wrapper already has access to via its `git diff` step — extend the wrapper to also `readdirSync('migrations/')` for the full set, and add a pure helper (e.g. `findDuplicateNumbers(addedFiles, allFiles)`) in `scripts/lib/migration-safety.mjs` next to `inspectMigration`.

The 0023 pair (`0023_add_order_effects_payload.sql` / `0023_normalize_tax_category_codes.sql`) is **already-applied history** and must not trigger a failure retroactively — the check only fires when a *newly added* file's number collides with any existing file's number (added or already-applied). Both 0023 files are pre-existing, so a correct implementation naturally leaves them alone; a naive "no duplicate numbers anywhere in migrations/" check would incorrectly fail CI today and must be avoided.

**Test file to extend — exact path confirmed:** `tests/unit/scripts/migration-safety.test.ts`

**Existing test structure to copy** (verbatim excerpt):
```ts
import { describe, expect, it } from "vitest";
import {
  acknowledgement,
  inspectMigration,
  stripSqlComments,
  summarize,
} from "@/scripts/lib/migration-safety.mjs";

describe("inspectMigration", () => {
  it("treats additive migrations as expand", () => {
    const report = inspectMigration(
      "migrations/0018_add_thing.sql",
      "ALTER TABLE orders ADD COLUMN thing TEXT;\nCREATE TABLE x (id TEXT PRIMARY KEY);",
    );
    expect(report.status).toBe("expand");
  });
  ...
```
New `describe("findDuplicateNumbers", ...)` (or whatever name is chosen) block follows this same `it(...)` style, with a fixture pair of filenames sharing a leading number, per D-14's "unit test using a fixture pair."

---

## Shared Patterns

### Advisory-only cart flags
**Source:** `components/cart/CartItemCard.tsx:16-25, 68-72`
**Apply to:** DEBT-03's `giftCardNoteInvalid` — same component, same CSS classes (`text-xs sm:text-sm text-warning mt-1`), same "advisory only, server is authoritative" doc-comment convention.

### Telemetry severity template
**Source:** `lib/observability/telemetry.ts` — `gift_card.delivery_note_dropped` entry
**Apply to:** DEBT-04's new `gift_card.delivery_retry` entry — same `{ severity: 'warning', sampleRate }` shape, deliberately absent from `TAIL_CRITICAL_EVENTS`.

### `hasPhysicalCheckoutLines` as the single authoritative digital-only signal
**Source:** `lib/gift-cards/checkout.ts:52-58`
**Apply to:** DEBT-06's `order-confirmation.ts` fix (replaces the subscription-only flag check) — this is the same function DEBT-05's invariant test already pins against `isDigitalOnlyCart`, so reusing it here doesn't introduce a fourth signal.

### Pure-function-plus-CLI-wrapper split
**Source:** `scripts/lib/migration-safety.mjs` (pure) / `scripts/check-migration-safety.mjs` (I/O: git diff, readFileSync, process.exit)
**Apply to:** DEBT-07's duplicate-number check — new pure logic goes in `scripts/lib/migration-safety.mjs`, directory/file-listing I/O stays in the CLI wrapper, matching the existing separation so the new check stays unit-testable without shelling out.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `docs/database-migrations.md` paragraph (D-11) | config (doc) | n/a | Prose addition, no code pattern needed — write directly per D-11's description. |
| `.planning/WINDOWS.md` entries #2, #5, #6 closures | config (doc) | n/a | Closed via `windows fixed <id>` tool convention already established in this repo's planning workflow, not a code pattern. |

## Metadata

**Analog search scope:** `components/cart/`, `lib/services/`, `lib/gift-cards/`, `lib/observability/`, `lib/stores/`, `app/api/`, `app/account/orders/[id]/`, `lib/utils/email.ts`, `scripts/`, `tests/unit/scripts/`, `workers/observability-tail/src/`
**Files scanned:** all 15 canonical-ref files read directly this session plus grep sweeps for `giftCardLineUnavailable`, `check-migration-safety`, `Shipping address`, `billing_address`
**Pattern extraction date:** 2026-09-11

## PATTERN MAPPING COMPLETE
