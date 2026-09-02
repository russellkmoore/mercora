# Phase 2: Observability and Regression Guards - Research

**Researched:** 2026-09-02
**Domain:** Cloudflare Workers Analytics Engine, commerce telemetry taxonomy, Next.js 16 dynamic routes, Stripe webhook error shapes, Lighthouse CLI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Web-Vitals Sink (OBS-02)**
- Sink is a Workers Analytics Engine dataset, not D1. Add one `analytics_engine_datasets` binding to `wrangler.jsonc` (e.g. binding `WEB_VITALS`, dataset `mercora_web_vitals`), run `npm run cf-typegen` and commit the regenerated `cloudflare-env.d.ts` ONLY from a shell where `.env.local` is moved aside (otherwise local secret names leak into the generated file; see Phase 1 deferred-items.md), and update `scripts/check-deploy-config.mjs` if it validates bindings. No D1 migration.
- Stored fields are exactly five: metric name, value, rating, route template, isMobile. Drop url, userAgent, id, timestamp (Analytics Engine timestamps rows itself). Map to AE `blobs`/`doubles`/`indexes` appropriately (name, rating, route template, isMobile as blobs or index; value as a double).
- Route template is derived server-side in the vitals route: normalize the beacon's pathname against the app's dynamic segments (`/product/[slug]`, `/category/[slug]`, `/blog/[slug]`, `/order-status/[id]`, `/admin/orders/[id]`, etc.) so raw URLs never reach the sink. Unknown paths map to a bounded `other` bucket.
- Missing binding behavior: accept the beacon, skip the write, emit one `commerce.telemetry.v1` warning event (low cardinality), and still return 200. Never return 500 to the browser for a vitals beacon. Keep the existing non-production `console.log` path.

**Tax Fallback Telemetry and Failed-Payment Handler (OBS-01, OBS-05)**
- New event `checkout.tax_fallback` in the closed taxonomy: severity warning, sampleRate 1, fields `operation: 'price'`, `outcome: 'degraded'`, `provider: 'stripe'`, plus `path`/`trigger` if the taxonomy requires them. Emitted exactly where `taxSource = 'configured_fallback'` is set (`lib/services/checkout-pricing.ts` ~line 712). No address, order, or customer identifiers. A unit test proves it fires on fallback and not on provider success; the AST taxonomy contract test must accept it.
- `handlePaymentFailed` is implemented as telemetry only. Emit a new event `payment.intent_failed` (severity warning, sampleRate 1) and return. No order-state change, no email, no inventory touch, no ledger write. The `payment_intent.payment_failed` subscription stays. Remove the TODO comment.
- Failure reason is an allowlisted enum field (e.g. `reason`): map Stripe `last_payment_error.code` / `decline_code` to `card_declined`, `insufficient_funds`, `authentication_required`, `expired_card`, `other`. Add the field to the taxonomy allow-list and mirror it in `workers/observability-tail/src/core.ts` (the parity test from Phase 1 will fail otherwise).
- Hand-off to Phase 3 (RUN-02): record in the phase SUMMARY and in a "Webhook events" note in `.planning/phases/02-observability-and-regression-guards/deferred-items.md` that `payment_intent.payment_failed` is handled (telemetry only) and remains subscribed, so Phase 3 updates the two docs without re-deriving.

**Regression Tests (OBS-03, OBS-04)**
- Both slug pages type `params` as `Promise<{ slug: string }>` and `await` it. The category page calls `notFound()` for a missing category (replacing the 200 "Category not found" div), matching the product page. Also remove the `products: any[]` and `catch (e: any)` escapes in the category page while there. No other behavior changes.
- 404 tests are module-import unit tests in `tests/unit/app/`: mock the data layer (`getCategoryBySlug`, `getProductBySlug`, and whatever else the page imports), call the default export with an unknown slug, and assert Next's `notFound()` sentinel is thrown. Mirror the mocking style of the existing `tests/unit/app/*.test.ts` files.
- Export `allocateDiscount` and `allocateLargestRemainder` from `lib/services/checkout-pricing.ts` so tests can call them directly. Two-line change; do not move them to a new module.
- Allocation tests are deterministic tables, no new dependency: for each of 1, 2, 10, and 100 lines, fixed weight sets and totals asserting `sum(parts) === total`, plus penny edge cases (odd remainders, a zero-weight line, a single line, total smaller than line count). Add to `tests/unit/lib/services/checkout-pricing.test.ts` or a sibling file.

**Lighthouse Baseline (MOB-01)**
- Measure with `npx lighthouse --preset=... --form-factor=mobile` (mobile emulation, default mobile throttling) against the live site `https://voltique.russellkmoore.me`, driven by the executor using the local Google Chrome (`/Applications/Google Chrome.app`). No dependency is added to `package.json`.
- Four URLs: `/`, the first active category and the first active product discovered from the live sitemap (`/sitemap.xml`), and `/checkout`. Record the exact slugs used.
- Output is one markdown file `docs/mobile-lighthouse-baseline.md`: date, Lighthouse and Chrome versions, per-route table of performance score, LCP, CLS, TBT, and a pass/fail column against the PRD target (>= 85; note 90+ as the stretch). No JSON report blobs committed. Tick the measurement items in `docs/mobile-improvements-actionable.md` only if that doc's checklist is in this phase's file list; otherwise leave for REF-04.
- Three runs per route, report the median. If the checkout route redirects (empty cart), record what was actually measured.

### Claude's Discretion
Exact binding/dataset names, AE column mapping, the route-template mapper's implementation, the telemetry field names beyond those specified, test file names, and the Lighthouse invocation flags.

### Deferred Ideas (OUT OF SCOPE)
- Property-based allocation tests with `fast-check` (offered, not chosen; deterministic tables instead).
- Bounded D1 table as the vitals sink with a retention cron (offered, not chosen).
- Removing the `payment_intent.payment_failed` subscription entirely (offered, not chosen; handled as telemetry).
- Committing raw Lighthouse JSON reports (offered, not chosen).

### Out of Phase Boundary
Any order-state change on payment failure (ADR-WRI forbids state changes outside the ledgers); splitting `lib/services/checkout-pricing.ts` (PROJECT.md out of scope); doc updates to the Stripe webhook event lists (RUN-02, Phase 3); any new mobile UI work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | Tax-fallback telemetry event in the closed taxonomy, low-cardinality fields only, unit-tested, AST contract accepts it | Pattern 1 (event registration), Pattern 2 (DI test), Pitfall 1/4, exact call site verified at `checkout-pricing.ts:711-712` |
| OBS-02 | Web-vitals beacons written to a queryable AE sink with exactly 5 fields; route no longer discards the payload | Architecture diagram, Code Examples (binding config, `writeDataPoint` shape, limits), Pitfall 6 (distinct from existing unconfigured `COMMERCE_ANALYTICS`) |
| OBS-03 | Both slug pages type `params` as `Promise<{slug}>`, category page 404s via `notFound()`, tests cover unknown-slug path | Pattern 3 (async params + notFound), Pattern 4 (test mocking convention from `order-status-page.test.ts`) |
| OBS-04 | `allocateDiscount`/`allocateLargestRemainder` sum-exactness tests across 1/2/10/100 lines | Don't Hand-Roll (deterministic tables), exact export-site line numbers verified (252, 451) |
| OBS-05 | `handlePaymentFailed` resolved as telemetry-only, no TODO remains | Pattern 1 (call-site code example), Stripe `LastPaymentError` type verification (Open Question 1, Don't Hand-Roll) |
| MOB-01 | Lighthouse mobile baseline for 4 live routes, 3 runs each, median, stored in `docs/` | Validation Architecture (manual measurement row), Package Legitimacy Audit (`lighthouse` via `npx`), `app/sitemap.ts` verified to list product/category URLs, Open Question 2 (checkout redirect handling) |
</phase_requirements>

## Summary

This phase closes five silent-failure gaps and one measurement gap in an already-mature observability system. The codebase already has a working, tested `commerce.telemetry.v1` taxonomy (`lib/observability/telemetry.ts`) with a closed enum contract mirrored byte-for-byte in `workers/observability-tail/src/core.ts`, and an AST contract test that enforces both. Two new telemetry events (`checkout.tax_fallback`, `payment.intent_failed`) and one new enum field (`reason`) slot into this existing machinery with no new sink, marker, or serialization logic needed.

The most consequential discovery: `lib/observability/telemetry.ts` **already contains a working Analytics Engine write path** (`optionalAnalytics()` → `env.COMMERCE_ANALYTICS.writeDataPoint(...)`), fully unit-tested, but `wrangler.jsonc` has **no `analytics_engine_datasets` binding at all** — so every `recordTelemetry()` call today writes to console only, never to Analytics Engine, in production. This is a pre-existing gap, not something OBS-02 must fix, but it means this phase is not inventing the AE pattern from scratch — a `producer-bindings.example.jsonc` file in `workers/observability-tail/` already documents the exact binding shape (`{ "binding": "COMMERCE_ANALYTICS", "dataset": "..." }`). OBS-02's web-vitals sink is a **second, separate** binding (CONTEXT.md discretion: e.g. `WEB_VITALS`), because the vitals payload shape (metric name/value/rating/route/isMobile) is structurally different from the commerce severity-event shape `writeMetric()` already writes.

**Primary recommendation:** Add one new `analytics_engine_datasets` binding for web-vitals (separate from the existing unconfigured `COMMERCE_ANALYTICS`), regenerate `cloudflare-env.d.ts` only with `.env.local` moved aside, wire the two new telemetry events through the existing `recordTelemetry()`/`TELEMETRY_EVENTS`/`ALLOWED_FIELD_ENUMS` machinery exactly as every other event in the file already does, export the two already-written pure allocation functions with a two-line change, fix the two slug pages to the `Promise<{slug}>` + `notFound()` pattern already used by `order-status/[id]/page.tsx`, and run Lighthouse via `npx` (no new dependency) against the live site.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tax-fallback telemetry (OBS-01) | API/Backend (`lib/services/checkout-pricing.ts`) | Database/Storage (Analytics Engine, once wired) | Pricing service already owns the fallback decision; telemetry is a side-effect at the decision site |
| Web-vitals ingestion (OBS-02) | API/Backend (`app/api/analytics/vitals/route.ts`) | Database/Storage (new AE dataset) | Route already exists as the ingestion boundary; only the sink changes |
| Route-template normalization (OBS-02) | API/Backend | — | Must happen server-side per CONTEXT.md decision — raw URLs must never reach the sink |
| 404 handling for slug pages (OBS-03) | Frontend Server/SSR (Next.js Server Components) | — | `notFound()` is a Next.js server-rendering primitive, not client-side |
| Allocation correctness (OBS-04) | API/Backend (`lib/services/checkout-pricing.ts`) | — | Pure functions, no I/O; tests are unit-level, no tier crossing |
| Failed-payment telemetry (OBS-05) | API/Backend (`app/api/webhooks/stripe/route.ts`) | — | Webhook handler is the API boundary receiving Stripe's event |
| Mobile performance baseline (MOB-01) | Browser/Client (measured) | — | Lighthouse measures client-rendered page performance; output is a static doc, not runtime code |

## Package Legitimacy Audit

No new runtime dependency is added to `package.json` in this phase. `npx lighthouse` downloads and executes the package transiently for the MOB-01 measurement step only.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `lighthouse` | npm | ~9 yrs (Google Chrome team project) | multi-million/wk | github.com/GoogleChrome/lighthouse | OK | Approved — run via `npx`, not installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`lighthouse@13.4.1` is the current published version `[VERIFIED: npm registry` — `npm view lighthouse version` returned `13.4.1` this session`]`.

## Standard Stack

### Core (all already in the codebase — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wrangler` (via `npm run cf-typegen`) | project-pinned | Regenerates `cloudflare-env.d.ts` after binding changes | Already the project's binding-type source of truth |
| `@opennextjs/cloudflare` | project-pinned | `getCloudflareContext()` — the only supported way to reach `env` bindings from a Next.js route handler under OpenNext | Already used in 30+ route handlers/libs in this codebase |
| `stripe` | `^22.5.0` `[VERIFIED: package.json:77]` | `PaymentIntent.last_payment_error.code` / `.decline_code` typed access | Already the project's Stripe SDK |
| `vitest` | project-pinned | Unit tests for all five OBS requirements | Already the project's test runner (`vitest.config.mts`, `vitest.workers.config.mts`, `vitest.observability.config.mts`) |
| `next` | `^16.3.1` `[VERIFIED: package.json:69]` | `Promise<{slug}>` params, `notFound()` | Already the project's framework version |
| `lighthouse` | `13.4.1` (via `npx`, not installed) | Mobile performance baseline (MOB-01) | Google's own auditing tool; CONTEXT.md explicitly forbids adding it as a dependency |

### Supporting
No new supporting libraries are required. Every capability in this phase is additive to existing modules (`lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts`, `lib/services/checkout-pricing.ts`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Workers Analytics Engine for web-vitals | Bounded D1 table with retention cron | CONTEXT.md explicitly rejected this (deferred idea); AE has zero migration/retention-cron maintenance cost and 3-month built-in retention |
| Deterministic allocation test tables | `fast-check` property-based tests | CONTEXT.md explicitly rejected this (deferred idea); no new dev dependency, tables are easier to reason about for exact-sum invariants |
| `npx lighthouse` | Lighthouse CI GitHub Action / Playwright | CONTEXT.md scopes this to a one-time baseline doc; CI automation is `REQ-mobile-test-automation` (backlog) |

**Installation:** None. No `npm install` needed for this phase.

**Version verification:** `npm view lighthouse version` → `13.4.1` `[VERIFIED: npm registry]`. `stripe` and `next` versions read directly from `package.json` `[VERIFIED: package.json:69,77]`.

## Architecture Patterns

### System Architecture Diagram

```
[Browser: useWebVitals hook]
        │ POST { name, value, rating, url, isMobile }
        ▼
[app/api/analytics/vitals/route.ts]  (API tier)
        │ 1. parse + validate payload
        │ 2. derive route template from url pathname (server-side normalizer)
        │ 3. getCloudflareContext().env.WEB_VITALS (new AE binding)
        │        │
        │        ├─ binding present → writeDataPoint({blobs, doubles, indexes}) [fire-and-forget]
        │        └─ binding absent  → recordTelemetry('<warning event>', {...}, low-cardinality)
        │ 4. always return 200 { status: "ok" }
        ▼
[Workers Analytics Engine dataset]  (queryable via SQL API / GraphQL)

---

[lib/services/checkout-pricing.ts: priceCheckout()]
        │ deps.calculateTax(...) throws (Stripe Tax unavailable)
        ▼
   catch { taxSource = 'configured_fallback'; ... }
        │ NEW: recordTelemetry('checkout.tax_fallback', {operation:'price', outcome:'degraded', provider:'stripe'})
        ▼
   [lib/observability/telemetry.ts: recordTelemetry]
        │ severity → console.warn (JSON, machine-marked)
        │ writeMetric() → env.COMMERCE_ANALYTICS (still unconfigured — console-only today)
        ▼
   [workers/observability-tail (tail_consumers — NOT yet wired in wrangler.jsonc)]

---

[Stripe: payment_intent.payment_failed webhook]
        ▼
[app/api/webhooks/stripe/route.ts: handlePaymentFailed()]
        │ NEW: map last_payment_error.code/decline_code → allowlisted `reason` enum
        │ NEW: recordTelemetry('payment.intent_failed', {reason, provider:'stripe', outcome:'failed'})
        │ (no order-state change, no email, no inventory — telemetry only)
        ▼
   [same console/AE path as above]

---

[Request: /category/unknown-slug]
        ▼
[app/category/[slug]/page.tsx]
        │ params: Promise<{slug}> → await
        │ getCategoryBySlug(slug) → null
        ▼
   notFound()  → Next.js 404 boundary (matches app/product/[slug]/page.tsx today)
```

### Recommended Project Structure

No new directories. All changes are edits to existing files:
```
app/api/analytics/vitals/route.ts     # rewrite: write to AE, derive route template
app/category/[slug]/page.tsx          # fix params type, notFound(), remove `any`
app/product/[slug]/page.tsx           # fix params type only (notFound() already correct)
app/api/webhooks/stripe/route.ts      # implement handlePaymentFailed body
lib/observability/telemetry.ts        # add 2 events, 1 enum field (reason)
lib/services/checkout-pricing.ts      # export 2 functions, add recordTelemetry call
workers/observability-tail/src/core.ts # mirror reason enum + event list
wrangler.jsonc                        # new analytics_engine_datasets binding
cloudflare-env.d.ts                   # regenerated (cf-typegen, .env.local moved aside)
scripts/check-deploy-config.mjs       # update only if it validates bindings (it currently does not — see Pitfall 3)
tests/unit/app/{product,category}-slug-page.test.ts   # new
tests/unit/lib/services/checkout-pricing.test.ts       # extended (or sibling file)
tests/unit/observability/*                             # existing contract tests, no new file needed
docs/mobile-lighthouse-baseline.md    # new
```

### Pattern 1: Adding a telemetry event to the closed taxonomy
**What:** Register the event in `TELEMETRY_EVENTS` (severity + sampleRate), call `recordTelemetry(event, fields, error?)` at the failure/degradation site, and if a new field is introduced, add it to `ALLOWED_FIELD_ENUMS` in `lib/observability/telemetry.ts` **and** mirror it in `ENUM_FIELDS` in `workers/observability-tail/src/core.ts`.
**When to use:** Every new observable failure/degradation in commerce code paths.
**Example (verified against actual source, `lib/observability/telemetry.ts:25-72,102-120`):**
```typescript
// lib/observability/telemetry.ts — add alongside existing entries
export const TELEMETRY_EVENTS = {
  // ...existing entries...
  'checkout.tax_fallback': { severity: 'warning', sampleRate: 1 },
  'payment.intent_failed': { severity: 'warning', sampleRate: 1 },
} as const;

export const ALLOWED_FIELD_ENUMS = {
  // ...existing fields...
  reason: new Set([
    'card_declined', 'insufficient_funds', 'authentication_required',
    'expired_card', 'other',
  ]),
} as const;
```
```typescript
// workers/observability-tail/src/core.ts — byte-for-byte mirror (checked by
// tests/unit/workers/observability-tail-core.test.ts:226-236)
export const ENUM_FIELDS: Record<string, ReadonlySet<string>> = {
  // ...existing fields...
  reason: new Set([
    'card_declined', 'insufficient_funds', 'authentication_required',
    'expired_card', 'other',
  ]),
};
```
Call sites (verified locations):
```typescript
// lib/services/checkout-pricing.ts:711-712 — inside the existing catch block
} catch {
  taxSource = 'configured_fallback';
  recordTelemetry('checkout.tax_fallback', {
    operation: 'price', outcome: 'degraded', provider: 'stripe',
  });
  // ...existing fallback logic continues unchanged...
```
```typescript
// app/api/webhooks/stripe/route.ts:344-360 — replace the TODO body
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

### Pattern 2: DI-based unit testing of `priceCheckout`'s fallback branch
**What:** `priceCheckout(input, options)` accepts `options.dependencies?: Partial<PricingDependencies>` and merges it over `defaultDependencies` (`lib/services/checkout-pricing.ts:520`, verified). A test can force the tax provider to fail without touching real Stripe.
**Example:**
```typescript
// tests/unit/lib/services/checkout-pricing.test.ts — pattern already used in
// this file's existing `dependencies(...)` helper (see line ~500+)
const deps = dependencies({
  calculateTax: vi.fn(async () => { throw new Error('provider down'); }),
});
const quote = await priceCheckout(input, { dependencies: deps });
expect(quote.taxSource).toBe('configured_fallback');
```

### Pattern 3: Next.js 16 async `params` + `notFound()` in a Server Component page
**What:** Type `params` as `Promise<{ slug: string }>`, `await` it, call `notFound()` on miss. This is the exact pattern `app/product/[slug]/page.tsx` and `app/order-status/[id]/page.tsx` already use for `notFound()`.
**Example (verified against `app/product/[slug]/page.tsx:60-62` structure — signature change only):**
```typescript
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  // ...
}
```

### Pattern 4: Module-import unit test for `notFound()` on unknown slug
**What:** Mock `next/navigation`'s `notFound` to throw a sentinel Error, mock the data-layer call to return `null`/`undefined`, call the page's default export directly, assert the rejection. This is the exact pattern already used in `tests/unit/app/order-status-page.test.ts:8-12,77-87` — the project does **not** assert against Next's real `NEXT_HTTP_ERROR_FALLBACK` digest; it mocks `notFound()` itself.
**Example:**
```typescript
// tests/unit/app/category-slug-page.test.ts
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

### Anti-Patterns to Avoid
- **Reusing `COMMERCE_ANALYTICS` for web-vitals:** The existing binding writes a fixed 4-blob/1-double/1-index commerce-severity shape (`writeMetric()`). Web-vitals needs a different shape (metric name/value/rating/route/isMobile). Use a separate binding as CONTEXT.md specifies.
- **Asserting the real Next.js `notFound()` digest:** This codebase's convention (`order-status-page.test.ts`) mocks `next/navigation` entirely rather than asserting on Next's internal `NEXT_HTTP_ERROR_FALLBACK;404` digest string. Mirror the existing convention, don't invent a new one.
- **Adding `console.error(label, error)` to `checkout-pricing.ts` after wiring `recordTelemetry`:** The AST contract test (`tests/unit/observability/instrumentation-source.test.ts:40-54,77-82`) fails any file that calls `recordTelemetry` **and** has a `console.error`/`console.warn` call passing a bare `error` identifier. `checkout-pricing.ts` currently has zero `console.*` calls `[VERIFIED: grep of lib/services/checkout-pricing.ts returned only the DI destructuring, no console statements]` — keep it that way.
- **Committing a local `cf-typegen` regeneration without moving `.env.local` aside:** confirmed root cause in Phase 1 `deferred-items.md` — local `.env.local` variable names (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, etc.) get folded into the committed `CloudflareEnv` interface if present during regeneration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web-vitals sink | Custom D1 table + retention cron | Workers Analytics Engine (already the closed decision) | Zero migration, built-in 3-month retention, native SQL API for queries |
| Route-template normalization | Regex per-page | A small allowlist-based mapper keyed on the app's known dynamic segments (`/product/[slug]`, `/category/[slug]`, `/blog/[slug]`, `/order-status/[id]`, `/admin/orders/[id]`) with an `other` bucket fallback | Bounded cardinality is the whole point — CONTEXT.md requires unknown paths to fall into one bucket, not leak arbitrary paths |
| Allocation-sum tests | `fast-check`/property-based testing | Deterministic fixed-weight tables at 1/2/10/100 lines (CONTEXT.md decision) | No new dev dependency; exact-sum assertions are simpler to reason about with fixed fixtures than generated ones |
| Failure-reason mapping | Passing Stripe's raw `last_payment_error.code` through to telemetry | An explicit allowlist map (`card_declined`, `insufficient_funds`, `authentication_required`, `expired_card`, `other`) | Stripe's `LastPaymentError.Code` union has 200+ possible values `[VERIFIED: node_modules/stripe/cjs/resources/PaymentIntents.d.ts:713]` — passing it straight through would blow the closed-taxonomy contract and the tail worker's `sanitizeFields` would silently drop it anyway |

**Key insight:** Every "don't hand-roll" here is really "don't widen a closed contract" — the codebase's entire observability model depends on both `lib/observability/telemetry.ts` and `workers/observability-tail/src/core.ts` staying byte-identical in their enum surfaces. Any new field must be added to both, in the same commit.

## Common Pitfalls

### Pitfall 1: Forgetting the tail-worker enum mirror
**What goes wrong:** Adding `reason` only to `ALLOWED_FIELD_ENUMS` in `lib/observability/telemetry.ts` without mirroring it in `ENUM_FIELDS` in `workers/observability-tail/src/core.ts`.
**Why it happens:** The two files are in different packages (`lib/` vs `workers/observability-tail/`) with no shared import — the parity is enforced only by a test, not the type system.
**How to avoid:** Edit both files in the same task; run `tests/unit/workers/observability-tail-core.test.ts` before considering the change complete.
**Warning signs:** `tests/unit/workers/observability-tail-core.test.ts:226-236` fails with a set-mismatch on `reason`.

### Pitfall 2: `cf-typegen` leaking local secrets into the committed types
**What goes wrong:** Running `npm run cf-typegen` with `.env.local` present folds local secret variable names (and rewrites `mainModule` to an absolute path) into the committed `cloudflare-env.d.ts`, corrupting the source of truth and potentially exposing secret names.
**Why it happens:** `wrangler types` reads `.env.local` (confirmed root-cause note, `.planning/phases/01-security-and-admin-auth-truth/deferred-items.md`). `.env.local` **exists in this repo today** `[VERIFIED: test -f .env.local → EXISTS]`.
**How to avoid:** `mv .env.local .env.local.bak && npm run cf-typegen && mv .env.local.bak .env.local` (or equivalent temporary move) before regenerating and committing.
**Warning signs:** Diff on `cloudflare-env.d.ts` shows unrelated `vars` entries (e.g. `RESEND_API_KEY`, `STRIPE_SECRET_KEY`) or a changed `mainModule` import path.

### Pitfall 3: Assuming `check-deploy-config.mjs` already validates bindings
**What goes wrong:** Planning a task to "update the binding validation" when none exists.
**Why it happens:** CONTEXT.md hedges with "if it validates bindings." It does not: `scripts/check-deploy-config.mjs` `[VERIFIED: scripts/check-deploy-config.mjs:1-56, read in full this session]` only checks for `REPLACE_WITH_` placeholders, `ORDER_STATUS_SECRET` shape, and the `NEXT_PUBLIC_ROBOTS_INDEX`/`NEXT_PUBLIC_SITE_URL` pair. It never inspects `d1_databases`, `r2_buckets`, `vectorize`, `analytics_engine_datasets`, or any other binding array.
**How to avoid:** No change to `scripts/check-deploy-config.mjs` is required for OBS-02. Do not add a task for it.
**Warning signs:** N/A — this is a negative finding, confirmed by reading the full script.

### Pitfall 4: Widening the taxonomy with a raw Stripe decline code
**What goes wrong:** Emitting `paymentIntent.last_payment_error?.code` or `.decline_code` directly as a telemetry field value.
**Why it happens:** It looks like the "real" reason and is tempting to pass through unmodified for richer debugging.
**How to avoid:** Map through the allowlist in code — outside the four named codes, always emit `'other'`. `decline_code` is typed as a free-form `string` (not a union) `[VERIFIED: node_modules/stripe/cjs/resources/PaymentIntents.d.ts:395]`, so it must never be forwarded raw.
**Warning signs:** `ALLOWED_FIELD_ENUMS.reason` rejects the value silently (`sanitizeTelemetryFields` just drops unknown enum values — no error is thrown), so the bug manifests as *missing* `reason` fields in telemetry, not a crash.

### Pitfall 5: `tail_consumers` is not wired — telemetry never reaches the tail worker today
**What goes wrong:** Assuming critical/warning telemetry emitted via `recordTelemetry()` is already flowing into `commerce-observability-tail` for alerting.
**Why it happens:** The tail worker exists, is deployed (`workers/observability-tail/wrangler.jsonc` names it `commerce-observability-tail`), and has full test coverage — but the **producer's** `wrangler.jsonc` (the main `mercora` Worker) has no `tail_consumers` entry `[VERIFIED: grep for "tail_consumers" in wrangler.jsonc returned 0 matches]`.
**Why it's out of scope:** Not named in OBS-01/02/05 or CONTEXT.md's decisions. Flagging so the planner doesn't assume alerting is live end-to-end; new `checkout.tax_fallback`/`payment.intent_failed` events will log to console (and to AE once `COMMERCE_ANALYTICS` is bound) but will not trigger tail-worker email alerts until `tail_consumers` is separately wired.
**Recommendation:** Record as a phase SUMMARY note or deferred-items entry, not a new task — do not expand scope.

### Pitfall 6: `COMMERCE_ANALYTICS` binding is also unconfigured today
**What goes wrong:** Assuming existing `recordTelemetry()` calls (all pre-Phase-2 events) already write to Analytics Engine in production.
**Why it happens:** The code path (`optionalAnalytics()` → `writeMetric()`) is fully implemented and tested; only the binding is missing from `wrangler.jsonc` `[VERIFIED: grep of wrangler.jsonc for "analytics_engine_datasets" returned 0 matches; also documented as an open item in STATE.md's Blockers/Concerns]`.
**Why it's out of scope:** OBS-02's locked decision is specifically about the web-vitals sink; CONTEXT.md's binding example name (`WEB_VITALS`) is explicitly separate. Wiring `COMMERCE_ANALYTICS` is not named in any OBS-0x requirement.
**Recommendation:** Do not conflate the two bindings in planning. If the planner wants to also wire `COMMERCE_ANALYTICS` while touching `wrangler.jsonc` anyway, that is a scope decision for Russell, not an assumption to bake into the plan silently.

## Code Examples

### Analytics Engine binding (wrangler.jsonc)
```jsonc
// Source: Cloudflare docs via Context7 (/cloudflare/cloudflare-docs,
// "Configure Analytics Engine dataset bindings in Wrangler") — [CITED]
{
  "analytics_engine_datasets": [
    {
      "binding": "WEB_VITALS",
      "dataset": "mercora_web_vitals"
    }
  ]
}
```

### writeDataPoint call shape
```typescript
// Source: Cloudflare docs via Context7 (/cloudflare/cloudflare-docs,
// "Writing a data point in a Worker") — [CITED]
env.WEB_VITALS.writeDataPoint({
  blobs: [metricName, rating, routeTemplate, String(isMobile)],
  doubles: [value],
  indexes: [routeTemplate],
});
```
Field-to-column mapping is Claude's discretion per CONTEXT.md; the above is one valid mapping (route template as the single allowed index — see Pitfall/limits below for why only one index is possible).

### Reaching the binding from a route handler (OpenNext pattern already used 30+ places)
```typescript
// Source: existing pattern, e.g. app/api/gift-cards/route.ts:1,16 — [VERIFIED]
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const analytics = env.WEB_VITALS as AnalyticsEngineDataset | undefined;
  // ...
}
```
Note: `lib/observability/telemetry.ts` uses the **sync** `getCloudflareContext()` (no `{ async: true }`) wrapped in try/catch, because it must work in contexts where the async context isn't guaranteed (`lib/observability/telemetry.ts:278`, verified). New route-handler code should follow the **async** pattern (`await getCloudflareContext({ async: true })`) since that is the pattern used by every other `app/api/*/route.ts` file in this codebase, including the existing `app/api/analytics/vitals/route.ts` neighbors.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `/api/analytics/vitals` logs to console in dev, discards in prod | Writes to a queryable AE dataset in prod | This phase (OBS-02) | Operators can query mobile LCP/INP/CLS from real traffic for the first time |
| `params: any` on slug pages | `params: Promise<{slug: string}>` + `await` | Next.js 15+ made `params` a Promise; this codebase has one page (`product/[slug]`) already migrated and one (`category/[slug]`) not | Type safety; category page also gains real 404s |
| `allocateDiscount`/`allocateLargestRemainder` module-private, one sum test at line 525 | Exported, tested across 1/2/10/100-line tables | This phase (OBS-04) | Broader regression coverage of penny-rounding invariants |
| `handlePaymentFailed` — TODO, does nothing | Telemetry-only handler | This phase (OBS-05) | Operators get visibility into payment failures without violating ADR-WRI (no order-state change) |

**Deprecated/outdated:** None specific to this phase — no library version is being bumped; all changes are additive to current-version code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Binding name `WEB_VITALS` and dataset name `mercora_web_vitals` are illustrative, not fixed — CONTEXT.md marks exact names as Claude's Discretion | Code Examples, Architecture | None — any name works as long as it's distinct from `COMMERCE_ANALYTICS` and consistently used across `wrangler.jsonc`, the route, and the regenerated types |
| A2 | Route-template mapper's exact bucket list (`/product/[slug]`, `/category/[slug]`, `/blog/[slug]`, `/order-status/[id]`, `/admin/orders/[id]`, `other`) is the full intended set | Don't Hand-Roll | If the phase intends more dynamic routes normalized, the mapper would need extending — worth confirming the full list of dynamic segments against `app/` at plan time |
| A3 | AE index cardinality guidance (index-per-route-template is preferable to a single global index) is inferred from Cloudflare's general sampling documentation, not a specific recommendation for this exact 4-route cardinality | Code Examples | Low risk — 4-6 route buckets is far below any sampling threshold Cloudflare's docs describe (sampling triggers "at very high volumes... too quickly into one index") |

**If this table is empty:** N/A — see above; all three items are low-risk naming/design-discretion items, not verification gaps.

## Open Questions

1. **Should `handlePaymentFailed`'s `reason` derivation prefer `code` over `decline_code`, or combine both?**
   - What we know: `code` is a closed ~200-value union (`LastPaymentError.Code`), `decline_code` is a free-form string `[VERIFIED: node_modules/stripe/cjs/resources/PaymentIntents.d.ts:391,395,713]`. CONTEXT.md's mapping list (`card_declined`, `insufficient_funds`, `authentication_required`, `expired_card`) are all values that appear in `code`'s union, not `decline_code`.
   - What's unclear: Whether `decline_code` should ever influence the mapping (e.g. `code === 'card_declined'` with `decline_code === 'insufficient_funds'` — Stripe sometimes puts the more specific reason in `decline_code` when `code` is the generic `card_declined`).
   - Recommendation: Map primarily on `code`; if `code === 'card_declined'`, check `decline_code === 'insufficient_funds'` to upgrade to the more specific `insufficient_funds` reason, else `other`. This is a two-line refinement the planner can decide to include or skip — either is defensible.

2. **Will the checkout route actually be reachable for MOB-01's Lighthouse run, or will it redirect on an empty cart?**
   - What we know: CONTEXT.md already anticipates this ("If the checkout route redirects, record what was actually measured").
   - What's unclear: Whether `/checkout` on the live production site redirects unconditionally without a populated cart (cart state is client-side, e.g. `localStorage`/cookie), which Lighthouse's fresh browser session won't have.
   - Recommendation: The executor should attempt `/checkout` as specified and document the actual observed behavior (redirect target and its own Lighthouse score) rather than trying to pre-populate a cart, which is out of scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Google Chrome (`/Applications/Google Chrome.app`) | Lighthouse local Chrome launch (MOB-01) | Not verified this session (macOS GUI app, not shell-probable in this sandbox) | — | If absent, `npx lighthouse --chrome-flags="--headless"` can use `chrome-launcher`'s auto-discovery, or `CHROME_PATH` env var can point at any installed Chromium build |
| `npx` / Node 24 | Running `lighthouse` without installing it | ✓ (project requires Node 24 via mise; `engines.node: ">=24.18.1 <25"` `[VERIFIED: package.json:6]`) | — | — |
| Live site reachability (`https://voltique.russellkmoore.me`) | MOB-01 measurement target | Not verified this session (external network call not attempted) | — | None — MOB-01 requires the live site by design (CONTEXT.md: "against the live site") |

**Missing dependencies with no fallback:** None confirmed missing — Chrome and site reachability could not be probed from this research session but have documented fallbacks or are execution-time concerns for the executor, not planning blockers.

**Missing dependencies with fallback:** Chrome path discovery (see above).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-pinned) |
| Config file | `vitest.config.mts` (unit), `vitest.workers.config.mts` (workers), `vitest.observability.config.mts` (observability-tail) |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/services/checkout-pricing.test.ts tests/unit/app/category-slug-page.test.ts tests/unit/app/product-slug-page.test.ts` |
| Full suite command | `mise exec -- npm test && mise exec -- npm run test:workers && mise exec -- npm run test:observability-worker` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | `checkout.tax_fallback` fires on provider failure, not on success | unit | `vitest run tests/unit/lib/services/checkout-pricing.test.ts` | ✅ (extend existing file) |
| OBS-01 | AST contract accepts the new event, no raw console.error(label,error) added | unit | `vitest run tests/unit/observability/instrumentation-source.test.ts` | ✅ (existing, no changes needed) |
| OBS-02 | Vitals route writes 5-field records; missing binding still returns 200 | unit | `vitest run tests/unit/app/vitals-route.test.ts` | ❌ Wave 0 (new file — no existing test for this route found) |
| OBS-03 | Both slug pages type params correctly, unknown slug → notFound() | unit | `vitest run tests/unit/app/product-slug-page.test.ts tests/unit/app/category-slug-page.test.ts` | ❌ Wave 0 (new files) |
| OBS-04 | `allocateDiscount`/`allocateLargestRemainder` sums exact across 1/2/10/100 lines | unit | `vitest run tests/unit/lib/services/checkout-pricing.test.ts` | ✅ (extend existing file; sum test at line 525 already exists as a base case) |
| OBS-05 | `handlePaymentFailed` emits `payment.intent_failed` with mapped `reason`, no order-state change | unit | `vitest run tests/unit/app/webhook-stripe-payment-failed.test.ts` (or extend existing stripe webhook test file if one exists) | ❌ Wave 0 (verify existing stripe webhook test file first — not read this session) |
| OBS-01/OBS-05 | `reason` enum parity between `lib/observability/telemetry.ts` and `workers/observability-tail/src/core.ts` | unit | `vitest run --config vitest.observability.config.mts tests/unit/workers/observability-tail-core.test.ts` | ✅ (existing parity test, no changes needed beyond adding the enum) |
| MOB-01 | Lighthouse mobile scores recorded for 4 live routes, 3 runs each, median reported | manual (documented, not automated) | `npx lighthouse <url> --preset=perf --form-factor=mobile --output=json --chrome-flags="--headless"` × 3 per route, executor computes median | N/A — output is `docs/mobile-lighthouse-baseline.md`, not a test file |

### Sampling Rate
- **Per task commit:** targeted `vitest run <changed test file>`
- **Per wave merge:** `npm test && npm run test:workers && npm run test:observability-worker`
- **Phase gate:** Full suite green, plus `npm run lint && npm run typecheck && npm run cf-typecheck && npm run build` before `/gsd-verify-work` (matches STATE.md's documented CI gate list)

### Wave 0 Gaps
- [ ] `tests/unit/app/product-slug-page.test.ts` — covers OBS-03 (product page)
- [ ] `tests/unit/app/category-slug-page.test.ts` — covers OBS-03 (category page)
- [ ] `tests/unit/app/vitals-route.test.ts` — covers OBS-02 (route rewrite; check whether one already exists under a different name before creating)
- [ ] Confirm whether a test file for `app/api/webhooks/stripe/route.ts`'s `handlePaymentFailed` already exists (not located during this research session — grep for it at plan time: `find tests/unit -iname "*webhook*stripe*"`) — covers OBS-05
- [ ] Framework install: none — Vitest is already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surfaces |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Vitals route must validate/bound the incoming beacon payload before deriving a route template (reject overlong/malformed `url`, cap payload size) — mirrors `queryFreePath()`'s existing bounding pattern in `lib/observability/telemetry.ts:164-173` |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded/high-cardinality data reaching Analytics Engine (raw URLs, user agents, IDs) | Information Disclosure | Server-side route-template normalization with a bounded `other` bucket (CONTEXT.md decision); never forward raw `url`/`userAgent`/`id` — drop them entirely per the "exactly five fields" decision |
| Telemetry taxonomy widening via unvalidated enum values (Stripe decline codes, arbitrary reason strings) | Tampering / Information Disclosure | Allowlist mapping before emission (see Don't Hand-Roll); `sanitizeTelemetryFields`/`sanitizeFields` already drop unknown values silently as a second line of defense |
| PII leaking into telemetry fields (address, customer ID) on tax fallback or payment failure | Information Disclosure | `checkout.tax_fallback` and `payment.intent_failed` fields are limited to `operation`/`outcome`/`provider`/`reason` — no address, order, or customer identifier, per CONTEXT.md decision, matching the codebase's existing low-cardinality-fields-only convention |

## Sources

### Primary (HIGH confidence)
- Direct file reads this session (all `[VERIFIED]` tags above): `lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts`, `lib/services/checkout-pricing.ts`, `app/api/webhooks/stripe/route.ts`, `app/product/[slug]/page.tsx`, `app/category/[slug]/page.tsx`, `wrangler.jsonc`, `cloudflare-env.d.ts`, `scripts/check-deploy-config.mjs`, `tests/unit/lib/observability/telemetry.test.ts`, `tests/unit/observability/instrumentation-source.test.ts`, `tests/unit/app/order-status-page.test.ts`, `tests/unit/workers/observability-tail-core.test.ts`, `workers/observability-tail/producer-bindings.example.jsonc`, `node_modules/stripe/cjs/resources/PaymentIntents.d.ts`, `app/sitemap.ts`, `package.json`, `.planning/config.json`.

### Secondary (MEDIUM confidence)
- Context7 `/cloudflare/cloudflare-docs` — Analytics Engine `writeDataPoint` limits (20 blobs/20 doubles/1 index, 16KB blob cap, 96-byte index cap, 250 points/invocation), `analytics_engine_datasets` wrangler config shape, and index-cardinality/sampling behavior. `[CITED: developers.cloudflare.com/analytics/analytics-engine/limits, .../sampling, .../sql-api, .../workers/wrangler/configuration]`

### Tertiary (LOW confidence)
- None used as load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new is installed; every library is already pinned in `package.json` and verified by direct read
- Architecture: HIGH — every integration point was read directly from source, including the DI seam, the AST contract test's exact matching logic, and the existing `AnalyticsEngineDataset`/binding type shape
- Pitfalls: HIGH — five of six pitfalls are confirmed by direct negative/positive greps and file reads this session (`check-deploy-config.mjs` full read, `tail_consumers` absence, `COMMERCE_ANALYTICS` absence, `.env.local` presence, AST contract mechanics)

**Research date:** 2026-09-02
**Valid until:** 30 days (stable internal codebase; Lighthouse/Stripe SDK versions should be re-checked if this research is reused past that window)
