# Phase 13: Gift-Card Flags - Research

**Researched:** 2026-09-10
**Domain:** Feature-flag gating for an existing commerce capability (gift cards) across capability resolution, public listing/query, checkout pricing, admin nav, and a D1-backed cron measurement — no new external dependencies.
**Confidence:** HIGH — every claim below is grounded in a file read this session (path:line cited); no package research or external doc lookup was needed because this phase touches only in-repo code and docs.

## Summary

Phase 13 is a pure in-repo fix-and-gate phase: no new libraries, no new services. The two
env-var flags (`STORE_FEATURE_GIFT_CARD_ACQUISITION` = sell, `STORE_FEATURE_GIFT_CARD_RECONCILIATION`
= honor) already exist and are already read in four places (`lib/commerce/runtime.ts`,
`lib/store-config.ts`, `lib/observability/scheduled.ts`, two gift-card API routes). The core bug
(D-03) is precisely located: `resolveCommerceCapabilities` in `lib/commerce/capabilities.ts:187-214`
gates the entire tender wrapper (`resolveTender`, `releaseTender`, `restoreTender`) on
`flags.giftCardAcquisition`, not `flags.giftCardReconciliation` — so today, sell=off blocks a
shopper from *redeeming* an existing card (backwards), while nothing hides the storefront
surfaces. `tests/unit/lib/commerce/capabilities.test.ts:118-149` currently pins this backwards
behavior by name (`"keeps reconciliation installed while acquisition rejects nonempty tokens"`)
and will need to be rewritten to assert the opposite.

The second major finding changes the shape of the listing-hide work (D-07/D-08): `listProducts`,
`searchProducts`, and `getProductsByCategory` in `lib/models/mach/products.ts` are **shared by
both the public storefront and the admin product manager** — `app/api/products/route.ts` calls
all three for both the public and the `isAdmin` branches, and `app/admin/products/ProductManagement.tsx`
fetches through that same route. Filtering `type === 'gift_card'` *inside* those model functions
would also hide the product from admin, breaking Phase 14's ability to manage it. The gift-card
filter must be applied at the **public call sites** only (home, category page, the non-admin
branch of `/api/products`, and the Volt/MCP tools), via one small shared predicate, not inside the
shared query functions.

The third finding: `availableBalanceExpression` in `lib/gift-cards/repository.ts:180` — the SQL
CONTEXT.md says to reuse for the outstanding-balance measurement — is a **module-private**
function, not exported. It must be exported (or a new function added inside `repository.ts` that
uses it internally) before any external caller (the cron handler) can reuse it.

**Primary recommendation:** (1) delete the acquisition-gated wrapper in `resolveCommerceCapabilities`
so tender resolution/release/restoration follow `giftCardReconciliation` only; (2) add one shared
`isPubliclyVisibleProduct(product, flags)` predicate and apply it at each public listing call site,
never inside the shared model functions; (3) export a new `sumOutstandingGiftCardBalances()` from
`lib/gift-cards/repository.ts` built on the existing (exported) `availableBalanceExpression`, called
once per cron tick and written to `admin_settings` under a JSON key, read by capability resolution
as a single-row override.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sell/honor flag evaluation | API / Backend | — | `lib/commerce/capabilities.ts` + `lib/commerce/runtime.ts` resolve flags from Worker env at request time; no client logic decides this. |
| Tender gating (resolveTender/verify/apply/release/restore) | API / Backend | — | `lib/commerce/capabilities.ts`; called only from `app/api/payment-intent/route.ts` and `app/api/webhooks/stripe/route.ts`. |
| Listing visibility (home/category/search/Volt) | API / Backend | Frontend Server (SSR) | Filtering happens server-side before HTML/JSON is produced (`app/page.tsx`, `app/category/[slug]/page.tsx`, `app/api/products/route.ts`); no client-side re-filtering exists or should exist. |
| Product-page availability copy | Browser / Client | Frontend Server (SSR) | `app/product/[slug]/page.tsx` (SSR) decides 404 vs. render and passes a boolean prop; `ProductDisplay.tsx` (client) renders the copy from that prop — it must not re-derive flags itself beyond `useStoreConfig()`. |
| Checkout-line rejection (sell=off) | API / Backend | — | `lib/services/checkout-pricing.ts` `priceCheckout` runs server-side only; the client (`CheckoutClient.tsx`) only reads the error code it returns. |
| Cart-line "unavailable" mark | Browser / Client | — | `components/cart/CartItemCard.tsx` is a pure client component reading `useStoreConfig()`; no server round-trip needed to mark a line. |
| Outstanding-balance measurement | Database / Storage | API / Backend | The SUM/COUNT query runs against D1 from the cron tick (`lib/observability/scheduled.ts`) and is written back to D1 (`admin_settings`); request-time code only reads the pre-computed value. |
| Admin nav/page/API gating | API / Backend | Browser / Client | Server routes/pages return 404 (`app/admin/gift-cards/page.tsx`, `app/api/admin/gift-cards/route.ts`); the client-only `AdminSidebar.tsx` filters its nav array via `useStoreConfig()`. |

## Standard Stack

No new packages. This phase adds/edits TypeScript in the existing Next.js/Cloudflare Workers
codebase using libraries already installed and verified in prior phases (Drizzle ORM against D1,
`@opennextjs/cloudflare`, Vitest, `@cloudflare/vitest-pool-workers`). No `npm install` is required.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────┐
                        │  wrangler.jsonc vars / secret │
                        │  STORE_FEATURE_GIFT_CARD_*    │
                        └───────────────┬───────────────┘
                                        │ read at request/tick time
             ┌──────────────────────────┼───────────────────────────┐
             │                          │                           │
   ┌─────────▼─────────┐     ┌──────────▼──────────┐     ┌──────────▼──────────┐
   │ store-config.ts     │     │ commerce/runtime.ts  │     │ observability/       │
   │ (booleans, public,  │     │ (raw flags →         │     │ scheduled.ts         │
   │  request-scoped)    │     │  resolveCommerce-     │     │ (raw flags, own      │
   │                      │     │  Capabilities)        │     │  reader, cron tick)  │
   └─────────┬───────────┘     └──────────┬───────────┘     └──────────┬──────────┘
             │                            │                           │
    ┌────────┴─────────┐        ┌─────────▼─────────┐      ┌──────────▼──────────┐
    │ Public surfaces    │        │ Tender capability  │      │ D1: SUM(available    │
    │ (product page,     │        │ (resolveTender,     │      │ balance) + COUNT     │
    │ cart, checkout      │        │  verify/apply/       │      │ (open reservations)  │
    │ panel, admin nav)   │        │  release/restore)    │      │  → admin_settings    │
    └────────┬───────────┘        └─────────┬─────────┘      └──────────┬──────────┘
             │                              │                           │
    ┌────────▼───────────┐        ┌─────────▼─────────┐                │
    │ listProducts /       │        │ /api/payment-intent │                │
    │ searchProducts /      │        │ priceCheckout        │◄───────────────┘
    │ getProductsByCategory │        │ (rejects gift-card    │  (honor-off override:
    │  — shared w/ ADMIN,   │        │  line when sell=off)  │   read once per request)
    │  filter at CALL SITE, │        └───────────────────────┘
    │  not inside the fn    │
    └────────────────────────┘
```

### Recommended Project Structure

No new directories. New/changed files sit beside their existing counterparts:

```
lib/commerce/capabilities.ts        # remove acquisition-gated tender wrapper (D-03)
lib/commerce/product-visibility.ts  # NEW — shared isPubliclyVisibleProduct(product, flags) predicate
lib/gift-cards/repository.ts        # export availableBalanceExpression; add sumOutstandingGiftCardBalances()
lib/gift-cards/outstanding.ts       # NEW (optional) — admin_settings read/write for the measurement
lib/observability/scheduled.ts      # call the measurement once per 5-min tick; emit telemetry
lib/observability/telemetry.ts      # register gift_card.honor_disabled_with_balances
workers/observability-tail/src/core.ts  # add same event to TAIL_CRITICAL_EVENTS
app/page.tsx                        # filter featuredProducts through the shared predicate
app/category/[slug]/page.tsx        # same
app/api/products/route.ts           # filter only the !isAdmin branch
lib/mcp/tools/search.ts             # filter searchProducts() results for Volt
lib/mcp/tools/recommend.ts          # same
lib/mcp/tools/assess.ts             # same
lib/recommendations/index.ts        # filter listProducts() results
app/product/[slug]/page.tsx         # branch: both off → notFound(); sell off/honor on → pass prop
app/product/[slug]/ProductDisplay.tsx  # new prop → "Gift cards are not available right now" copy
lib/services/checkout-pricing.ts    # reject gift-card line when sell=off; new error class/code
app/api/payment-intent/route.ts     # map new error → { code: 'gift_card_sale_unavailable' }
components/cart/CartItemCard.tsx    # mark item.giftCardCustomization line unavailable when sell=off
components/checkout/CheckoutClient.tsx  # gate <GiftCardApplyPanel> on honor
components/admin/AdminSidebar.tsx   # filter the "Gift cards" navItem on (sell || honor)
app/admin/gift-cards/page.tsx       # notFound() when both off
app/api/admin/gift-cards/route.ts   # already gates on honor only (see Pitfalls) — verify against D-10
app/api/gift-cards/balance/route.ts # already gates on honor only — verify against D-10
docs/runtime-configuration.md       # rewrite two flag rows + prose
docs/DEPLOYMENT_SETUP.md            # rewrite §9
```

### Pattern 1: Flag-off 404, the established convention

**What:** A page returns `notFound()`; an API route returns a JSON 404, both driven by
`getStoreConfig().commerce.features.*` read synchronously (no `await`, no Worker-binding
round trip).
**When to use:** Any surface that must vanish when its owning flag is off.
**Example (existing code, exact source):**
```typescript
// Source: app/account/subscriptions/page.tsx:1-8 (verbatim)
import { notFound } from 'next/navigation';
import { SubscriptionManager } from '@/components/account/SubscriptionManager';
import { getStoreConfig } from '@/lib/store-config';

export default function AccountSubscriptionsPage() {
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) notFound();
  return <div>...</div>;
}
```
```typescript
// Source: app/api/subscriptions/route.ts:36-40 (verbatim)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) {
    return NextResponse.json({ error: "Subscriptions are unavailable" }, { status: 404 });
  }
```
`app/admin/gift-cards/page.tsx` and `app/api/admin/gift-cards/route.ts` follow this exact shape
for D-10 (both off → 404), substituting `giftCardAcquisition || giftCardReconciliation`.

### Pattern 2: Public-vs-admin split in a shared list route — the trap and the fix

**What:** `app/api/products/route.ts:49-95` computes `isAdmin` once and branches `statusFilter`
between `['active']` (public) and admin-chosen statuses, but calls the **same** `listProducts` /
`getProductsByCategory` for both branches (`[VERIFIED: app/api/products/route.ts:71-95]` — quoted
below).
```typescript
// Source: app/api/products/route.ts:71-95 (verbatim)
    const statusFilter: ProductStatus[] | undefined = isAdmin
      ? (requestedStatus ? [requestedStatus as ProductStatus] : undefined)
      : ['active'];
    const filterByStatus = (products: Product[]): Product[] =>
      statusFilter
        ? products.filter((product) => statusFilter.includes(product.status as ProductStatus))
        : products;

    let total: number;
    let products: Product[];

    if (category?.trim()) {
      const visibleProducts = filterByStatus(await getProductsByCategory(category.trim()));
      total = visibleProducts.length;
      products = visibleProducts.slice(offset, offset + limit);
    } else {
      const [allProducts, page] = await Promise.all([
        listProducts({ status: statusFilter }),
        listProducts({ status: statusFilter, limit, offset }),
      ]);
      total = filterByStatus(allProducts).length;
      products = filterByStatus(page);
    }
```
**When to use:** This is the exact shape of `filterByStatus` — a second filter, `filterByGiftCardVisibility`,
composes the same way: `isAdmin ? products : products.filter(isPubliclyVisibleProduct)`. Apply it
alongside `filterByStatus`, not inside `listProducts`/`getProductsByCategory` themselves — those
two functions are also called directly by `lib/mcp/catalog.ts:37` (already filters via
`isPublicMcpProduct`, itself extendable) and `lib/recommendations/index.ts:16` (public,
needs the filter added at that call site too since it does not route through `/api/products`).
**Anti-pattern to avoid:** Putting `product.type !== 'gift_card'` inside `listProducts`,
`searchProducts`, or `getProductsByCategory` in `lib/models/mach/products.ts` directly. Those
three functions have no `isAdmin`/`isPublic` parameter today (`[VERIFIED: lib/models/mach/products.ts:450-456]`
— `listProducts(options: { status?, type?, brand?, limit?, offset? })`; `[VERIFIED: lib/models/mach/products.ts:646,660]`
— `searchProducts(searchTerm)` and `getProductsByCategory(categoryIdentifier)` take no
visibility flag at all), and `app/admin/products/ProductManagement.tsx:186` fetches through
`/api/products` — the same functions the public path uses. A filter placed inside the model
functions cannot distinguish the admin caller from the public one and would make the gift-card
product unmanageable in Phase 14's admin.

### Pattern 3: Cron-tick D1 read/write of an `admin_settings` value from a raw D1 binding

**What:** A non-request context (webhook handler, and by the same shape a scheduled handler) reads
and writes `admin_settings` with a **raw `database.prepare(...)` call**, not the Drizzle ORM helper
`getSettings()`/`getDbAsync()` used by request-scoped code — because the caller already holds a
`D1Database` binding directly (`env.DB` in `handleScheduled`) and does not need the Drizzle
wrapper's async initialization.
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
**When to use:** `lib/observability/scheduled.ts` already holds `env: CloudflareEnv` (which
includes `env.DB: D1Database`, confirmed by `handleScheduled`'s call to
`drainOrderEffects({ database: env.DB, ... })` at `lib/observability/scheduled.ts:35`). The new
measurement write (`admin_settings` key, e.g. `gift_card.outstanding_balance`) should use this
same raw-`prepare` shape rather than routing through `getSettings()`/`updateSettings` (the latter
is written for the request-scoped admin-settings API route, not a Worker-scoped cron).
**data_type note:** `admin_settings.data_type` is a free-text column (`'string' | 'number' |
'boolean' | 'object'`, `[VERIFIED: lib/db/schema/settings.ts:15]` — `data_type: text("data_type").notNull(), // string, number, boolean, object`).
A `{outstandingTotal, reservationCount, measuredAt}` JSON payload should use `data_type: 'object'`,
matching existing entries like `shipping.methods` (`[VERIFIED: lib/db/schema/settings.ts:70-80]`).

### Pattern 4: The gift-card-line indicator on a cart line

**What:** `StableCartItem` (client-side cart state) has no `productType` field — the only
gift-card marker is the optional `giftCardCustomization` object, present only on gift-card lines.
```typescript
// Source: lib/types/cartitem.ts:1-24 (verbatim)
export interface GiftCardCustomization {
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  deliveryDate?: string;
}
export interface CartItem {
  lineId?: string;
  variantId: string;
  productId: string;
  name: string;
  price: StoredMoney;
  quantity: number;
  primaryImageUrl: string;
  giftCardCustomization?: GiftCardCustomization;
}
export type StableCartItem = CartItem & { lineId: string };
```
**When to use:** `components/cart/CartItemCard.tsx` should treat `item.giftCardCustomization`
truthy as "this line is a gift card" and, combined with `useStoreConfig().commerce.features.giftCardAcquisition
=== false`, render the unavailable mark. `[VERIFIED: components/cart/CartItemCard.tsx:1-13]` — the
component currently imports no `useStoreConfig` and has no gift-card-aware branch at all; this is
new code, not an edit to an existing branch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outstanding-balance SQL | A second hand-written SUM over `gift_card_ledger_entries`/`gift_card_reservations` | Export and reuse `availableBalanceExpression` from `lib/gift-cards/repository.ts:180-198` | It already encodes the exact "not yet settled, not released, still active or committed" logic the balance/reservation gate needs (`[VERIFIED: lib/gift-cards/repository.ts:180-198]`, expression quoted in full in the Code Examples section below). A second, slightly different expression is a correctness bug waiting to happen. |
| A second "flag off → 404" mechanism | Custom middleware, a new HOC, a new response wrapper | The existing `notFound()` / `NextResponse.json({...}, {status:404})` pattern (Pattern 1 above) | Five other surfaces (`app/account/subscriptions`, `app/api/subscriptions/*`) already use exactly this shape; a new mechanism adds a second pattern to maintain for no benefit. |
| Product-type visibility check | A new "hidden products" table, a denylist, a slug list | `product.type === 'gift_card'` read at the query/call-site layer (D-08, locked) | The type field already exists on every product row; a separate table is a second source of truth that can drift. |

**Key insight:** every piece of this phase reuses an existing mechanism that already exists
somewhere else in the codebase for an analogous flag (subscriptions). The main engineering risk is
not "what pattern to invent" but "which of the two nearly-identical existing patterns applies at
this call site" (shared model fn vs. call-site filter; Drizzle helper vs. raw D1 `prepare`).

## Common Pitfalls

### Pitfall 1: Filtering gift cards out of the shared `listProducts`/`searchProducts`/`getProductsByCategory` functions
**What goes wrong:** The gift-card product silently disappears from `/admin/products`, breaking
Phase 14's admin management (list, edit, disable) before it's even built.
**Why it happens:** D-08's wording names the three functions directly, inviting a fix inside
them; but `app/api/products/route.ts` — the only caller most of the time — passes both the public
and the `isAdmin` request through the same functions (`[VERIFIED: app/api/products/route.ts:71-100]`).
**How to avoid:** Filter at each public call site (home, category page, the `!isAdmin` branch of
`/api/products`, the MCP/Volt tools, `lib/recommendations/index.ts`) using one small shared
predicate, never inside the three model functions themselves.
**Warning signs:** A test or manual check of `/admin/products` (with admin auth) no longer lists
the gift card once sell=off/honor=off is set.

### Pitfall 2: The test that currently pins the D-03 bug
**What goes wrong:** Deleting only the production code (`lib/commerce/capabilities.ts:187-214`)
without updating `tests/unit/lib/commerce/capabilities.test.ts:118-149` leaves a red test that
asserts the *old*, backwards behavior — the suite fails for the right reason but a plan that
doesn't account for it will look "broken."
**Why it happens:** The test is literally titled to describe the current (wrong) behavior:
`it("keeps reconciliation installed while acquisition rejects nonempty tokens", ...)`
(`[VERIFIED: tests/unit/lib/commerce/capabilities.test.ts:118]`), and asserts
`resolveTender({token: "GC-NOT-USED", ...})` rejects with `"disabled"` when
`giftCardAcquisition: false, giftCardReconciliation: true` — the exact sell=off/honor=on state
GCF-01 needs to allow redemption in.
**How to avoid:** Rewrite this test as part of the same task/commit that removes the wrapper; do
not treat it as a separate "fix tests" cleanup step.
**Warning signs:** `npm test` (or the scoped `vitest run tests/unit/lib/commerce/capabilities.test.ts`)
fails after the capabilities.ts edit with the old test's exact assertion message.

### Pitfall 3: `availableBalanceExpression` is not exported
**What goes wrong:** A plan step that says "reuse `availableBalanceExpression`" from a new file
(`lib/observability/scheduled.ts` or a new `lib/gift-cards/outstanding.ts`) will fail to compile —
the function has no `export` keyword.
**Why it happens:** `[VERIFIED: lib/gift-cards/repository.ts:180]` — `function availableBalanceExpression(accountAlias: string, nowPlaceholder = "?"): string {` — no `export`.
**How to avoid:** Either add `export` to the existing function, or add a new exported function
*inside* `repository.ts` (e.g. `sumOutstandingGiftCardBalances(database, now)`) that calls the
private helper internally and returns `{ outstandingTotal: Money, reservationCount: number }` in
one query. The latter keeps the SQL construction contained to one file, matching how the rest of
`repository.ts` is structured (`createGiftCardRepository` returns an object of closures; nothing
else in the file is a bare exported SQL-string builder).

### Pitfall 4: `priceCheckout` has no raw-flag input today, only `CommerceCapabilities`
**What goes wrong:** A plan step assumes `options.capabilities.giftCards` (the tender capability
object) can answer "is selling on?" — it cannot. `CommerceCapabilities` is `{giftCards,
subscriptions}` capability *objects* (methods), not the raw `CommerceFeatureFlags` booleans
(`[VERIFIED: lib/commerce/capabilities.ts:84-87]`).
**Why it happens:** `resolveRuntimeCommerceCapabilities()` (`lib/commerce/runtime.ts:21-37`)
resolves and returns only the capability object; the flags it read internally are not returned.
**How to avoid:** `priceCheckout` needs a new, separate boolean input for the sell-line rejection
— the cheapest source is `getStoreConfig().commerce.features.giftCardAcquisition`, already used
synchronously (no `await`, no Cloudflare-context round trip) at nine other call sites
(`[VERIFIED: app/api/subscriptions/route.ts:18, app/account/subscriptions/page.tsx:6]`, and seven
more per the earlier `getStoreConfig()` grep). This also matches the existing efficiency
discipline noted in `lib/commerce/runtime.ts:16-20` — capability resolution and the gift-card key
ring should only be touched "unless either gift-card capability is enabled" — reading a boolean
from `getStoreConfig()` avoids resolving the full runtime capability object (and touching the key
ring) just to answer "is sell on?".

### Pitfall 5: `app/page.tsx` has `revalidate = 3600` — ISR caching
**What goes wrong:** Flipping the sell flag in production (a redeploy, since flags are
`wrangler.jsonc` vars, `[VERIFIED: wrangler.jsonc:131-132]` — both currently `"true"`) does trigger
a new deployment/build, so this is lower-risk than it looks, but a manual verification step that
checks the home page *without* redeploying (e.g., toggling only via a Workers Build variable) could
see a stale cached page for up to an hour.
**Why it happens:** `[VERIFIED: app/page.tsx:81]` — `export const revalidate = 3600; // Revalidate every hour`.
**How to avoid:** Note in the phase's manual verification steps that a flag change requires a full
redeploy (already true for `wrangler.jsonc` vars per `docs/DEPLOYMENT_SETUP.md` §9's existing
regenerate-commit-push cycle) and that the home page's cache will not reflect the change until
either the next deploy's fresh build or up to 3600s after. `app/product/[slug]/page.tsx` has no
such caveat — `[VERIFIED: app/product/[slug]/page.tsx:53]` — `export const revalidate = 0;`.

### Pitfall 6: `getCloudflareContext` outside a request — the cron handler already has `env` directly
**What goes wrong:** A plan step that has the cron handler call `resolveRuntimeCommerceCapabilities()`
or any other `getCloudflareContext()`-based helper to get `env.DB` will work (Workers `env` is
available via `getCloudflareContext` inside a scheduled handler too) but is unnecessary — `handleScheduled`
already receives `env: CloudflareEnv` as a direct parameter.
**Why it happens:** Most of the gift-card runtime code (`lib/gift-cards/runtime.ts:21-24`,
`lib/commerce/runtime.ts:21-22`) is written for the *request* path and defaults to
`getCloudflareContext({ async: true })`. The scheduled path is different — `[VERIFIED: lib/observability/scheduled.ts:23-27]`:
`export function handleScheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext): void`.
**How to avoid:** Pass `env.DB` directly into the new outstanding-balance function, exactly as
`lib/observability/scheduled.ts:35` already does for `drainOrderEffects({ database: env.DB, ... })`.

### Pitfall 7: `env[key]` values are strings, not booleans — `"true"` only, case-insensitive, trimmed
**What goes wrong:** A naive `if (env.STORE_FEATURE_GIFT_CARD_RECONCILIATION)` truthiness check
treats the *string* `"false"` as truthy (a nonempty string), silently enabling honor when it
should be off.
**Why it happens:** Every existing reader normalizes explicitly:
`[VERIFIED: lib/commerce/runtime.ts:12-14]` — `typeof environment[key] === 'string' && environment[key].trim().toLowerCase() === 'true'`;
`[VERIFIED: lib/observability/scheduled.ts:11-12]` — the same shape, duplicated locally;
`[VERIFIED: lib/store-config.ts:169-174]` — `bool()` does `.trim().toLowerCase()` then compares
against `"true"`/`"false"` literals with a fallback.
**How to avoid:** Reuse one of the three existing normalizers (or extract a shared one) rather
than writing a fourth ad hoc truthy check for the outstanding-balance override read.

### Pitfall 8: `docs:lint`'s script-name and locked-ADR checks
**What goes wrong:** A docs edit that references an `npm run <script>` command not present in
`package.json`, or that touches `docs/checkout-trust-boundary.md` without preserving its
`locked: true` manifest marker, fails `npm run docs:lint`.
**Why it happens:** `[VERIFIED: scripts/docs-lint.mjs:224-247]` `checkScriptNamesResolve()` regex-scans
every doc for `npm run <name>` and fails if `<name>` isn't a key in `package.json`'s `scripts`;
`[VERIFIED: scripts/docs-lint.mjs:185-216]` `checkLockedAdrGuard()` requires
`docs/checkout-trust-boundary.md` (in `LOCKED_ADRS`) to keep its `locked: true` manifest entry.
**How to avoid:** This phase does not need to touch `checkout-trust-boundary.md` at all (ADR-CTB-10
is about backend semantics, which are explicitly not changing); only reference real script names
(`npm run test:workers`, `npm run docs:lint`, etc. — all present in `package.json`) in the two docs
being rewritten.

## Code Examples

### The exact `availableBalanceExpression` SQL to reuse

```typescript
// Source: lib/gift-cards/repository.ts:180-198 (verbatim)
function availableBalanceExpression(accountAlias: string, nowPlaceholder = "?"): string {
  return `(COALESCE((
    SELECT SUM(entry.amount_delta_minor)
    FROM gift_card_ledger_entries entry
    WHERE entry.gift_card_id = ${accountAlias}.id
  ), 0) - COALESCE((
    SELECT SUM(reservation.amount_minor)
    FROM gift_card_reservations reservation
    WHERE reservation.gift_card_id = ${accountAlias}.id
      AND reservation.released_at IS NULL
      AND (
        reservation.committed_at IS NOT NULL
        OR reservation.expires_at > ${nowPlaceholder}
      )
      AND NOT EXISTS (
        SELECT 1 FROM gift_card_ledger_entries settlement
        WHERE settlement.reservation_id = reservation.id
          AND settlement.entry_type = 'redemption'
      )
  ), 0))`;
}
```
`gift_card_accounts.status` is a two-value CHECK constraint — `[VERIFIED: migrations/0022_add_gift_cards.sql:28]`
`status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'))` — so "active
accounts" is `WHERE status = 'active'`. An outstanding-balance query built on the expression above
looks like: `SELECT COALESCE(SUM(<expr>), 0) AS total FROM gift_card_accounts account WHERE
account.status = 'active'`, plus a second `COUNT(*)` over `gift_card_reservations` for
`released_at IS NULL AND committed_at IS NULL AND expires_at > ?` (the "open, not yet committed"
reservations D-05 asks to count separately from the balance sum).

### The tender-gating bug, exact current code to change

```typescript
// Source: lib/commerce/capabilities.ts:181-214 (verbatim) — the D-03 fix target
  const giftCards = resolve(
    flags.giftCardAcquisition || flags.giftCardReconciliation,
    factories.giftCards,
    noOpCommerceCapabilities.giftCards,
    "Gift cards",
  );
  const gatedGiftCards: GiftCardCheckoutCapability = (
    giftCards === noOpCommerceCapabilities.giftCards || flags.giftCardAcquisition
  ) ? giftCards : {
      async resolveTender({ token, currency }) {
        if (token !== undefined && token !== "") {
          throw new CommerceCapabilityDisabledError();
        }
        return { amount: Money.zero(currency) };
      },
      verifyReservedTender: (args) => giftCards.verifyReservedTender(args),
      applyTender: (args) => giftCards.applyTender(args),
      releaseTender: async (args) => {
        if (!giftCards.releaseTender) {
          throw new CommerceCapabilityConfigurationError(
            "Gift-card reconciliation release is not configured",
          );
        }
        await giftCards.releaseTender(args);
      },
      restoreTender: async (args) => {
        if (!giftCards.restoreTender) {
          throw new CommerceCapabilityConfigurationError(
            "Gift-card reconciliation restoration is not configured",
          );
        }
        await giftCards.restoreTender(args);
      },
    };
```
Because the earlier throw at `lib/commerce/capabilities.ts:158-162` already forbids
`giftCardAcquisition && !giftCardReconciliation` (GCF-04, kept), the only states that reach this
branch alive are: both on, sell-off/honor-on, and both-off (`noOp`). The restricted branch
(lines 189-213) therefore only ever fires for sell-off/honor-on — the exact state that must allow
full redemption. The minimal fix is to delete the conditional and its restricted branch entirely,
returning `giftCards` unconditionally as `gatedGiftCards` (the `noOp` case is already handled by
`resolve()` returning `noOpCommerceCapabilities.giftCards` when both flags are off).

### The admin-vs-public product-listing route to extend

```typescript
// Source: app/api/products/route.ts:49-95 (verbatim, the choke point for D-07/D-08 non-admin filtering)
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminPermissions(request);
    const isAdmin = adminAuth.success;
    // ...
    const statusFilter: ProductStatus[] | undefined = isAdmin
      ? (requestedStatus ? [requestedStatus as ProductStatus] : undefined)
      : ['active'];
    const filterByStatus = (products: Product[]): Product[] =>
      statusFilter
        ? products.filter((product) => statusFilter.includes(product.status as ProductStatus))
        : products;
    // category and non-category branches both call listProducts/getProductsByCategory here,
    // then filterByStatus — the gift-card filter composes alongside filterByStatus, gated on
    // !isAdmin, not baked into listProducts/getProductsByCategory themselves.
```

## State of the Art

Not applicable — no external library/framework version drift is involved in this phase; every
touched mechanism is in-repo code written in the last two milestones (v2 and v2.1, per
`.planning/ROADMAP.md`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The measurement should live in `admin_settings` as one JSON value (`{outstandingTotal, reservationCount, measuredAt}`) rather than a dedicated table. | Architecture Patterns (Pattern 3), Recommended Project Structure | CONTEXT.md D-06 explicitly names this as Claude's discretion with a stated preference for `admin_settings`, so this is a low-risk assumption, but the exact key name/shape is still a planner decision, not verified against any existing code (no such key exists yet). |
| A2 | The new checkout-rejection error should get its own code (e.g. `gift_card_sale_unavailable`), distinct from the existing `gift_card_unavailable` (tender) code. | Recommended Project Structure, Pitfall 4 | If the planner instead reuses `gift_card_unavailable` for both cases, the client can't distinguish "sell is off, don't offer the product" from "that gift-card code didn't work" — worth confirming with discuss-phase/plan review, not independently verified against a UI-copy source. |
| A3 | `getProductsBySlugs` (CMS page-builder product references, `lib/cms/page-products.ts:56`) and `getProduct`/`getProductBySlug` (direct single-product lookups) should NOT be filtered by gift-card visibility, since D-07 requires the direct product-page link to keep working and D-08 does not name these functions. | Pattern 2, Recommended Project Structure | If a CMS content block explicitly references the gift-card product by slug while sell/honor are off, it would still render normally under this assumption (matching "direct link still renders" intent) — but this exact case (a CMS block, not a direct URL visit) is not covered by any decision in CONTEXT.md; flagged as an open question below rather than asserted as settled. |

## Open Questions

1. **Should CMS page-builder product blocks (`lib/cms/page-products.ts`, `getProductsBySlugs`) filter the gift card when sell/honor are off?**
   - What we know: D-07/D-08 name home, Featured/category grids, search, `/api/products`, and Volt
     product results/recommendations as surfaces to hide from; `getProductsBySlugs` is not in that
     list, and it is used to resolve explicit editorial slug references inside CMS content blocks
     (`lib/cms/page-products.ts:56`), not a "browse" listing.
   - What's unclear: Whether an admin-authored CMS page that explicitly links to `gift-card` by
     slug counts as "a listing surface" (should hide) or "a direct link" (should keep rendering,
     per D-07's stated intent for bookmarks/emails).
   - Recommendation: Treat it as a direct link (no filter) by default, matching D-07's "a direct
     link to `/product/gift-card` still renders" language, and confirm with the user during
     discuss-phase/plan review if CMS blocks are in scope at all for this phase.

2. **Exact `admin_settings` key name and shape for the outstanding-balance measurement.**
   - What we know: The convention is a dotted key inside a category (`store.tax_rate`,
     `refund.return_window_days`), `data_type: 'object'` for JSON payloads
     (`lib/db/schema/settings.ts:70-80` for a precedent).
   - What's unclear: No existing key name to reuse; the planner must choose one (e.g.
     `gift_card.outstanding_balance`, category `gift_card` — note `admin_settings.category` is
     currently one of `system|store|shipping|refund|promotions|recommendations`, so `gift_card`
     would be a new category value, which is fine — the column has no CHECK constraint on
     category, `[VERIFIED: lib/db/schema/settings.ts:10-18]`).
   - Recommendation: Plan should pick and document the key/category explicitly in its own text;
     not a blocker for planning, just needs a decision point.

3. **Does `GiftCardApplyPanel` need a "why is this gone" explanation, or just disappear, when honor=off?**
   - What we know: D-10 says "checkout renders no gift-card panel" when both flags are off; D-03/D-07
     keep it present when honor is on (any sell state).
   - What's unclear: No copy has been specified for the (rare, since honor=off with balances is
     blocked by D-04) case where honor is genuinely off with zero balances — CONTEXT.md's
     "Claude's Discretion" section covers UI copy generally but doesn't call this out specifically.
   - Recommendation: Simple conditional removal (no explanatory copy) is consistent with D-10's
     "renders no gift-card panel" wording; flag for discuss-phase confirmation if a more polished
     empty-state is wanted.

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependency. All work is
against already-provisioned bindings (`DB` — D1) and already-present env vars/secrets
(`STORE_FEATURE_GIFT_CARD_ACQUISITION`, `STORE_FEATURE_GIFT_CARD_RECONCILIATION`, and the existing
gift-card key-ring secrets, none of which this phase reads or changes).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + `@cloudflare/vitest-pool-workers` (integration) |
| Config file | `vitest.config.mts` (unit, default `npm test`); `vitest.workers.config.mts` (integration, `npm run test:workers`) `[VERIFIED: vitest.workers.config.mts:1-28]` |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/commerce/capabilities.test.ts` |
| Full suite command | `mise exec -- npm test && mise exec -- npm run test:workers` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GCF-01 | sell=off/honor=on: product page shows unavailable copy, checkout rejects gift-card lines, redemption still works | unit | `mise exec -- npx vitest run tests/unit/lib/commerce/capabilities.test.ts tests/unit/lib/services/checkout-pricing.test.ts` (rewrite existing capabilities test; extend/verify a checkout-pricing test exists — search did not confirm a `checkout-pricing.test.ts` file; treat as Wave 0 gap if absent) | ⚠️ verify at plan time |
| GCF-02 | honor=off refused while balance/reservation exists; admin warning otherwise | integration | `mise exec -- npm run test:workers -- tests/integration/lib/gift-cards/repository.test.ts` (extend) + new cron integration test | ❌ Wave 0 — new test needed for the outstanding-balance query and the cron-write path |
| GCF-03 | both off: product hidden + 404, no checkout panel, no admin nav/route | unit + source-contract | `mise exec -- npx vitest run tests/unit/app/content-polish-source.test.ts` (AdminSidebar already covered by a source test; extend for the new conditional) + new product-visibility unit test | ⚠️ new file likely needed for `lib/commerce/product-visibility.ts` |
| GCF-04 | sell on/honor off still refuses to start | unit | `mise exec -- npx vitest run tests/unit/lib/commerce/capabilities.test.ts` | ✅ `tests/unit/lib/commerce/capabilities.test.ts:100-114` already covers this (unaffected by the D-03 fix) |
| GCF-05 | docs describe sell/honor, four-state table, rollback recipe | static | `mise exec -- npm run docs:lint` | ✅ existing gate |

### Sampling Rate
- **Per task commit:** the scoped Vitest file(s) touched by that task.
- **Per wave merge:** `mise exec -- npm test` (full unit suite, fast) then `mise exec -- npm run test:workers` (integration, D1-backed).
- **Phase gate:** full suite green (`npm test`, `npm run test:workers`, `npm run test:observability-worker`) before `/gsd-verify-work`, matching `AGENTS.md`'s CI order.

### Wave 0 Gaps
- [ ] `lib/commerce/product-visibility.ts` + `tests/unit/lib/commerce/product-visibility.test.ts` — new shared predicate and its unit coverage (Pattern 2).
- [ ] A cron/integration test exercising the outstanding-balance measurement against real D1 rows (extend `tests/integration/lib/gift-cards/repository.test.ts` or add a new `tests/integration/lib/observability/scheduled.test.ts` using the `cloudflare:workers` `env` + `applyTestMigrations` harness shown in `tests/integration/lib/gift-cards/repository.test.ts:1-10`).
- [ ] Confirm whether `tests/unit/lib/services/checkout-pricing.test.ts` exists (not found by this session's search under that exact name — verify at plan time; if absent, the sell=off checkout-rejection behavior needs a new test file).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | No auth changes in this phase. |
| V3 Session Management | no | No session changes. |
| V4 Access Control | yes | `app/api/admin/gift-cards/route.ts` and `app/api/gift-cards/balance/route.ts` already gate on `checkAdminPermissions`/rate-limit respectively (unchanged); the new both-off 404 is an availability change, not an access-control change — no new authorization surface is introduced. |
| V5 Input Validation | no | No new user input is accepted by this phase; it only adds read-side flag checks. |
| V6 Cryptography | no | The gift-card key rings (HMAC, AES) are untouched; this phase does not read or write `GIFT_CARD_CODE_HMAC_*`/`GIFT_CARD_DELIVERY_*`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Flag-off state stranding real money (honor=off silently dropping in-flight balances) | Denial of Service (against the shopper who holds a balance) | D-04/D-05's outstanding-balance override — already the phase's core design, not a new mitigation to invent. |
| A slug/id-based hide list drifting from the actual product type | Tampering (a renamed or re-slugged gift-card product bypassing the hide) | D-08's locked decision — filter on `product.type === 'gift_card'`, never a slug/id list. |

## Sources

### Primary (HIGH confidence — file read this session)
- `lib/commerce/capabilities.ts`, `lib/commerce/runtime.ts`, `lib/store-config.ts`,
  `lib/observability/scheduled.ts`, `lib/observability/telemetry.ts`,
  `workers/observability-tail/src/core.ts`, `lib/gift-cards/repository.ts`,
  `lib/gift-cards/runtime.ts`, `lib/gift-cards/capability.ts`, `lib/gift-cards/checkout.ts`,
  `lib/models/mach/products.ts`, `lib/mcp/catalog.ts`, `lib/mcp/tools/search.ts`,
  `lib/mcp/tools/recommend.ts`, `lib/mcp/tools/assess.ts`, `lib/recommendations/index.ts`,
  `lib/cms/page-products.ts`, `lib/services/checkout-pricing.ts`, `lib/utils/settings.ts`,
  `lib/db/schema/settings.ts`, `lib/types/cartitem.ts`,
  `app/api/products/route.ts`, `app/page.tsx`, `app/category/[slug]/page.tsx`,
  `app/product/[slug]/page.tsx`, `app/product/[slug]/ProductDisplay.tsx`,
  `app/api/payment-intent/route.ts`, `app/api/admin/gift-cards/route.ts`,
  `app/api/gift-cards/balance/route.ts`, `app/admin/gift-cards/page.tsx`,
  `app/admin/layout.tsx`, `app/admin/products/ProductManagement.tsx`,
  `app/account/subscriptions/page.tsx`, `app/api/subscriptions/route.ts`,
  `app/api/webhooks/stripe/handlers/refund-handlers.ts`,
  `components/cart/CartItemCard.tsx`, `components/checkout/CheckoutClient.tsx`,
  `components/checkout/GiftCardApplyPanel.tsx`, `components/admin/AdminSidebar.tsx`,
  `migrations/0022_add_gift_cards.sql`, `wrangler.jsonc`, `cloudflare-env.d.ts`,
  `docs/runtime-configuration.md`, `docs/DEPLOYMENT_SETUP.md`, `docs/checkout-trust-boundary.md`,
  `scripts/docs-lint.mjs`, `vitest.workers.config.mts`, `package.json`,
  `tests/unit/lib/commerce/capabilities.test.ts`, `tests/unit/worker-cron-routing.test.ts`,
  `tests/unit/observability/instrumentation-source.test.ts`,
  `tests/unit/workers/observability-tail-core.test.ts`, `tests/unit/app/content-polish-source.test.ts`,
  `tests/integration/lib/gift-cards/repository.test.ts`, `.planning/config.json`,
  `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/todos/pending/gift-card-admin-and-flags.md`,
  `.planning/phases/13-gift-card-flags/13-CONTEXT.md`.

### Secondary (MEDIUM confidence)
- None — no web/docs lookups were needed for this phase; every claim traces to a file read this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack, nothing to get wrong.
- Architecture: HIGH — every call site named in this document was located and read this session; the public-vs-admin listing-function conflict was independently discovered (not stated in CONTEXT.md) and verified against three call sites.
- Pitfalls: HIGH — each pitfall is backed by a direct file:line quote of the exact code that would trip a naive implementation.

**Research date:** 2026-09-10
**Valid until:** 30 days (stable, in-repo-only phase; re-verify file:line citations if `lib/models/mach/products.ts`, `lib/commerce/capabilities.ts`, or `lib/gift-cards/repository.ts` change before planning begins).

## RESEARCH COMPLETE
