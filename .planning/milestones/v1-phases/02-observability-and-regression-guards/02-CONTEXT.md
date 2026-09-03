# Phase 2: Observability and Regression Guards - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous); 16 questions across 4 areas, user accepted all recommendations

<domain>
## Phase Boundary

The silent failure modes the codebase map found become visible to an operator, and the regressions it found have tests that would catch them if they came back. Concretely: a telemetry event when checkout falls back to the flat tax rate; production web-vitals beacons written to a queryable sink; typed `params` and real 404s on the two slug pages with tests; allocation-sum tests across 1, 2, 10, and 100 lines; the empty failed-payment webhook handler resolved as telemetry; a Lighthouse mobile baseline recorded in `docs/`.

Requirements: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, MOB-01.

Out of this phase: any order-state change on payment failure (ADR-WRI forbids state changes outside the ledgers); splitting `lib/services/checkout-pricing.ts` (PROJECT.md out of scope); doc updates to the Stripe webhook event lists (RUN-02, Phase 3); any new mobile UI work.

</domain>

<decisions>
## Implementation Decisions

### Web-Vitals Sink (OBS-02)
- **Sink is a Workers Analytics Engine dataset**, not D1. Add one `analytics_engine_datasets` binding to `wrangler.jsonc` (e.g. binding `WEB_VITALS`, dataset `mercora_web_vitals`), run `npm run cf-typegen` and commit the regenerated `cloudflare-env.d.ts` ONLY from a shell where `.env.local` is moved aside (otherwise local secret names leak into the generated file; see Phase 1 deferred-items.md), and update `scripts/check-deploy-config.mjs` if it validates bindings. No D1 migration.
- **Stored fields are exactly five:** metric name, value, rating, route template, isMobile. Drop url, userAgent, id, timestamp (Analytics Engine timestamps rows itself). Map to AE `blobs`/`doubles`/`indexes` appropriately (name, rating, route template, isMobile as blobs or index; value as a double).
- **Route template is derived server-side** in the vitals route: normalize the beacon's pathname against the app's dynamic segments (`/product/[slug]`, `/category/[slug]`, `/blog/[slug]`, `/order-status/[id]`, `/admin/orders/[id]`, etc.) so raw URLs never reach the sink. Unknown paths map to a bounded `other` bucket.
- **Missing binding behavior:** accept the beacon, skip the write, emit one `commerce.telemetry.v1` warning event (low cardinality), and still return 200. Never return 500 to the browser for a vitals beacon. Keep the existing non-production `console.log` path.

### Tax Fallback Telemetry and Failed-Payment Handler (OBS-01, OBS-05)
- **New event `checkout.tax_fallback`** in the closed taxonomy: severity warning, sampleRate 1, fields `operation: 'price'`, `outcome: 'degraded'`, `provider: 'stripe'`, plus `path`/`trigger` if the taxonomy requires them. Emitted exactly where `taxSource = 'configured_fallback'` is set (`lib/services/checkout-pricing.ts` ~line 712). No address, order, or customer identifiers. A unit test proves it fires on fallback and not on provider success; the AST taxonomy contract test must accept it.
- **`handlePaymentFailed` is implemented as telemetry only.** Emit a new event `payment.intent_failed` (severity warning, sampleRate 1) and return. No order-state change, no email, no inventory touch, no ledger write. The `payment_intent.payment_failed` subscription stays. Remove the TODO comment.
- **Failure reason is an allowlisted enum field** (e.g. `reason`): map Stripe `last_payment_error.code` / `decline_code` to `card_declined`, `insufficient_funds`, `authentication_required`, `expired_card`, `other`. Add the field to the taxonomy allow-list and mirror it in `workers/observability-tail/src/core.ts` (the parity test from Phase 1 will fail otherwise).
- **Hand-off to Phase 3 (RUN-02):** record in the phase SUMMARY and in a "Webhook events" note in `.planning/phases/02-observability-and-regression-guards/deferred-items.md` that `payment_intent.payment_failed` is handled (telemetry only) and remains subscribed, so Phase 3 updates the two docs without re-deriving.

### Regression Tests (OBS-03, OBS-04)
- **Both slug pages type `params` as `Promise<{ slug: string }>` and `await` it.** The category page calls `notFound()` for a missing category (replacing the 200 "Category not found" div), matching the product page. Also remove the `products: any[]` and `catch (e: any)` escapes in the category page while there. No other behavior changes.
- **404 tests are module-import unit tests** in `tests/unit/app/`: mock the data layer (`getCategoryBySlug`, `getProductBySlug`, and whatever else the page imports), call the default export with an unknown slug, and assert Next's `notFound()` sentinel is thrown. Mirror the mocking style of the existing `tests/unit/app/*.test.ts` files.
- **Export `allocateDiscount` and `allocateLargestRemainder`** from `lib/services/checkout-pricing.ts` so tests can call them directly. Two-line change; do not move them to a new module.
- **Allocation tests are deterministic tables**, no new dependency: for each of 1, 2, 10, and 100 lines, fixed weight sets and totals asserting `sum(parts) === total`, plus penny edge cases (odd remainders, a zero-weight line, a single line, total smaller than line count). Add to `tests/unit/lib/services/checkout-pricing.test.ts` or a sibling file.

### Lighthouse Baseline (MOB-01)
- **Measure with `npx lighthouse --preset=... --form-factor=mobile`** (mobile emulation, default mobile throttling) against the live site `https://voltique.russellkmoore.me`, driven by the executor using the local Google Chrome (`/Applications/Google Chrome.app`). No dependency is added to `package.json`.
- **Four URLs:** `/`, the first active category and the first active product discovered from the live sitemap (`/sitemap.xml`), and `/checkout`. Record the exact slugs used.
- **Output is one markdown file** `docs/mobile-lighthouse-baseline.md`: date, Lighthouse and Chrome versions, per-route table of performance score, LCP, CLS, TBT, and a pass/fail column against the PRD target (>= 85; note 90+ as the stretch). No JSON report blobs committed. Tick the measurement items in `docs/mobile-improvements-actionable.md` only if that doc's checklist is in this phase's file list; otherwise leave for REF-04.
- **Three runs per route, report the median.** If the checkout route redirects (empty cart), record what was actually measured.

### Claude's Discretion
- Exact binding/dataset names, AE column mapping, the route-template mapper's implementation, the telemetry field names beyond those specified, test file names, and the Lighthouse invocation flags.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/observability/telemetry.ts` — `recordTelemetry(event, fields, error?)`, `TELEMETRY_EVENTS` registry (severity + sampleRate), `ALLOWED_FIELD_ENUMS` (exported since Phase 1), `sanitizeTelemetryFields`. Mirror any new enum values in `workers/observability-tail/src/core.ts` `ENUM_FIELDS` (parity test in `tests/unit/workers/observability-tail-core.test.ts`).
- `tests/unit/observability/instrumentation-source.test.ts` — AST contract: files calling `recordTelemetry` must not have `console.error(label, error)` catch blocks; new events must be registered.
- `app/api/webhooks/stripe/route.ts` — `handlePaymentFailed` at ~line 344 already has the telemetry-in-catch pattern to follow; the switch case is at ~line 218.
- `lib/services/checkout-pricing.ts` — fallback branch at ~line 700-725 (`taxSource = 'configured_fallback'`); `allocateDiscount` (~line 252) and `allocateLargestRemainder` (~line 451) are module-private today.
- `app/api/analytics/vitals/route.ts` — current beacon route (logs in non-production, returns `{ status: "ok" }`).
- `app/product/[slug]/page.tsx` (`{ params }: any` at ~line 60, already uses `notFound()`), `app/category/[slug]/page.tsx` (`{ params }: any` at ~line 52, renders a div on miss). `notFound()` is also used in `app/blog/[slug]/page.tsx` and `app/order-status/[id]/page.tsx`.
- `tests/unit/app/` — existing page/route tests to mirror for mocking style.
- Phase 1 pattern: `lib/auth/deployment-guard.ts` shows a small module owning its own `recordTelemetry` call with low-cardinality fields.

### Established Patterns
- Closed telemetry taxonomy; low-cardinality fields only; denial/degradation as return values, not throws.
- Bindings live in `wrangler.jsonc`; adding one requires `cf-typegen` and possibly `scripts/check-deploy-config.mjs`; `cf-typecheck` is authoritative in CI, not locally (`.env.local` effect).
- Tests: vitest, `vi.mock` for modules, `vi.stubEnv`; CI runs unit, workers, and observability suites plus lint, typecheck, cf-typecheck, build.
- Node 24 via mise (`mise exec -- …`).

### Integration Points
- `wrangler.jsonc` (new AE binding), `cloudflare-env.d.ts` (regenerated), `scripts/check-deploy-config.mjs` (if it validates bindings), `app/api/analytics/vitals/route.ts`, `lib/observability/telemetry.ts` + tail worker `core.ts`, `lib/services/checkout-pricing.ts`, `app/api/webhooks/stripe/route.ts`, the two slug pages, `tests/unit/**`, `docs/mobile-lighthouse-baseline.md`.
- Live site for Lighthouse: `https://voltique.russellkmoore.me`; sitemap at `/sitemap.xml`.

</code_context>

<specifics>
## Specific Ideas

- The Analytics Engine write must be fire-and-forget from the beacon's perspective; the route's 200 must not depend on it.
- Keep every new telemetry field on an allow-list; the tail worker's `sanitizeFields` silently drops unknown fields (Phase 1 WR-05 lesson).
- Lighthouse runs hit production; keep to the four routes and three runs each, no crawling.

</specifics>

<deferred>
## Deferred Ideas

- Property-based allocation tests with `fast-check` (offered, not chosen; deterministic tables instead).
- Bounded D1 table as the vitals sink with a retention cron (offered, not chosen).
- Removing the `payment_intent.payment_failed` subscription entirely (offered, not chosen; handled as telemetry).
- Committing raw Lighthouse JSON reports (offered, not chosen).

</deferred>
