---
phase: 02-observability-and-regression-guards
verified: 2026-09-02T13:20:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "After the next production deploy, query the mercora_web_vitals Analytics Engine dataset (Cloudflare dashboard SQL API or `wrangler` query) and confirm rows exist carrying exactly the five fields (metric name, value, rating, route template, isMobile) grouped by route template and metric name for LCP, INP, and CLS."
    expected: "Rows are present for mobile traffic, queryable by route template and metric name, once real beacons have been sent against the deployed WEB_VITALS binding."
    why_human: "The WEB_VITALS Analytics Engine binding was added to wrangler.jsonc and cloudflare-env.d.ts in this phase, and the route was rewritten to write to it, but no deploy has occurred as part of this phase's execution (STATE.md shows no post-02-02 deploy record). Whether an operator can actually query real production rows cannot be observed from the repository alone — it depends on a live deploy and real traffic that has not yet happened."
---

# Phase 2: Observability and Regression Guards Verification Report

**Phase Goal:** The silent failure modes the codebase map found become visible to an operator, and the regressions it found have tests that would catch them if they came back.
**Verified:** 2026-09-02T13:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When Stripe Tax fails and the flat fallback rate is applied, an operator can see a `commerce.telemetry.v1` event whose payload contains no address/order identifier, and a test proves it fires only on fallback | ✓ VERIFIED | `lib/services/checkout-pricing.ts:719` calls `recordTelemetry('checkout.tax_fallback', { operation, outcome, provider })` inside the fallback `catch`; zero `console.` statements remain in the file; `tests/unit/lib/services/checkout-pricing.test.ts` contains 7 dedicated tests (fires-on-fallback, silent-on-success, exactly-once, multi-line, no-identifier, no-numeric-field, fail-open-on-hostile-console) — all pass in the full run |
| 2 | An operator can query mobile LCP, INP, and CLS by route template from real production traffic; the vitals route no longer returns `ok` while discarding the payload | ⚠️ Split — code verified, live query unverified | `WEB_VITALS` Analytics Engine binding declared in `wrangler.jsonc` and `cloudflare-env.d.ts`; `app/api/analytics/vitals/route.ts` validates, derives a bounded route template via `lib/observability/route-template.ts`, and calls `analytics.writeDataPoint({ blobs: [metricName, rating, routeTemplate, String(isMobile)], doubles: [value], indexes: [routeTemplate] })` — exactly the five fields, never awaited, always followed by `NextResponse.json({ status: "ok" })` on every path (42 tests across two files pass). Whether rows are actually queryable from real traffic requires a live deploy — see Human Verification |
| 3 | `/category/<unknown>` and `/product/<unknown>` return HTTP 404; both routes await `Promise`-typed `params`; tests cover the unknown-slug path; allocation tests fail if allocation ever stops summing to the total across 1, 2, 10, 100 lines | ✓ VERIFIED | Both pages declare `params: Promise<{ slug: string }>` and `await params`; category page's miss branch calls `notFound()` (no `params.slug` reads remain, no `: any`/`any[]` on the touched surface); `tests/unit/app/category-slug-page.test.ts` (9 tests) and `tests/unit/app/product-slug-page.test.ts` (7 tests) cover unknown/empty/whitespace/encoded slugs and the non-active-status 404; `tests/unit/lib/services/checkout-allocation.test.ts` (19 `it`/`it.each` blocks, incl. the CR-01-fixed per-line-capacity invariant) sums exactly at 1/2/10/100 lines — all pass |
| 4 | No `TODO` remains in `app/api/webhooks/stripe/route.ts`; `payment_intent.payment_failed` is either handled with a recorded outcome or unsubscribed, and the choice is written down for Phase 3 | ✓ VERIFIED | `grep -n TODO app/api/webhooks/stripe/route.ts` returns nothing; `handlePaymentFailed` emits `recordTelemetry('payment.intent_failed', { provider, outcome, reason: mapDeclineReason(...) })` and performs no state-changing call (confirmed by `awk`-scoped negative gate and by direct read); the dispatch `case 'payment_intent.payment_failed':` remains at line 219; `.planning/phases/02-observability-and-regression-guards/deferred-items.md` records the RUN-02 hand-off with the verified dispatch-switch event list |
| 5 | A Lighthouse mobile baseline for home/category/product/checkout is recorded in `docs/` with scores compared against 85 | ✓ VERIFIED | `docs/mobile-lighthouse-baseline.md` has exactly 4 table rows in fixed order, each reporting median-of-three Performance/LCP/CLS/TBT against the PRD target of 85 (all four fail: 72/72/80/73), the run-spread section, Lighthouse/Chrome versions, and the checkout empty-cart and sitemap-host-mismatch notes — matches the phase note that a below-target baseline is expected and correct |

**Score:** 6/6 must-haves verified (5 roadmap truths + the OBS-01 no-console/AST-contract detail folded into truth 1); 1 sub-item (live query of real traffic) routed to human verification per the task's own instruction.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/observability/telemetry.ts` | 3 new taxonomy events + `reason` enum | ✓ VERIFIED | `checkout.tax_fallback`, `payment.intent_failed`, `analytics.vitals_sink_unavailable` registered at lines 72-74; `reason` enum with 5 values present |
| `workers/observability-tail/src/core.ts` | Byte-equal enum mirror | ✓ VERIFIED | `card_declined`, `degraded`, `'price'` all present; parity test passes |
| `lib/services/checkout-pricing.ts` | Telemetry call + exported allocation functions | ✓ VERIFIED | One `recordTelemetry(` call, zero `console.` statements, `export function allocateDiscount`/`allocateLargestRemainder` present |
| `app/api/analytics/vitals/route.ts` | Rewritten route, 5-field write, always 200 | ✓ VERIFIED | `writeDataPoint` called once with 5 fields; every branch returns `NextResponse.json({ status: "ok" })`; `readBoundedBody()` (4KB cap) added post-review (WR-01) |
| `lib/observability/route-template.ts` | Pure bounded mapper | ✓ VERIFIED | Zero imports; exports `ROUTE_TEMPLATES`, `OTHER_ROUTE_TEMPLATE`, `toRouteTemplate`; 21 tests pass |
| `wrangler.jsonc` / `cloudflare-env.d.ts` | `WEB_VITALS` binding | ✓ VERIFIED | `analytics_engine_datasets` array with `WEB_VITALS`/`mercora_web_vitals`; `cloudflare-env.d.ts` declares `WEB_VITALS: AnalyticsEngineDataset` |
| `app/api/webhooks/stripe/handlers/decline-reason.ts` | Pure allow-list mapper | ✓ VERIFIED | Zero imports, total function, 5-value closed set; direct code read confirms all 10 plan-specified behaviors including refinement rule (post-WR-02 fix covers `expired_card`/`authentication_required`/`insufficient_funds`) |
| `app/api/webhooks/stripe/route.ts` | Telemetry-only `handlePaymentFailed`, no TODO | ✓ VERIFIED | Body is 3 lines: one `recordTelemetry` call, no writes, no try/catch (WR-03 dead-catch removal) |
| `app/category/[slug]/page.tsx` | Promise params, real 404, typed escapes | ✓ VERIFIED | `Promise<{ slug: string }>`, one `notFound()` call, `Product[]` typed products, narrowed `catch (e)`; pre-existing unrelated `primary_image as any` cast is untouched by this phase (confirmed via `git show e05dfc5`) |
| `app/product/[slug]/page.tsx` | Promise params only | ✓ VERIFIED | `Promise<{ slug: string }>`, existing `notFound()` branch unchanged, diff 3 added/2 removed lines |
| `docs/mobile-lighthouse-baseline.md` | 4-row baseline vs. target 85 | ✓ VERIFIED | 4 rows, median-of-3, Lighthouse/Chrome versions, run spread, notes |
| `.planning/phases/.../deferred-items.md` | RUN-02 hand-off | ✓ VERIFIED | Two `##` sections; names `payment_intent.payment_failed`, RUN-02, `tail_consumers`; neither Phase-3-owned doc modified |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `checkout-pricing.ts` | `telemetry.ts` | `recordTelemetry('checkout.tax_fallback'` at the fallback branch | ✓ WIRED |
| `workers/observability-tail/src/core.ts` | `telemetry.ts` | `ENUM_FIELDS` mirrors `ALLOWED_FIELD_ENUMS` | ✓ WIRED (parity test green) |
| `app/api/analytics/vitals/route.ts` | `route-template.ts` | `toRouteTemplate(metric.url)` before any write | ✓ WIRED |
| `app/api/analytics/vitals/route.ts` | `wrangler.jsonc` binding | `env.WEB_VITALS.writeDataPoint` | ✓ WIRED (structurally — no live traffic yet, see human verification) |
| `app/api/analytics/vitals/route.ts` | `telemetry.ts` | `recordTelemetry('analytics.vitals_sink_unavailable'` on missing binding | ✓ WIRED |
| `app/api/webhooks/stripe/route.ts` | `decline-reason.ts` | `mapDeclineReason(paymentIntent.last_payment_error)` | ✓ WIRED |
| `app/api/webhooks/stripe/route.ts` | `telemetry.ts` | `recordTelemetry('payment.intent_failed'` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `checkout.tax_fallback` envelope | `operation`/`outcome`/`provider` | Literal enum constants at the real fallback call site | Yes (fires only when `calculateTax` actually throws, proven by test) | ✓ FLOWING |
| `mercora_web_vitals` writeDataPoint call | `metricName`, `value`, `rating`, `routeTemplate`, `isMobile` | Parsed from the real request body, validated against allow-lists, never hardcoded | Yes, structurally (fire-and-forget, not awaited; no test can observe the AE row itself pre-deploy) | ⚠️ STATIC-UNTIL-DEPLOY (see human verification) |
| `payment.intent_failed` envelope | `reason` | `mapDeclineReason(paymentIntent.last_payment_error)`, a real Stripe payload field | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full observability/services/app/workers unit suite | `mise exec -- npx vitest run tests/unit/lib/services tests/unit/app tests/unit/observability tests/unit/workers tests/unit/lib/observability` | 77 files, 682 tests, all pass | ✓ PASS |
| Lint | `mise exec -- npm run lint` | 0 errors, 52 pre-existing warnings unrelated to phase-2 files | ✓ PASS |
| Typecheck | `mise exec -- npm run typecheck` | Clean, no errors | ✓ PASS |
| No debt markers in phase-modified files | `grep -nE 'TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER'` across all 9 phase-2-touched source files | No matches in any file | ✓ PASS |
| `checkout.tax_fallback` fires only on fallback | Direct test read + full suite pass | Confirmed by `tests/unit/lib/services/checkout-pricing.test.ts` | ✓ PASS |
| CR-01 allocation cap invariant | Direct code read of the post-fix `allocateDiscount` redistribution loop | `room = capacities[position] - shares[position]`, `take = min(room, remaining)` — cap provably never exceeded | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` probes and none are referenced in its PLAN/SUMMARY files. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| OBS-01 | 02-01 | Tax-fallback telemetry, closed taxonomy | ✓ SATISFIED | `checkout.tax_fallback` wired, tested, AST contract passes |
| OBS-02 | 02-02 | Web-vitals queryable sink | ✓ SATISFIED (code) / human-needed (live query) | Code, binding, tests all present; production query pending deploy |
| OBS-03 | 02-04 | Typed params, real 404s | ✓ SATISFIED | Both pages migrated, tests pass |
| OBS-04 | 02-01, 02-04 | Allocation sum-exactness tests | ✓ SATISFIED | 19-block table test at 1/2/10/100 lines, CR-01 cap fix verified |
| OBS-05 | 02-03 | Failed-payment telemetry, no TODO | ✓ SATISFIED | Telemetry-only handler, no state writes, TODO removed, RUN-02 hand-off recorded |
| MOB-01 | 02-05 | Lighthouse mobile baseline | ✓ SATISFIED | 4-route baseline recorded, all fail 85 as expected/documented |

No orphaned requirements: REQUIREMENTS.md's Phase 2 traceability table lists exactly OBS-01 through MOB-01, and all six appear in at least one plan's `requirements` frontmatter.

### Anti-Patterns Found

None blocking. `02-REVIEW.md` (iteration 2, post-fix) reports `status: clean`, 0 critical, 0 warning findings, with two Info-level items (both already assessed as non-blocking by the reviewer):
- IN-01: `notFound()` called without `return` in the category page (style inconsistency vs. the product page) — cosmetic, non-blocking.
- IN-02: `allocateDiscount`'s floor-rounding remainder now lands on ascending-index lines rather than the last line, post-CR-01 — a valid behavior change with no test pinning the exact redistribution order, flagged as optional follow-up, not a defect (sum/cap/nonnegativity invariants all hold).

One testing-thoroughness note (not a gap): `app/api/webhooks/stripe/handlers/decline-reason.ts` has no dedicated unit-test file — 6 of its 10 plan-specified behavior bullets (undefined/null/non-object input, non-string `code`, the negative refinement case) are verified only by direct code inspection (confirmed correct by this verifier) plus 6 route-level tests, matching the codebase's existing convention that handler modules under `app/api/webhooks/stripe/handlers/` are tested only through the route. The 02-03-SUMMARY.md self-flagged this as `human_judgment: true`. The implementation was read directly during this verification and is a straightforward total function; not escalated as a blocking or human-verification item.

## Human Verification Required

### 1. Operator can query mobile LCP/INP/CLS from real production traffic (OBS-02)

**Test:** After the next production deploy, send real traffic (or a manual beacon) to `/api/analytics/vitals`, then query the `mercora_web_vitals` Analytics Engine dataset via the Cloudflare dashboard or SQL API, grouping by route template and metric name.
**Expected:** Rows appear carrying exactly the five fields (metric name, value, rating, route template, isMobile), queryable for LCP, INP, and CLS by route.
**Why human:** This requires a live Cloudflare deploy and real traffic against the newly added `WEB_VITALS` binding — neither can be produced or observed from the repository. `02-VALIDATION.md`'s own "Manual-Only Verifications" section names this same check as pending. All code-level preconditions (binding declared, route rewritten, five-field write, fail-open on missing binding) are verified above.

## Gaps Summary

No blocking gaps. All 6 requirements (OBS-01 through OBS-05, MOB-01) are implemented, tested, and pass the full unit suite, lint, and typecheck. The code review cycle (`02-REVIEW.md` iteration 2) is clean with zero critical/warning findings after the CR-01/WR-01/WR-02/WR-03 fixes were applied and independently re-verified by the reviewer. The single outstanding item — confirming the Analytics Engine sink is queryable from real production traffic — is inherently unobservable pre-deploy and is routed to human verification rather than passed or failed silently, per this task's explicit instruction.

---

*Verified: 2026-09-02T13:20:00Z*
*Verifier: Claude (gsd-verifier)*

## Human Verification Resolution (2026-09-02)

The single `human_needed` item (rows visible in the `mercora_web_vitals` Analytics Engine dataset after a production deploy) was resolved by Russell's decision to accept the code-level evidence and track the post-deploy query as a follow-up in `.planning/STATE.md`. Binding, route rewrite, five-field envelope, always-200 behavior, and body cap are all verified in code and tests. Status set to `passed` on that basis.
