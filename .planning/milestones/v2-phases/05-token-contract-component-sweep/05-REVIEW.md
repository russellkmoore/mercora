---
phase: 05-token-contract-component-sweep
reviewed: 2026-09-04T18:21:48Z
depth: standard
files_reviewed: 98
files_reviewed_list:
  - .gitignore
  - app/account/gift-cards/page.tsx
  - app/account/layout.tsx
  - app/account/orders/[id]/page.tsx
  - app/account/orders/page.tsx
  - app/account/page.tsx
  - app/account/settings/page.tsx
  - app/account/subscriptions/page.tsx
  - app/blog/[slug]/page.tsx
  - app/blog/page.tsx
  - app/category/[slug]/CategoryDisplay.tsx
  - app/category/[slug]/page.tsx
  - app/checkout/page.tsx
  - app/checkout/success/page.tsx
  - app/error.tsx
  - app/global-error.tsx
  - app/globals.css
  - app/layout.tsx
  - app/not-found.tsx
  - app/order-status/[id]/page.tsx
  - app/page.tsx
  - app/product/[slug]/page.tsx
  - app/product/[slug]/ProductDisplay.tsx
  - components/account/AccountNav.tsx
  - components/account/AddressManager.tsx
  - components/account/GiftCardDashboard.tsx
  - components/account/ProfileSettings.tsx
  - components/account/SubscriptionManager.tsx
  - components/agent/AgentDrawer.tsx
  - components/agent/ProductCard.tsx
  - components/blog/BlogIndex.tsx
  - components/Breadcrumbs.tsx
  - components/cart/CartDrawer.tsx
  - components/cart/CartItemCard.tsx
  - components/checkout/CheckoutClient.tsx
  - components/checkout/DiscountCodeInput.tsx
  - components/checkout/OrderConfirmationModal.tsx
  - components/checkout/OrderItemCard.tsx
  - components/checkout/OrderSummary.tsx
  - components/checkout/PaymentForm.tsx
  - components/checkout/ProgressBar.tsx
  - components/checkout/ShippingForm.tsx
  - components/checkout/ShippingOptions.tsx
  - components/checkout/StripeProvider.tsx
  - components/Footer.tsx
  - components/HeaderClient.tsx
  - components/login/ClerkLogin.tsx
  - components/OrderCard.tsx
  - components/pages/ContactGrid.tsx
  - components/pages/FaqAccordion.tsx
  - components/pages/LegalDocument.tsx
  - components/pages/PageCta.tsx
  - components/pages/PageHero.tsx
  - components/pages/PageRail.tsx
  - components/pages/SectionCard.tsx
  - components/pages/StoryBody.tsx
  - components/ProductCard.tsx
  - components/ProductRecommendations.tsx
  - components/PromotionalBanner.tsx
  - components/reviews/ProductReviewsSection.tsx
  - components/reviews/ReviewForm.tsx
  - components/reviews/StarRating.tsx
  - components/subscriptions/SubscriptionAcquisitionPanel.tsx
  - components/subscriptions/SubscriptionSetupReturnHandler.tsx
  - components/ui/alert-dialog.tsx
  - components/ui/badge.tsx
  - components/ui/button.tsx
  - components/ui/card.tsx
  - components/ui/checkbox.tsx
  - components/ui/dialog.tsx
  - components/ui/dropdown-menu.tsx
  - components/ui/input.tsx
  - components/ui/loading.tsx
  - components/ui/navigation-menu.tsx
  - components/ui/select.tsx
  - components/ui/sheet.tsx
  - components/ui/switch.tsx
  - components/ui/table.tsx
  - components/ui/textarea.tsx
  - components/ui/toggle.tsx
  - lib/email/footer.ts
  - lib/fulfillment/shipping-email.ts
  - lib/payments/refund-email.ts
  - lib/store-config.ts
  - lib/store/index.ts
  - lib/store/StoreConfigProvider.tsx
  - lib/subscriptions/lifecycle-email.ts
  - lib/themes/tokens.ts
  - lib/utils/email.ts
  - lib/utils/review-notifications.ts
  - package.json
  - scripts/scan-hardcoded-colors.mjs
  - scripts/screenshot-routes.mjs
  - tailwind.config.ts
  - tests/unit/lib/themes/token-contract.test.ts
  - tests/unit/scripts/scan-hardcoded-colors.test.ts
  - tests/unit/tailwind-config.test.ts
  - themes/volt-dark.css
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-04T18:21:48Z
**Depth:** standard
**Files Reviewed:** 98
**Status:** issues_found

## Summary

Reviewed the full token-contract sweep: the frozen 23-token contract
(`themes/volt-dark.css` → `tailwind.config.ts` → `lib/themes/tokens.ts`), the
server→client token bridge (`StoreConfigProvider`, `app/layout.tsx`,
`StripeProvider`, `ClerkLogin`), the six transactional-email builders, the two
new tooling scripts, and every swept `app/`/`components/` file.

The token contract itself is solid: `tailwind.config.ts` generates exactly
the 17 colour + 4 radius tokens declared in `themes/volt-dark.css`, a
contract test asserts byte parity between the CSS file and
`lib/themes/tokens.ts`, and a whole-tree grep across all 94 reviewed
source/style files found zero invalid Tailwind class names (no bare
`border-inverse`, no dangling `-foreground` shadcn vocabulary, etc.) — the
component sweep was executed correctly.

The one BLOCKER is unrelated to token *naming* and everything to do with a
copy‑paste mistake made while migrating literal hex strings to token
interpolation in `lib/utils/email.ts`: the `statusColor` variable in
`generateOrderStatusUpdateHTML()` is assigned with **double quotes**, not
backticks, so `${tokens.info}` etc. never gets evaluated — every "shipped",
"delivered", "cancelled", "refunded", and "processing" order-status email
literally renders the string `${tokens.info}` as its CSS `color` value
instead of a hex colour. This ships broken (uncoloured / browser-ignored)
styling in every order-status transactional email sent by the store.

Two warnings and two info items are also recorded below, covering a minor
information-disclosure (an internal ops email address bridged into the
client bundle), a leftover `console.log` of a full order payload, and two
small code-quality items.

## Critical Issues

### CR-01: Order-status email `statusColor` is a literal string, not a template interpolation

**File:** `lib/utils/email.ts:292,298,304,324,333,347`
**Issue:**
`generateOrderStatusUpdateHTML()` sets a per-status colour like this:

```ts
let statusColor = "${tokens.mutedOnInverse}";   // line 292
...
case 'processing':
  statusColor = "${tokens.info}";               // line 298
...
case 'shipped':
  statusColor = "${tokens.success}";             // line 304
...
case 'delivered':
  statusColor = "${tokens.success}";             // line 324
...
case 'cancelled':
  statusColor = "${tokens.danger}";              // line 333
...
case 'refunded':
  statusColor = "${tokens.primary}";             // line 347
```

These are **double-quoted strings, not template literals** — there are no
backticks — so `${tokens.info}` is never evaluated. `statusColor` literally
equals the 15-character string `${tokens.info}` (etc.). This value is then
interpolated into the outer template literal at two places:

```ts
// line 401
<h2 style="color: ${statusColor}; font-size: 24px; ...">${statusMessage}</h2>
// line 408
<p ...>Status: <span style="color: ${statusColor}; font-weight: bold;">...
```

which produces literal, invalid CSS in the shipped HTML, e.g.:

```html
<h2 style="color: ${tokens.info}; font-size: 24px; ...">
```

Every mail client will ignore this malformed declaration and fall back to
default/inherited text colour. This affects the status heading and status
badge colour in **every** order-status update email (`processing`,
`shipped`, `delivered`, `cancelled`, `refunded`) — i.e. every transactional
status-change email the store sends. This is a correctness regression
introduced while migrating the function from static hex literals to
`getThemeTokens()` interpolation (the surrounding `statusContent` blocks in
the same function correctly use backtick template literals).

Confirmed no other email builder in scope (`footer.ts`, `shipping-email.ts`,
`refund-email.ts`, `lifecycle-email.ts`, `review-notifications.ts`) has this
pattern — a repo-wide grep for `"${` / `'${` (non-backtick) across
`lib/`, `app/`, `components/`, `scripts/` found only these six lines.

**Fix:**
```ts
let statusColor = `${tokens.mutedOnInverse}`;
...
case 'processing':
  statusColor = `${tokens.info}`;
...
```
(Backtick every assignment, or simplify to plain `tokens.info` etc. since no
other interpolation is happening in the assignment itself — e.g.
`statusColor = tokens.info;`.)

## Warnings

### WR-01: Internal merchant notification email is bridged into the client bundle

**File:** `lib/store/StoreConfigProvider.tsx:10-24` (root cause: `lib/store-config.ts:36,388`, consumed only server-side by `lib/utils/email.ts:496` and `lib/services/order-confirmation.ts:149`)
**Issue:** `app/layout.tsx` calls `getStoreConfig()` on the server and passes
the *entire* `StoreConfig` object as a prop into `<StoreConfigProvider>`, a
client component. Next.js serializes that whole object into the RSC payload
sent to every visitor's browser. `StoreConfig.contact.merchantNotificationEmail`
(an internal operator inbox used only by `sendNewOrderMerchantNotification`
and the order-confirmation service, both server-only) is included in that
object and therefore visible to anyone who inspects the page source /
RSC payload, even though no client code ever reads that field. This is a
minor information-disclosure: an internal operational email address
(a plausible phishing/spam target) leaks to the public when the store
operator configures `STORE_MERCHANT_NOTIFICATION_EMAIL`.
**Fix:** Strip server-only fields before constructing the client-facing
config, e.g. build a narrower `PublicStoreConfig` (omitting
`contact.merchantNotificationEmail`) for `StoreConfigProvider`, and keep
`getStoreConfig()` (full object) for server call sites only:
```ts
const { merchantNotificationEmail, ...publicContact } = config.contact;
<StoreConfigProvider config={{ ...config, contact: publicContact }} themeTokens={themeTokens}>
```

### WR-02: Full order response logged to console in checkout success path

**File:** `components/checkout/CheckoutClient.tsx:229`
**Issue:**
```ts
const orderResponse = await res.json();
console.log('Order created successfully:', orderResponse);
```
This is a leftover debug statement that dumps the entire `/api/orders`
response — which can include customer name, shipping address, line items,
and pricing — to the browser devtools console in production. This is an
unnecessary data exposure in a customer-facing checkout flow and should be
removed (or gated behind a dev-only flag).
**Fix:** Remove the `console.log`, or replace with a scoped debug log that
is stripped in production builds.

## Info

### IN-01: `GiftCardDashboard` duplicates its own fetch logic instead of calling `load()`

**File:** `components/account/GiftCardDashboard.tsx:41-66`
**Issue:** A `load` callback (lines 41-52) is defined via `useCallback` to
fetch `/api/gift-cards`, but it is only ever invoked from the "Try again"
retry button (line 69). The mount-time `useEffect` (lines 53-66) does not
call `load()` — it re-implements the identical fetch/parse/error-handling
logic inline. The two code paths are functionally equivalent today but must
be kept in sync by hand on every future change, and the duplication makes it
easy to introduce divergent behavior later (e.g. the inline effect uses an
`active` flag for cancellation while `load()` does not).
**Fix:** Have the mount effect call `load()` directly:
```ts
useEffect(() => {
  void load();
}, [load]);
```
(and add cancellation inside `load()` if needed), removing the duplicated
fetch block.

### IN-02: Unused imports in `screenshot-routes.mjs`

**File:** `scripts/screenshot-routes.mjs:9`
**Issue:** `existsSync`, `statSync`, `readdirSync`, and `unlinkSync` are
imported from `node:fs` but never used anywhere in the script (only
`mkdirSync`, `readFileSync`, and `appendFileSync` are called).
**Fix:**
```js
import { mkdirSync, readFileSync, appendFileSync } from "node:fs";
```

---

_Reviewed: 2026-09-04T18:21:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
