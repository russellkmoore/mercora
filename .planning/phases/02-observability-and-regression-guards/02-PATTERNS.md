# Phase 2: Observability and Regression Guards - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `wrangler.jsonc` (add `analytics_engine_datasets`) | config | request-response | same file, `d1_databases`/`r2_buckets` blocks (lines 26-40) | exact |
| `cloudflare-env.d.ts` (regenerated) | config | — | itself, via `npm run cf-typegen` | n/a (generated) |
| `app/api/analytics/vitals/route.ts` | route | request-response | `lib/observability/telemetry.ts` AE write path (`writeMetric`/`optionalAnalytics`, lines 276-330) + `app/api/gift-cards/route.ts` binding-access pattern | role-match |
| route-template mapper helper (new small pure fn, can live inline in vitals route or `lib/observability/route-template.ts`) | utility | transform | `lib/observability/telemetry.ts` `TELEMETRY_PATHS` allowlist set (lines 6-22) | role-match |
| `lib/observability/telemetry.ts` (add 2 events, `reason` enum) | service | event-driven | itself — existing `TELEMETRY_EVENTS`/`ALLOWED_FIELD_ENUMS` entries (e.g. `auth.deployment_guard_tripped`) | exact |
| `workers/observability-tail/src/core.ts` (mirror `reason` enum) | service | event-driven | itself — `ENUM_FIELDS` (lines 72-91) | exact |
| `lib/services/checkout-pricing.ts` (export 2 fns + `recordTelemetry` call) | service | CRUD/transform | itself — fallback branch (~lines 705-725), `allocateDiscount` (252), `allocateLargestRemainder` (451) | exact |
| `app/api/webhooks/stripe/route.ts` (`handlePaymentFailed` body) | controller | event-driven | itself — `webhook.processing_failed` catch block already in the same function (lines 350-360) | exact |
| `app/product/[slug]/page.tsx` (typed params) | component | request-response | `app/order-status/[id]/page.tsx` async-params + `notFound()` convention | role-match |
| `app/category/[slug]/page.tsx` (typed params, `notFound()`, drop `any`) | component | request-response | `app/product/[slug]/page.tsx` (once fixed) / `app/order-status/[id]/page.tsx` | exact (sibling page) |
| `tests/unit/app/product-slug-page.test.ts`, `tests/unit/app/category-slug-page.test.ts` | test | request-response | `tests/unit/app/order-status-page.test.ts` (lines 1-13) | exact |
| `tests/unit/lib/services/checkout-pricing.test.ts` (extend) | test | CRUD | itself — existing `dependencies(...)` helper and sum test near line 525 | exact |
| `docs/mobile-lighthouse-baseline.md` | config/doc | batch | no exact doc-table analog found in repo; use CONTEXT.md's specified table shape directly | no analog |

## Pattern Assignments

### `wrangler.jsonc` (config)

**Analog:** same file, existing binding arrays (lines 26-40)

```jsonc
"d1_databases": [
  { "binding": "DB", ... }
],
"r2_buckets": [
  { "binding": "MEDIA", ... },
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", ... }
],
```

Add a new top-level array following the same shape (per RESEARCH.md's verified Cloudflare docs citation):

```jsonc
"analytics_engine_datasets": [
  {
    "binding": "WEB_VITALS",
    "dataset": "mercora_web_vitals"
  }
]
```

`scripts/check-deploy-config.mjs` does NOT need updating — verified it only checks `REPLACE_WITH_` placeholders, `ORDER_STATUS_SECRET`, and the `NEXT_PUBLIC_ROBOTS_INDEX`/`NEXT_PUBLIC_SITE_URL` pair (Pitfall 3 in RESEARCH.md). Do not add a task for it.

Regenerate `cloudflare-env.d.ts` only with `.env.local` moved aside:
```bash
mv .env.local .env.local.bak && npm run cf-typegen && mv .env.local.bak .env.local
```

---

### `app/api/analytics/vitals/route.ts` (route, request-response)

**Current file (full, read in full):**
```typescript
import { NextRequest, NextResponse } from "next/server";

interface AnalyticsPayload {
  name: string;
  value: number;
  id?: string;
  rating?: string;
  url?: string;
  timestamp?: number;
  isMobile?: boolean;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const metric = (await request.json()) as AnalyticsPayload;

    if (process.env.NODE_ENV !== "production") {
      console.log("📊 Web Vital:", {
        name: metric.name,
        value: Math.round(metric.value),
        rating: metric.rating ?? "unknown",
        url: metric.url,
        isMobile: metric.isMobile ?? false,
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Analytics error:", error);
    ...
```

**Binding-access pattern to copy** (async `getCloudflareContext`, per RESEARCH.md, matches `app/api/gift-cards/route.ts:1,16`):
```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const analytics = env.WEB_VITALS as AnalyticsEngineDataset | undefined;
  // ...
}
```

**writeDataPoint shape** (RESEARCH.md, cited Cloudflare docs):
```typescript
analytics.writeDataPoint({
  blobs: [metricName, rating, routeTemplate, String(isMobile)],
  doubles: [value],
  indexes: [routeTemplate],
});
```
Fire-and-forget: do not `await` in a way that blocks the 200 response; wrap in try/catch and never let it throw past the handler.

**Missing-binding fallback pattern:** call `recordTelemetry(...)` (see telemetry.ts pattern below) instead of writing, then still `return NextResponse.json({ status: "ok" })`. Never 500 for a beacon — keep the existing broad `try/catch` returning `{ status: "ok" }` even on parse failure, matching current behavior.

Keep the existing non-production `console.log` block as-is (CONTEXT.md decision).

---

### Route-template mapper (new small pure helper)

**Analog pattern:** `lib/observability/telemetry.ts` lines 6-22, `TELEMETRY_PATHS` — a `ReadonlySet<string>` allowlist used to bound cardinality:

```typescript
export const TELEMETRY_PATHS: ReadonlySet<string> = new Set([
  '/api/admin/orders',
  '/api/admin/orders/:id/events',
  ...
]);
```

Follow the same allowlist-with-bounded-fallback shape for the route-template mapper — a small pure function (module-level, in `app/api/analytics/vitals/route.ts` or a sibling `lib/observability/route-template.ts`) that matches known dynamic segments (`/product/[slug]`, `/category/[slug]`, `/blog/[slug]`, `/order-status/[id]`, `/admin/orders/[id]`) and falls back to a single `other` bucket for anything unmatched. No regex-per-page; keep it a static prefix/segment match like the existing set does.

---

### `lib/observability/telemetry.ts` (add events + enum field)

**Analog:** itself — existing `TELEMETRY_EVENTS` map (lines 25-72) and `ALLOWED_FIELD_ENUMS` map (lines 102-120), e.g. `auth.deployment_guard_tripped: { severity: 'critical', sampleRate: 1 }`.

**Add to `TELEMETRY_EVENTS`:**
```typescript
'checkout.tax_fallback': { severity: 'warning', sampleRate: 1 },
'payment.intent_failed': { severity: 'warning', sampleRate: 1 },
```

**Add to `ALLOWED_FIELD_ENUMS`** (existing enum fields shown for exact shape match, e.g. `provider`, `trigger` at lines 113-119):
```typescript
reason: new Set([
  'card_declined', 'insufficient_funds', 'authentication_required',
  'expired_card', 'other',
]),
```

Existing enum fields for reference (`operation`, `outcome`, `provider`, `trigger` are the ones this phase's new events reuse — no new values needed for those):
```typescript
operation: new Set([... 'process', ... 'record_failure', ...]),
outcome: new Set(['conflict', 'failed', 'invalid', ...]),
provider: new Set(['analytics', 'carrier', 'cloudflare_email', 'd1', 'gift_card', 'resend', 'stripe', 'workers_ai']),
trigger: new Set(['manual', 'recovery', 'request', 'scheduled', 'webhook']),
```
`operation: 'price'` and `outcome: 'degraded'` are new values — confirm they're added to the respective sets in both `lib/observability/telemetry.ts` and `workers/observability-tail/src/core.ts` if not already present (verify before assuming; the excerpt above did not show `'price'` or `'degraded'` in the current sets, so this is a required addition, not just `reason`).

---

### `workers/observability-tail/src/core.ts` (mirror enum)

**Analog:** itself — `ENUM_FIELDS` (lines 72-91), byte-identical structure to `lib/observability/telemetry.ts`'s `ALLOWED_FIELD_ENUMS`:

```typescript
export const ALLOWED_FIELD_ENUMS = {
  effect_type: new Set([...]),
  operation: new Set([
    'audit_write', 'claim', 'complete', 'create', 'finalize', 'persist',
    'process', 'read', 'rebuild', 'record_failure', 'send', 'stage', 'transition',
    'validate',
  ]),
  outcome: new Set([
    'conflict', 'failed', 'invalid', 'needs_review', 'partial_failure',
    'rejected', 'retry_scheduled', 'unavailable', 'unresolved',
  ]),
  provider: new Set([...]),
  trigger: new Set([...]),
} as const;
```

Add the same `reason` set (and `'price'`/`'degraded'` to `operation`/`outcome` if required) here too, in the same commit. Parity is enforced only by `tests/unit/workers/observability-tail-core.test.ts`, not the type system — run it after editing both files.

---

### `lib/services/checkout-pricing.ts` (fallback telemetry + exports)

**Analog:** itself — fallback catch block (verified at lines ~710-725) and the two functions to export (`allocateDiscount` at line 252, `allocateLargestRemainder` at line 451).

**Current fallback branch:**
```typescript
} catch {
  taxSource = 'configured_fallback';
  const fallbackRate = configuredRate(storeSettings['store.tax_rate']);
  if (fallbackRate === null) {
    throw new Error('Tax provider failed and store.tax_rate is not a valid configured fallback');
  }
  const netLineMinor = pricedCatalog.map(({ lineTotal }, index) =>
    lineTotal.subtract(discounts.perLine[index]).toMinorUnits()
  );
  const merchandiseTax = discountedMerchandise.applyRate(fallbackRate);
  lineTaxes = allocateLargestRemainder(
    merchandiseTax.toMinorUnits(),
    netLineMinor
  ).map((amount) => Money.fromMinor(amount, currency));
  shippingTax = storeSettings['store.tax_shipping'] === true
  ...
```

**Add immediately after `taxSource = 'configured_fallback';`:**
```typescript
recordTelemetry('checkout.tax_fallback', {
  operation: 'price', outcome: 'degraded', provider: 'stripe',
});
```
No `console.error`/`console.warn` calls exist in this file today — keep it that way (AST contract test `tests/unit/observability/instrumentation-source.test.ts` fails any file with both a `recordTelemetry` call and a bare-`error` console call).

**Export change** (currently module-private at lines 252 and 451):
```typescript
// before
function allocateDiscount(...) { ... }
function allocateLargestRemainder(...) { ... }

// after
export function allocateDiscount(...) { ... }
export function allocateLargestRemainder(...) { ... }
```

---

### `app/api/webhooks/stripe/route.ts` (`handlePaymentFailed`)

**Analog:** itself — the `webhook.processing_failed` catch pattern already used in the same function's neighbor (lines ~350-360) and the file's existing `recordTelemetry` import/usage.

**Current body (TODO stub):**
```typescript
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;

  if (!orderId) return;

  try {
    // Update order status to failed
    // TODO: Implement order status update
    // You can add additional logic here:
    // - Send failure notification emails
    // - Restore inventory if needed
    // - Log payment failure reasons

  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
  }
}
```

**Replace with (RESEARCH.md Pattern 1, verified call shape):**
```typescript
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  if (!orderId) return;
  try {
    recordTelemetry('payment.intent_failed', {
      provider: 'stripe',
      outcome: 'failed',
      reason: mapDeclineReason(paymentIntent.last_payment_error),
    });
  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
  }
}
```

`mapDeclineReason` is a new small pure helper (allowlist map, per RESEARCH.md's Don't Hand-Roll table): map `code`/`decline_code` to `card_declined | insufficient_funds | authentication_required | expired_card | other`. Never forward `last_payment_error.decline_code` raw — it's a free-form string, not a closed union.

Remove the `// TODO: Implement order status update` comment and its surrounding stale comments.

---

### `app/product/[slug]/page.tsx` and `app/category/[slug]/page.tsx`

**Analog:** `tests/unit/app/order-status-page.test.ts` confirms the codebase convention; the product page today has `notFound()` already but untyped `params`.

**Current product page signature (line ~60):**
```typescript
export default async function ProductPage({ params }: any) {
```

**Current category page (full relevant excerpt, lines 42-58):**
```typescript
import { getCategoryBySlug } from "@/lib/models";
import { getProductsByCategory } from "@/lib/models/mach/products";
...
export default async function CategoryPage({ params }: any) {
  const category = await getCategoryBySlug(params.slug);

  if (!category) {
    return <div>Category not found for slug: {params.slug}</div>;
  }

  let products: any[] = [];
  let error: string | null = null;

  try {
    products = (await getProductsByCategory(category.id as string))
      .filter((product) => product.status === "active")
      .map(toPublicProduct);
  } catch (e: any) {
    error = e?.message || 'Unknown error';
  }
```

**Target pattern (RESEARCH.md Pattern 3, matches `app/order-status/[id]/page.tsx`):**
```typescript
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  let products: PublicProduct[] = [];
  try {
    products = (await getProductsByCategory(category.id as string))
      .filter((product) => product.status === "active")
      .map(toPublicProduct);
  } catch (e) {
    // keep existing error-display behavior for the products list itself;
    // only the category-miss path changes to notFound()
  }
  ...
}
```
Add `import { notFound } from "next/navigation";` to the category page. Apply the same `Promise<{ slug: string }>` + `await params` signature change to `app/product/[slug]/page.tsx` (it already calls `notFound()` correctly — only the params type/signature needs to change).

Replace `products: any[]` and `catch (e: any)` with typed equivalents per CONTEXT.md decision (exact type: whatever `toPublicProduct` returns — check its return type before typing the array).

---

### `tests/unit/app/product-slug-page.test.ts`, `tests/unit/app/category-slug-page.test.ts`

**Analog:** `tests/unit/app/order-status-page.test.ts` lines 1-13 (mocking style, verified read):

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/models/mach/orders", () => ({ getOrderById: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "CF-Connecting-IP": "192.0.2.10" })),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import GuestOrderStatusPage, { dynamic, metadata } from "@/app/order-status/[id]/page";
import { getOrderById } from "@/lib/models/mach/orders";
```

**Apply directly (RESEARCH.md Pattern 4, ready to use as-is for the category page):**
```typescript
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/models", () => ({ getCategoryBySlug: vi.fn() }));

import CategoryPage from "@/app/category/[slug]/page";
import { getCategoryBySlug } from "@/lib/models";

it("throws NEXT_NOT_FOUND for an unknown category slug", async () => {
  vi.mocked(getCategoryBySlug).mockResolvedValue(null);
  await expect(
    CategoryPage({ params: Promise.resolve({ slug: "does-not-exist" }) })
  ).rejects.toThrow("NEXT_NOT_FOUND");
});
```
For `product-slug-page.test.ts`, mock `@/lib/models` (`getProductBySlug`), plus `getProductReviews`/`getProductReviewEligibility`/`getRecommendationsForProduct`/`buildServerUserContext`/`getStoreConfig` and `@clerk/nextjs/server`'s `auth` as needed — check the product page's full import list before writing (only lines 1-60 were read in this pass; verify remaining imports at plan/execute time).

---

### `tests/unit/lib/services/checkout-pricing.test.ts` (extend)

**Analog:** itself — existing `dependencies(...)` DI helper (RESEARCH.md Pattern 2, referenced near line 500+) and the existing sum-exactness test near line 525.

**DI pattern to force the fallback branch:**
```typescript
const deps = dependencies({
  calculateTax: vi.fn(async () => { throw new Error('provider down'); }),
});
const quote = await priceCheckout(input, { dependencies: deps });
expect(quote.taxSource).toBe('configured_fallback');
```

Use this to write the `checkout.tax_fallback` fires-on-failure-not-on-success test, and add deterministic allocation tables (1/2/10/100 lines, fixed weights, `sum(parts) === total`) calling the newly-exported `allocateDiscount`/`allocateLargestRemainder` directly — no DI needed for those since they're pure functions once exported.

---

### `docs/mobile-lighthouse-baseline.md`

**No close analog found in the repo** — table structure is fully specified in CONTEXT.md (date, Lighthouse/Chrome versions, per-route table: performance score, LCP, CLS, TBT, pass/fail vs. >=85 target). Write directly from that spec; no code excerpt to copy.

## Shared Patterns

### Telemetry event registration (dual-file parity)
**Source:** `lib/observability/telemetry.ts` `TELEMETRY_EVENTS`/`ALLOWED_FIELD_ENUMS`, mirrored byte-for-byte in `workers/observability-tail/src/core.ts` `ENUM_FIELDS`.
**Apply to:** `lib/services/checkout-pricing.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/analytics/vitals/route.ts` (missing-binding warning event).
**Rule:** every new event goes in `TELEMETRY_EVENTS`; every new field value goes in both `ALLOWED_FIELD_ENUMS` (lib) and `ENUM_FIELDS` (tail worker) in the same commit. Run `tests/unit/workers/observability-tail-core.test.ts` after editing both.

### No console.error alongside recordTelemetry
**Source:** `tests/unit/observability/instrumentation-source.test.ts` (AST contract, lines 40-54, 77-82 per RESEARCH.md).
**Apply to:** `lib/services/checkout-pricing.ts` (currently zero `console.*` calls — keep it that way when adding the fallback `recordTelemetry` call).

### Async Cloudflare binding access in route handlers
**Source:** `app/api/gift-cards/route.ts:1,16` pattern — `await getCloudflareContext({ async: true })`.
**Apply to:** `app/api/analytics/vitals/route.ts` (new `WEB_VITALS` binding access). Note `lib/observability/telemetry.ts` itself uses the sync variant wrapped in try/catch (line 276) — that's a library-internal exception, not the pattern for new route-handler code.

### notFound() via mocked next/navigation in tests
**Source:** `tests/unit/app/order-status-page.test.ts:8-12`.
**Apply to:** `tests/unit/app/product-slug-page.test.ts`, `tests/unit/app/category-slug-page.test.ts`. Never assert against Next's real `NEXT_HTTP_ERROR_FALLBACK` digest.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `docs/mobile-lighthouse-baseline.md` | config/doc | batch | No existing markdown doc in the repo has this exact per-route Lighthouse table shape; CONTEXT.md fully specifies the structure so no analog is needed |

## Metadata

**Analog search scope:** `lib/observability/`, `lib/services/checkout-pricing.ts`, `app/api/webhooks/stripe/`, `app/product/[slug]/`, `app/category/[slug]/`, `app/order-status/[id]/`, `tests/unit/app/`, `tests/unit/lib/services/`, `tests/unit/workers/`, `workers/observability-tail/src/`, `wrangler.jsonc`.
**Files scanned:** ~14 (all direct reads, no broad glob sweep needed — RESEARCH.md had already verified most line numbers).
**Pattern extraction date:** 2026-09-02
