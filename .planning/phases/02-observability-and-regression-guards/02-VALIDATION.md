---
phase: "2"
slug: "observability-and-regression-guards"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.mts` (unit), `vitest.workers.config.mts` (workers), `vitest.observability.config.mts` (observability-tail) |
| **Quick run command** | `npx vitest run tests/unit/lib/services/checkout-pricing.test.ts tests/unit/app tests/unit/observability tests/unit/workers` |
| **Full suite command** | `npm test && npm run test:workers && npm run test:observability-worker && npm run lint && npm run typecheck` |
| **Estimated runtime** | ~30 seconds quick, ~4 minutes full |

Project commands run under Node 24 via mise (`mise exec -- <command>`). `cf-typecheck` is authoritative in CI only; locally it fails while `.env.local` exists (Phase 1 finding).

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full CI parity green: `npm test`, `npm run test:workers`, `npm run test:observability-worker`, `npm run lint`, `npm run typecheck`, `npm run build`
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | OBS-01 | T-02-01, T-02-02 | Taxonomy registered in both parity files; `checkout.tax_fallback` fires on provider failure with three allow-listed enum fields | unit (tracer) | `npx vitest run tests/unit/lib/services/checkout-pricing.test.ts tests/unit/observability/instrumentation-source.test.ts tests/unit/workers/observability-tail-core.test.ts` | ✅ extend | ⬜ pending |
| 02-01-T2 | 02-01 | 1 | OBS-01 | T-02-01, T-02-05 | Silent on provider success; envelope carries no address, product, variant, or SKU value; a throwing console cannot change the price | unit | `npx vitest run tests/unit/lib/services/checkout-pricing.test.ts` | ✅ extend | ⬜ pending |
| 02-01-T3 | 02-01 | 1 | OBS-04 | — | `allocateDiscount` / `allocateLargestRemainder` exported with unchanged behavior | unit (suite) | `npm test && npm run lint && npm run typecheck` | ✅ exists | ⬜ pending |
| 02-02-T1 | 02-02 | 2 | OBS-02 | T-02-12 | `WEB_VITALS` binding declared; regenerated types carry no local secret variable name | scripted CLI | `test "$(git diff --numstat -- cloudflare-env.d.ts \| awk '{print $1}')" -lt 10` | N/A (config) | ⬜ pending |
| 02-02-T2 | 02-02 | 2 | OBS-02 | T-02-07, T-02-10 | Route-template output set is fixed, ASCII, and within the 96-byte Analytics Engine index cap; every unrecognized path falls into one bucket | unit | `npx vitest run tests/unit/lib/observability/route-template.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-T3 | 02-02 | 2 | OBS-02 | T-02-06, T-02-08, T-02-11, T-02-13 | Exactly five fields written; unknown metric, bad value, malformed body each drop with 200; missing binding emits one warning and returns 200 | unit | `npx vitest run tests/unit/app/api/vitals-route.test.ts tests/unit/lib/observability/route-template.test.ts tests/unit/observability/instrumentation-source.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-T1 | 02-03 | 2 | OBS-05 | T-02-15 | Every Stripe decline shape maps to one of five closed enum values; no raw Stripe string escapes | unit | `npx vitest run tests/unit/app/api/stripe-webhook-payment-failed.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-T2 | 02-03 | 2 | OBS-05 | T-02-14, T-02-16, T-02-18 | `payment.intent_failed` emitted with three fields and no identifier; zero state-changing calls; replay-safe; no placeholder marker remains | unit | `npx vitest run tests/unit/app/api/stripe-webhook-payment-failed.test.ts tests/unit/app/api/stripe-webhook-refunds.test.ts tests/unit/app/api/stripe-webhook-retry.test.ts tests/unit/observability/instrumentation-source.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-T3 | 02-03 | 2 | OBS-05 | — | RUN-02 hand-off recorded with the verified dispatch list; the two Phase 3 docs untouched | scripted CLI | `grep -q "payment_intent.payment_failed" .planning/phases/02-observability-and-regression-guards/deferred-items.md` | ❌ new | ⬜ pending |
| 02-04-T1 | 02-04 | 2 | OBS-03 | T-02-19, T-02-20 | Unknown, empty, and encoded category slugs return 404 via `notFound()`; no `any` and no synchronous params read remain | unit | `npx vitest run tests/unit/app/category-slug-page.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-T2 | 02-04 | 2 | OBS-03 | T-02-20 | Product page awaits Promise-typed params; unknown slug and non-active status both 404 | unit | `npx vitest run tests/unit/app/product-slug-page.test.ts tests/unit/app/category-slug-page.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-T3 | 02-04 | 2 | OBS-04 | T-02-21 | Allocated parts sum exactly across 1, 2, 10, 100 lines; penny remainders, zero weights, clamping, guards, and the ascending-index tie-break all pinned | unit | `npx vitest run tests/unit/lib/services/checkout-allocation.test.ts tests/unit/lib/services/checkout-pricing.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-T1 | 02-05 | 1 | MOB-01 | T-02-23, T-02-24 | Four URLs discovered from one sitemap fetch, three runs each, nothing written under a source or docs directory | scripted CLI | `git diff --quiet HEAD -- app lib tests docs scripts workers package.json wrangler.jsonc` | N/A (measurement) | ⬜ pending |
| 02-05-T2 | 02-05 | 1 | MOB-01 | T-02-25, T-02-26 | Four rows, median of three published alongside the raw spread, pass/fail against 85, checkout behavior recorded | scripted CLI | `test "$(grep -c '^\| /' docs/mobile-lighthouse-baseline.md)" -eq 4` | ❌ new | ⬜ pending |
| 02-01-T1 / 02-01-T2 | 02-01 | 1 | OBS-01, OBS-05 | T-02-02 | New enum values mirrored byte-for-byte in the tail worker | unit | `npx vitest run tests/unit/workers/observability-tail-core.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Note: `tests/unit/workers/observability-tail-core.test.ts` lives under `tests/unit/**` and therefore
runs under the default `vitest.config.mts`, not `vitest.observability.config.mts`. Run it with a
plain `npx vitest run <path>` — no `--config` flag. This matches the proven Phase 1 command.

---

## Wave 0 Requirements

Resolved at plan time. All four gaps are created inside the plan that first needs them, and the
taxonomy prerequisite is the phase tracer, so nothing references an unregistered event.

- [x] Taxonomy entries (`checkout.tax_fallback`, `payment.intent_failed`, `analytics.vitals_sink_unavailable`, the `reason` enum, and the new `operation: 'price'` / `outcome: 'degraded'` values) in `lib/observability/telemetry.ts` AND `workers/observability-tail/src/core.ts` — **plan `02-01` Task 1, the phase tracer, wave 1**. Every other plan depends on it.
- [x] `tests/unit/app/api/vitals-route.test.ts` — OBS-02, created by plan `02-02` Task 3. Confirmed at plan time that no existing test covers this route under any name (`find tests -iname '*vital*'` returned nothing).
- [x] `tests/unit/lib/observability/route-template.test.ts` — OBS-02, created by plan `02-02` Task 2 alongside the module it covers.
- [x] `tests/unit/app/category-slug-page.test.ts` and `tests/unit/app/product-slug-page.test.ts` — OBS-03, created by plan `02-04` Tasks 1 and 2, mirroring `tests/unit/app/order-status-page.test.ts`.
- [x] `tests/unit/app/api/stripe-webhook-payment-failed.test.ts` — OBS-05, created by plan `02-03` Task 2. Confirmed at plan time that the five existing Stripe webhook suites live in `tests/unit/app/api/` and none covers the payment-failed path, so the new file joins that directory rather than the one `02-RESEARCH.md` guessed at.
- [x] `tests/unit/lib/services/checkout-allocation.test.ts` — OBS-04, created by plan `02-04` Task 3, depending on the exports plan `02-01` Task 3 adds.
- [x] Framework install: none. Vitest is already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse mobile baseline against the live site | MOB-01 | Needs local Chrome and network; results vary run to run | `npx lighthouse <url> --form-factor=mobile --output=json --chrome-flags="--headless"` three times per route; record the median score, LCP, CLS, TBT in `docs/mobile-lighthouse-baseline.md` |
| Analytics Engine rows visible after deploy | OBS-02 | Requires a production deploy and real traffic | After deploy, query the dataset via the Cloudflare SQL API or dashboard and confirm rows carry the five fields |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 14 tasks across 5 plans, every one carrying at least one `<automated>` command with a `<fails_when>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has one
- [x] Wave 0 covers all MISSING references — all six gaps assigned to the plan that first needs them; the taxonomy prerequisite is the phase tracer
- [x] No watch-mode flags — every vitest invocation is `vitest run`
- [x] Feedback latency < 45s — the heaviest per-task command is a four-file targeted `vitest run`; the full `npm test` gate appears only at the end of `02-01`, `02-02`, `02-03`, and `02-04`
- [ ] `nyquist_compliant: true` set in frontmatter — set by `/gsd-validate-phase` after execution

**Approval:** plans authored 2026-09-02; per-task map filled. Awaiting execution.
