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
| (filled by planner) | | | OBS-01 | — | `checkout.tax_fallback` fires on provider failure only; low-cardinality fields | unit | `npx vitest run tests/unit/lib/services/checkout-pricing.test.ts tests/unit/observability/instrumentation-source.test.ts` | ✅ extend | ⬜ pending |
| (filled by planner) | | | OBS-02 | — | Vitals route writes exactly five fields to Analytics Engine; missing binding → 200 + one warning event | unit | `npx vitest run tests/unit/app/vitals-route.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | OBS-03 | — | Typed `params`; unknown slug → `notFound()` on both pages | unit | `npx vitest run tests/unit/app/product-slug-page.test.ts tests/unit/app/category-slug-page.test.ts` | ❌ W0 | ⬜ pending |
| (filled by planner) | | | OBS-04 | — | `allocateDiscount` / `allocateLargestRemainder` parts sum exactly across 1, 2, 10, 100 lines and penny edge cases | unit | `npx vitest run tests/unit/lib/services/checkout-pricing.test.ts` | ✅ extend | ⬜ pending |
| (filled by planner) | | | OBS-05 | — | `handlePaymentFailed` emits `payment.intent_failed` with allowlisted `reason`; no order-state write | unit | `npx vitest run tests/unit/app/webhook-stripe-payment-failed.test.ts` (or existing stripe webhook test file) | ❌ W0 (check for an existing file first) | ⬜ pending |
| (filled by planner) | | | OBS-01/05 | — | New enum values mirrored in the tail worker | unit | `npx vitest run tests/unit/workers/observability-tail-core.test.ts` | ✅ exists | ⬜ pending |
| (filled by planner) | | | MOB-01 | — | Baseline recorded for 4 routes, median of 3, compared to 85 | scripted CLI | `test -f docs/mobile-lighthouse-baseline.md && grep -c "^| /" docs/mobile-lighthouse-baseline.md` prints 4 | N/A (doc) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/app/vitals-route.test.ts` — OBS-02 (verify no existing test covers this route under another name)
- [ ] `tests/unit/app/product-slug-page.test.ts` — OBS-03 (mirror `tests/unit/app/order-status-page.test.ts` mocking of `next/navigation`)
- [ ] `tests/unit/app/category-slug-page.test.ts` — OBS-03
- [ ] `tests/unit/app/webhook-stripe-payment-failed.test.ts` or extension of an existing stripe webhook test — OBS-05 (`find tests/unit -iname "*webhook*stripe*"` first)
- [ ] Taxonomy entries (`checkout.tax_fallback`, `payment.intent_failed`, `reason` enum) in `lib/observability/telemetry.ts` AND `workers/observability-tail/src/core.ts` before any test references them

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse mobile baseline against the live site | MOB-01 | Needs local Chrome and network; results vary run to run | `npx lighthouse <url> --form-factor=mobile --output=json --chrome-flags="--headless"` three times per route; record the median score, LCP, CLS, TBT in `docs/mobile-lighthouse-baseline.md` |
| Analytics Engine rows visible after deploy | OBS-02 | Requires a production deploy and real traffic | After deploy, query the dataset via the Cloudflare SQL API or dashboard and confirm rows carry the five fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
