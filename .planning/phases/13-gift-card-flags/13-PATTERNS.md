# Phase 13: Gift-Card Flags - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 20 (new + modified)
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/commerce/product-visibility.ts` (NEW, aka `lib/gift-cards/visibility.ts` per CONTEXT) | utility | transform | `lib/checkout/digital-only.ts` | exact (small pure predicate module + paired unit test) |
| `lib/commerce/capabilities.ts` (edit: remove acquisition-gated tender wrapper) | service | transform | itself (`resolveCommerceCapabilities`, existing) | exact — edit in place |
| `lib/gift-cards/repository.ts` (export `availableBalanceExpression`, add `sumOutstandingGiftCardBalances`) | model | CRUD | itself (existing repository closures) | exact — edit in place |
| `lib/gift-cards/outstanding.ts` or inline in `scheduled.ts` (honor-guard read/write) | service | batch | `app/api/webhooks/stripe/handlers/refund-handlers.ts:113-128` (`readExternalRestockEnabled`) | exact (raw D1 `prepare` read/write of `admin_settings`) |
| `lib/observability/scheduled.ts` (add measurement + telemetry emit) | service | batch | itself (existing cron tick, `drainOrderEffects` call) | exact — edit in place |
| `lib/observability/telemetry.ts` (register `gift_card.honor_disabled_with_balances`) | config | event-driven | `lib/observability/telemetry.ts:67` (`gift_card.delivery_failed` entry, Phase 12) | exact |
| `workers/observability-tail/src/core.ts` (add event to `TAIL_CRITICAL_EVENTS`) | config | event-driven | `workers/observability-tail/src/core.ts:31` (`gift_card.delivery_failed`) | exact |
| `app/page.tsx`, `app/category/[slug]/page.tsx`, `lib/recommendations/index.ts`, `lib/mcp/tools/*` (filter through predicate) | route/service | request-response | `app/api/products/route.ts:71-95` (`filterByStatus` composition) | exact (same compose-a-second-filter shape) |
| `app/api/products/route.ts` (filter `!isAdmin` branch only) | route | request-response | itself, `filterByStatus` (lines 71-95) | exact — edit in place |
| `app/product/[slug]/page.tsx` (both-off → `notFound()`, sell-off/honor-on → pass unavailable prop) | route | request-response | `app/account/subscriptions/page.tsx:1-8` | exact (flag-off `notFound()` pattern) |
| `app/product/[slug]/ProductDisplay.tsx` (new unavailable branch) | component | request-response | itself, lines 363-378 (existing gift-card `available` branch) | exact — extend existing conditional |
| `lib/services/checkout-pricing.ts` (reject gift-card line when sell=off) | service | transform | itself, existing gift-card line branch (already rejects uncustomized lines) | exact — edit in place |
| `app/api/payment-intent/route.ts` (map new error → `{ code: 'gift_card_sale_unavailable' }` or similar) | route | request-response | itself, lines 150-171 (`GiftCardTenderUnavailableError` → `code: 'gift_card_unavailable'`) | exact — copy the catch-branch shape |
| `components/cart/CartItemCard.tsx` (unavailable mark on gift-card line) | component | request-response | `components/gift-cards/GiftCardRecipientBlock.tsx` (existing gift-card-aware cart sibling) | role-match (first `useStoreConfig()` usage in this file) |
| `components/checkout/CheckoutClient.tsx` (gate `<GiftCardApplyPanel>` on honor) | component | request-response | itself, existing conditional render points | exact — edit in place |
| `components/admin/AdminSidebar.tsx` (filter "Gift cards" navItem) | component | request-response | itself, `navItems` array (lines 58-100) + `store` from `useStoreConfig()` (line 138) | exact — edit in place, mirrors how `Subscriptions` item would be gated |
| `app/admin/gift-cards/page.tsx` (both-off → 404) | route | request-response | `app/account/subscriptions/page.tsx:1-8` | exact |
| `app/api/admin/gift-cards/route.ts`, `app/api/gift-cards/balance/route.ts` (verify/align 404 gating) | route | request-response | `app/api/subscriptions/route.ts:36-40` | exact |
| `docs/runtime-configuration.md` (rewrite flag rows) | config/docs | — | itself, lines 20-22, 58, 64-76 | exact — edit in place |
| `docs/DEPLOYMENT_SETUP.md` §9 | config/docs | — | same doc's existing §9 prose | exact — edit in place |
| `tests/unit/lib/commerce/capabilities.test.ts` (rewrite backwards-pinning test) | test | — | itself, lines 118-149 | exact — rewrite in place |

## Pattern Assignments

### `lib/gift-cards/visibility.ts` (utility, transform)

**Analog:** `lib/checkout/digital-only.ts` (full file, 36 lines, read verbatim)

**Structure to copy** — small pure module, one doc comment explaining *why* this signal is sufficient today, one or two narrow exported functions, no I/O:
```typescript
// Source: lib/checkout/digital-only.ts:29-36 (verbatim shape to follow)
export function isDigitalOnlyCart(
  items: readonly { giftCardCustomization?: unknown }[]
): boolean {
  return items.length > 0 && items.every((item) => item.giftCardCustomization !== undefined);
}
```
For the new module, mirror this shape with a predicate over the flags object already carried by
`CommerceFeatureFlags`/`getStoreConfig().commerce.features`:
```typescript
// New file shape (not verbatim, follow the digital-only.ts convention)
export function hidesGiftCardsFromListings(features: {
  giftCardAcquisition: boolean;
  giftCardReconciliation: boolean;
}): boolean {
  return !features.giftCardAcquisition; // sell off (regardless of honor) hides listings, per D-07
}

export function isPubliclyVisibleProduct(
  product: { type: string },
  features: { giftCardAcquisition: boolean }
): boolean {
  if (product.type !== 'gift_card') return true;
  return features.giftCardAcquisition;
}
```
**Test analog:** `tests/unit/lib/checkout/digital-only.test.ts` — pure input/output table tests, no
mocking, no DB. Also `tests/unit/components/checkout-digital-only-source.test.ts` — a
"source-contract" test that asserts the *string content* of a component file references the shared
predicate rather than re-deriving the logic inline; copy this shape for the surfaces below that
must call `isPubliclyVisibleProduct`/`hidesGiftCardsFromListings` instead of re-checking
`product.type === 'gift_card'` locally.

---

### `lib/commerce/capabilities.ts` (edit) — D-03 tender gating fix

**Analog:** itself. `resolveCommerceCapabilities` (lines 133-220, read verbatim) already has the
exact shape needed for the subscriptions capability (`gatedSubscriptions`, lines 168-178) —
gate-only-the-acquisition-guard pattern with a no-op fallback for the fully-disabled case. The
gift-card block (`gatedGiftCards`, lines 180-208) currently reads:
```typescript
// Source: lib/commerce/capabilities.ts:180-181 (verbatim, THE BUG)
  const gatedGiftCards: GiftCardCheckoutCapability = (
    giftCards === noOpCommerceCapabilities.giftCards || flags.giftCardAcquisition
  ) ? giftCards : { /* wrapper that rejects nonempty tokens */ }
```
Fix: this whole `gatedGiftCards` wrapper block is deleted per D-03 — tender resolution now follows
`flags.giftCardReconciliation` only (already the gate on `resolve(...)` at line 173: `flags.giftCardAcquisition
|| flags.giftCardReconciliation`, which stays as-is since it decides whether the capability
*object* exists at all, not which operations it permits). Return `giftCards` directly instead of
`gatedGiftCards`.

The startup-throw for sell-without-honor (D-02, GCF-04) stays untouched:
```typescript
// Source: lib/commerce/capabilities.ts:157-161 (verbatim, KEEP)
  if (flags.giftCardAcquisition && !flags.giftCardReconciliation) {
    throw new CommerceCapabilityConfigurationError(
      "Gift-card acquisition requires reservation reconciliation",
    );
  }
```

**Test analog:** `tests/unit/lib/commerce/capabilities.test.ts:118-149` — the test titled
`"keeps reconciliation installed while acquisition rejects nonempty tokens"` currently asserts the
backwards behavior (resolveTender rejects when `giftCardAcquisition: false, giftCardReconciliation:
true`). Rewrite this test in the same commit to assert `resolveTender` **succeeds** with a nonempty
token in that state (sell off, honor on → redemption works). The surrounding tests at lines 100-115
(`"requires gift-card reconciliation before accepting new tender"`) and 152+ (`noOpCommerceCapabilities`
rejection tests) stay as reference shape for the new assertions.

---

### `lib/gift-cards/repository.ts` + `lib/observability/scheduled.ts` — outstanding-balance measurement (D-05, D-06, D-15)

**Analog for the D1 read/write shape:** `app/api/webhooks/stripe/handlers/refund-handlers.ts:113-128`
(full function read verbatim):
```typescript
// Source: app/api/webhooks/stripe/handlers/refund-handlers.ts:113-128 (verbatim)
export async function readExternalRestockEnabled(database: D1Database): Promise<boolean> {
  const setting = await database.prepare(
    'SELECT value FROM admin_settings WHERE key = ?'
  ).bind(EXTERNAL_RESTOCK_SETTING).first<{ value: string }>();
  if (!setting) return false;
  let value: unknown;
  try {
    value = JSON.parse(setting.value);
  } catch {
    throw new Error('External refund restock setting contains malformed JSON');
  }
  if (typeof value !== 'boolean') {
    throw new Error('External refund restock setting must be boolean');
  }
  return value;
}
```
Copy this shape for both the read (capability resolution / admin page, honor=off path) and the
write (cron tick): raw `database.prepare(...).bind(...).first/.run()`, no `getSettings()` /
Drizzle helper, JSON.parse/stringify with a try/catch, explicit shape validation before trusting
the parsed value. Use key `gift_cards.honor_guard` and `data_type: 'object'`
(`lib/db/schema/settings.ts:15,70-80` — the `data_type` free-text column convention, `'object'`
used by `shipping.methods`).

**Analog for the SQL to reuse:** `lib/gift-cards/repository.ts:180` `availableBalanceExpression`
(module-private today — must add `export` or wrap it in a new exported
`sumOutstandingGiftCardBalances(database, now)` per RESEARCH.md Pitfall 3). Do not hand-roll a
second SUM/COUNT expression.

**Analog for where the cron calls in:** `lib/observability/scheduled.ts:23-27,35` — `handleScheduled(controller,
env: CloudflareEnv, ctx)` already holds `env.DB` directly and calls `drainOrderEffects({ database:
env.DB, ... })`. Add the measurement call alongside this, passing `env.DB` directly — do **not**
route through `getCloudflareContext()` (RESEARCH.md Pitfall 6, the cron path is not a request path).

**Analog for the flag-string normalizer:** reuse one of the three existing boolean readers rather
than writing a fourth: `lib/commerce/runtime.ts:12-14`, `lib/observability/scheduled.ts:11-12`, or
`lib/store-config.ts` `bool()` (all do `.trim().toLowerCase() === 'true'`).

**Test analogs:**
- `tests/unit/lib/gift-cards/repository.test.ts` (if present) for balance-expression correctness — check for existing SUM/reservation test shape before writing a new one.
- An integration test on the cron alarm per CONTEXT.md D-16 discretion — model on `tests/integration/lib/services/gift-card-fulfillment.test.ts` (already exercises `gift_card.delivery_failed` end to end against the Worker environment) for the "runs against a real D1 binding, asserts telemetry emitted" shape.

---

### New critical telemetry event: `gift_card.honor_disabled_with_balances`

**Analog:** Phase 12's `gift_card.delivery_failed` registration.
```typescript
// Source: lib/observability/telemetry.ts:67 (verbatim, existing entry to pattern-match)
  'gift_card.delivery_failed': { severity: 'critical', sampleRate: 1 },
```
Add directly beneath it:
```typescript
  'gift_card.honor_disabled_with_balances': { severity: 'critical', sampleRate: 1 },
```
```typescript
// Source: workers/observability-tail/src/core.ts:31 (verbatim, existing entry to pattern-match)
  'gift_card.delivery_failed',
```
Add to the `TAIL_CRITICAL_EVENTS` array (lines 9-37) alongside it.

**Test analog (parity gate):** `tests/unit/workers/observability-tail-core.test.ts:63-69` —
```typescript
// Source: tests/unit/workers/observability-tail-core.test.ts:63-69 (verbatim)
  it('keeps the exact producer marker and critical taxonomy synchronized', () => {
    expect(TAIL_TELEMETRY_MARKER).toBe(TELEMETRY_MARKER);
    for (const event of TAIL_CRITICAL_EVENTS) {
      expect(TELEMETRY_EVENTS[event].severity).toBe('critical');
    }
    expect([...TAIL_ROUTE_PATHS]).toEqual([...TELEMETRY_PATHS]);
  });
```
This test already fails loudly if the new event is registered in one file but not the other, or
registered at a severity other than `'critical'` — no new test needed, just keep both edits in the
same commit. `recordTelemetry(...)` call-site shape: search `recordTelemetry('gift_card.delivery_failed'`
in `lib/services/gift-card-fulfillment.ts` (or wherever Phase 12 wired it) for the call signature to copy.

---

### `app/api/products/route.ts` + listing surfaces (D-08, D-14)

**Analog:** `app/api/products/route.ts:71-95` (`filterByStatus`, verbatim above in research). Add a
second filter composed the same way, applied only in the `!isAdmin` branch:
```typescript
// Compose alongside filterByStatus, same file, same shape
const filterByGiftCardVisibility = (products: Product[]): Product[] =>
  isAdmin ? products : products.filter((p) => isPubliclyVisibleProduct(p, features));
```
Apply at each of: `app/page.tsx` (featuredProducts), `app/category/[slug]/page.tsx`,
`lib/recommendations/index.ts:16` (listProducts caller, no admin concept — always filter),
`lib/mcp/tools/search.ts`/`recommend.ts`/`assess.ts` (Volt tools — check `lib/mcp/catalog.ts:37`'s
existing `isPublicMcpProduct` filter first; extend it rather than adding a parallel filter),
`lib/cms/page-products.ts` (CMS page-builder product blocks, per D-14 — same predicate, same
call-site-only rule).

**Anti-pattern (do not do):** filtering inside `listProducts`/`searchProducts`/`getProductsByCategory`
in `lib/models/mach/products.ts` — breaks `/admin/products` and Phase 14. See RESEARCH.md Pitfall 1.

**Test analog:** whatever test currently covers `app/api/products/route.ts`'s `filterByStatus`
behavior (search `tests/unit/app/api/products*`) — extend with the same shape for gift-card
visibility, asserting the admin branch still returns the gift card and the public branch doesn't
when sell is off.

---

### `app/product/[slug]/page.tsx` + `ProductDisplay.tsx` (D-07, D-10)

**Analog for the 404 branch:** `app/account/subscriptions/page.tsx:1-8` (verbatim above). Copy the
synchronous `getStoreConfig().commerce.features.*` check + `notFound()` shape for the both-off
case (`!giftCardAcquisition && !giftCardReconciliation` when `product.type === 'gift_card'`).

**Analog for the unavailable-copy branch (sell off, honor on):** `ProductDisplay.tsx:363-378`
(verbatim above) already branches on `product.type === "gift_card"` and `available` to show a
`"Coming soon"` fallback in place of `GiftCardRecipientForm`. Note this `available` boolean today
means *inventory* availability, not *flag* availability — do not conflate them. Add a new prop
(e.g. `giftCardSalesDisabled: boolean`, computed server-side in `page.tsx` from
`getStoreConfig().commerce.features.giftCardAcquisition`) and branch on it ahead of the existing
`available` check, replacing the recipient form with the "Gift cards are not available right now"
copy (D-07) while keeping the image/description above it per CONTEXT.md's discretion note.

**Test analog:** any existing `ProductDisplay` component test (search `tests/unit/app/product/`)
for the prop-driven conditional-render shape; a source-contract test if no render test exists,
following `tests/unit/components/checkout-digital-only-source.test.ts`'s pattern of asserting file
content references the shared flag rather than re-deriving it.

---

### `lib/services/checkout-pricing.ts` + `app/api/payment-intent/route.ts` (D-09, D-16)

**Analog:** `app/api/payment-intent/route.ts:150-171` (verbatim):
```typescript
// Source: app/api/payment-intent/route.ts:162-166 (verbatim, existing pattern to copy)
    if (error instanceof GiftCardTenderUnavailableError || error instanceof GiftCardConflictError) {
      return NextResponse.json(
        { error: GIFT_CARD_UNAVAILABLE_MESSAGE, code: 'gift_card_unavailable' },
        { status: 400 }
      );
    }
```
Copy this exact catch-branch shape for the new `GiftCardSalesDisabledError` (D-16), mapping to
`{ code: 'gift_card_sales_disabled' }` at `status: 400`, added as a sibling `else if` before the
generic fallback. Per D-16, `priceCheckout` reads `getStoreConfig().commerce.features.giftCardAcquisition`
synchronously (RESEARCH.md Pitfall 4 — do not try to derive this from the resolved
`CommerceCapabilities` object, which has no raw-flag accessor).

**Test analog:** `tests/unit/app/api/payment-intent-authority.test.ts:418-419` (verbatim):
```typescript
// Source: tests/unit/app/api/payment-intent-authority.test.ts:418-419 (verbatim)
    const json = await res.json() as { error: string; code?: string };
    expect(json.code).toBe('gift_card_unavailable');
```
Copy this assertion shape for `'gift_card_sales_disabled'` in a new test case (sell off, cart has a
gift-card line → 400 with the new code).

---

### `components/cart/CartItemCard.tsx` (unavailable mark)

**Analog:** `components/gift-cards/GiftCardRecipientBlock.tsx` (the existing gift-card-aware
sibling already imported into `CartItemCard.tsx:8`) for how a cart-adjacent component reads
`item.giftCardCustomization` and renders gift-card-specific UI. `CartItemCard.tsx` itself
(lines 1-40, verbatim above) currently has no `useStoreConfig()` import — this is new code inside
an existing component, not an edit to an existing branch (RESEARCH.md, Pattern 4). Add
`useStoreConfig()` (see `AdminSidebar.tsx:138` `const store = useStoreConfig();` for the hook's
call shape) and branch on `item.giftCardCustomization !== undefined &&
!store.commerce.features.giftCardAcquisition` to render the unavailable mark beside the existing
line content.

**Test analog:** any existing `CartItemCard` test (search `tests/unit/components/cart/`) for the
render-assertion shape; if none exists, a source-contract test following the
`checkout-digital-only-source.test.ts` pattern is acceptable per CONTEXT.md D-13's `--skip-ui` call.

---

### `components/admin/AdminSidebar.tsx` (nav gating)

**Analog:** itself — the `navItems` array (lines 58-100, verbatim above) is a flat list rendered by
`.map()` at line 198; `store = useStoreConfig()` is already destructured at line 138. Filter the
array (or the render call) on `store.commerce.features.giftCardAcquisition ||
store.commerce.features.giftCardReconciliation` before `.map()`, matching D-10 (either flag on →
entry shows).

**Test analog:** search `tests/unit/components/admin/AdminSidebar*` — if a nav-rendering test
exists, extend it with a flags-off case asserting the "Gift cards" `<a>`/link is absent.

---

### `app/admin/gift-cards/page.tsx`, `app/api/admin/gift-cards/route.ts`, `app/api/gift-cards/balance/route.ts` (D-10)

**Analog:** `app/account/subscriptions/page.tsx:1-8` (page) and `app/api/subscriptions/route.ts:36-40`
(route), both verbatim above. Same `notFound()` / `NextResponse.json({...}, {status:404})` shape,
substituting the condition `!giftCardAcquisition && !giftCardReconciliation`. RESEARCH.md notes the
two API routes already gate on honor only — verify and widen to `acquisition || reconciliation`
per D-10 (both off → 404; honor alone still serves the admin page/API since balances may exist).

---

### `docs/runtime-configuration.md` + `docs/DEPLOYMENT_SETUP.md` §9 (D-12)

**Analog:** the existing rows at `docs/runtime-configuration.md:20-22` and prose at lines 58, 64-76
— rewrite in place following the same table-row + prose-paragraph shape, adding the four-state
table and the D-04/D-05 outstanding-balance rule.

**Constraint (`docs:lint`):** `scripts/docs-lint.mjs:218-238` `checkScriptNamesResolve()` fails on
any `npm run <name>` reference where `<name>` isn't a key in `package.json`'s `scripts` — only cite
real script names (`npm run docs:lint`, `npm run test:workers`, etc.). `scripts/docs-lint.mjs:185-216`
`checkLockedAdrGuard()` requires `docs/checkout-trust-boundary.md` to keep its `locked: true`
manifest marker — this phase does not touch that file, so no action needed, just don't touch it.

## Shared Patterns

### Flag-off 404 (pages and API routes)
**Source:** `app/account/subscriptions/page.tsx:1-8`, `app/api/subscriptions/route.ts:36-40`
**Apply to:** `app/product/[slug]/page.tsx` (both-off), `app/admin/gift-cards/page.tsx`,
`app/api/admin/gift-cards/route.ts`, `app/api/gift-cards/balance/route.ts`
```typescript
if (!getStoreConfig().commerce.features.subscriptionReconciliation) notFound();
// or, in a route:
if (!getStoreConfig().commerce.features.subscriptionReconciliation) {
  return NextResponse.json({ error: "Subscriptions are unavailable" }, { status: 404 });
}
```

### Small pure predicate module + paired unit test
**Source:** `lib/checkout/digital-only.ts` (whole file) + `tests/unit/lib/checkout/digital-only.test.ts`
**Apply to:** `lib/gift-cards/visibility.ts`

### Raw D1 `prepare` read/write of `admin_settings` from a non-request context
**Source:** `app/api/webhooks/stripe/handlers/refund-handlers.ts:113-128`
**Apply to:** the honor-guard write (cron) and read (capability resolution when honor=off, admin page)

### Distinct error code surfaced through `/api/payment-intent`
**Source:** `app/api/payment-intent/route.ts:162-166` + `tests/unit/app/api/payment-intent-authority.test.ts:418-419`
**Apply to:** the new `gift_card_sales_disabled` code (D-16)

### Critical telemetry event registration (paired files)
**Source:** `lib/observability/telemetry.ts:67` + `workers/observability-tail/src/core.ts:31`, pinned by `tests/unit/workers/observability-tail-core.test.ts:63-69`
**Apply to:** `gift_card.honor_disabled_with_balances`

## No Analog Found

None — every file in scope has a strong existing analog in the codebase (this phase is explicitly
an in-repo gate/fix phase with no new external mechanism, per RESEARCH.md's own conclusion).

## Gotchas

- **`ProductDisplay.tsx`'s existing `available` boolean means inventory availability, not flag
  availability.** Do not reuse it for the sell-off unavailable branch — add a separate prop. The
  "Currently unavailable" / "Coming soon" copy at lines 359 and 368/377 is a visual pattern to
  match, not a variable to share.
- **`admin_settings.data_type` is free text** (`'string' | 'number' | 'boolean' | 'object'`,
  `lib/db/schema/settings.ts:15`) — use `'object'` for the honor-guard JSON payload, matching
  `shipping.methods`.
- **`availableBalanceExpression` (`lib/gift-cards/repository.ts:180`) is not exported today.** Add
  `export` or wrap it in a new exported function before any external caller (cron) can use it.
- **The cron handler (`handleScheduled`) already receives `env: CloudflareEnv` directly** — do not
  route the honor-guard measurement through `getCloudflareContext()`; pass `env.DB` the same way
  `drainOrderEffects({ database: env.DB, ... })` already does at `lib/observability/scheduled.ts:35`.
- **Every flag reader must normalize string env values explicitly** (`.trim().toLowerCase() ===
  'true'`) — a bare truthiness check on `env.STORE_FEATURE_GIFT_CARD_RECONCILIATION` treats the
  string `"false"` as enabled. Reuse `lib/commerce/runtime.ts:12-14`, `lib/observability/scheduled.ts:11-12`,
  or `lib/store-config.ts`'s `bool()` — do not write a fourth normalizer.
- **`listProducts`/`searchProducts`/`getProductsByCategory` are shared by admin and public.**
  Filtering gift cards inside them breaks `/admin/products` and Phase 14. Filter only at public
  call sites (home, category, `!isAdmin` branch of `/api/products`, MCP tools, recommendations, CMS
  page-products) using the one shared predicate.
- **`priceCheckout` has no raw-flag input today, only the resolved `CommerceCapabilities` object**
  (`{giftCards, subscriptions}` capability methods, not booleans). Pull the sell-off boolean from
  `getStoreConfig().commerce.features.giftCardAcquisition` synchronously — do not try to derive it
  from the capability object, and do not resolve a fresh runtime-capabilities object just to read
  one boolean (touches the gift-card key ring unnecessarily).
- **`app/page.tsx` has `export const revalidate = 3600`** — a flag flip needs a full redeploy to
  reflect on the home page within the hour; `app/product/[slug]/page.tsx` has `revalidate = 0` and
  reflects immediately. Note this in any manual verification step, don't try to "fix" the ISR window.
- **String flag values, not admin toggle state** — sell/honor stay deploy-time `wrangler.jsonc` vars
  in this phase (admin UI to flip them is explicitly deferred). Don't build settings-table plumbing
  for the flags themselves, only for the honor-guard measurement.

## Test Analogs

| New/changed behavior | Test file to model on | What it pins |
|---|---|---|
| `resolveCommerceCapabilities` tender gating | `tests/unit/lib/commerce/capabilities.test.ts:118-149` | Rewrite the backwards-named test in place; matrix of all four flag states |
| `isPubliclyVisibleProduct` / `hidesGiftCardsFromListings` | `tests/unit/lib/checkout/digital-only.test.ts` | Pure predicate input/output table |
| Source-contract pin on a component using the predicate | `tests/unit/components/checkout-digital-only-source.test.ts` | Asserts file content calls the shared helper, doesn't re-derive logic |
| Critical telemetry event parity | `tests/unit/workers/observability-tail-core.test.ts:63-69` | Fails if event registered in one taxonomy file but not the other, or wrong severity |
| Cron honor-guard measurement end-to-end | `tests/integration/lib/services/gift-card-fulfillment.test.ts` | Real D1 binding + telemetry emission shape |
| `/api/payment-intent` new error code | `tests/unit/app/api/payment-intent-authority.test.ts:418-419` | JSON body shape `{ error, code }` |
| Admin/public route 404 gating | search `tests/unit/app/api/subscriptions*`, `tests/unit/app/account/subscriptions*` | Flag-off → 404 assertion shape |

## Metadata

**Analog search scope:** `lib/commerce/`, `lib/checkout/`, `lib/gift-cards/`, `lib/observability/`,
`lib/store-config.ts`, `app/api/products/`, `app/product/[slug]/`, `app/api/payment-intent/`,
`app/api/webhooks/stripe/handlers/`, `components/admin/`, `components/cart/`,
`components/gift-cards/`, `workers/observability-tail/`, `docs/`, `scripts/docs-lint.mjs`,
corresponding `tests/unit/` and `tests/integration/` trees.
**Files scanned:** ~30 (read or grepped directly this session; remainder sourced from
13-RESEARCH.md's verified citations, cross-checked against the live files above).
**Pattern extraction date:** 2026-09-10
