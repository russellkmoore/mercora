---
phase: 02-observability-and-regression-guards
fixed_at: 2026-09-02T13:10:00Z
review_path: .planning/phases/02-observability-and-regression-guards/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-09-02T13:10:00Z
**Source review:** .planning/phases/02-observability-and-regression-guards/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — CR-01, WR-01, WR-02, WR-03; IN-01 out of scope per constraints)
- Fixed: 4
- Skipped: 0

**Verification environment:** `workflow.use_worktrees` is `false` for this project, so all edits, test runs, lint, and typecheck below ran directly in the main checkout on branch `main` (no isolated worktree was created). Numbers are reproducible from the current `main` tree.

## Fixed Issues

### CR-01: `allocateDiscount` can assign a line more discount than the line is worth

**Files modified:** `lib/services/checkout-pricing.ts`, `tests/unit/lib/services/checkout-allocation.test.ts`
**Commit:** `2f4baa1`
**Applied fix:** Replaced the "last line gets the uncapped floor-rounding leftover" logic with: (1) compute every eligible line's share capped at its own `available[position]` capacity, including the last line; (2) redistribute any leftover from floor rounding across lines that still have spare capacity, in deterministic ascending-index order, one line at a time up to its remaining room. Invariant now holds: `sum(shares) === applied` and `shares[i] <= available[i]` for every `i`. Added the exact review reproduction (three 1-cent lines, 2-cent discount now yields `[1, 1, 0]`, never `[0, 0, 2]`) plus a per-line-capacity-invariant test across the existing 1/2/10/100-line weight tables. Ran the full `tests/unit/lib/services/` suite (142 tests, 8 files) — all pass, no existing sum-exactness expectations changed.
**Status note:** This is an algorithmic/logic fix (allocation math), not just a guard or detection change. Flagging as **fixed: requires human verification** — the new tests confirm the stated invariants across the existing weight tables and the review's exact reproduction case, but a human should confirm the redistribution order (ascending index) is the desired tie-breaking behavior for real promotion/discount scenarios before this ships.

### WR-01: Vitals endpoint has no request body size cap

**Files modified:** `app/api/analytics/vitals/route.ts`, `tests/unit/app/api/vitals-route.test.ts`
**Commit:** `fdf9a0f`
**Applied fix:** Added `readBoundedBody()` (4 KB cap via `content-length` header pre-check plus a bounded stream read that aborts and returns `null` if actual bytes exceed the cap) and routed `POST` through it before `JSON.parse`. Oversized or malformed bodies fall through to the existing uniform 200-with-no-write response path, preserving the locked always-200 decision. Added a test posting a ~5 KB body and asserting 200 with no `writeDataPoint` call. Full `tests/unit/app/api/vitals-route.test.ts` suite (22 tests) passes.

### WR-02: `mapDeclineReason` likely under-detects `expired_card` / `authentication_required` in real Stripe data

**Files modified:** `app/api/webhooks/stripe/handlers/decline-reason.ts`, `tests/unit/app/api/stripe-webhook-payment-failed.test.ts`
**Commit:** `b82b1c4`
**Applied fix:** Extended the `card_declined` refinement branch to check `decline_code` against `expired_card` and `authentication_required` in addition to the existing `insufficient_funds` check, falling back to `card_declined` only when none match. Output stays within the five-value closed enum. Added four tests covering `card_declined` + each of the three specific `decline_code` values, plus an unrecognized-`decline_code` case confirming the `card_declined` fallback. Full `tests/unit/app/api/stripe-webhook-payment-failed.test.ts` suite (14 tests) passes.

### WR-03: Dead catch branch in `handlePaymentFailed`

**Files modified:** `app/api/webhooks/stripe/route.ts`
**Commit:** `c970578`
**Applied fix:** Removed the unreachable `try/catch` around the `recordTelemetry`/`mapDeclineReason` calls (both are documented to never throw), matching how `mapDeclineReason` is called elsewhere without a wrapper, and added a comment noting why no try/catch is needed. Verified the AST instrumentation-source contract test still passes (`webhook.processing_failed` remains wired at two other call sites in the same file, `route.ts:272` and `route.ts:379`), and the full webhook test suite (payment-failed, signature, subscription, refunds, retry — 42 tests total) passes unchanged.

## Skipped Issues

None — all in-scope findings were fixed.

## Full Verification Run

- `mise exec -- npx vitest run tests/unit/lib/services tests/unit/app tests/unit/observability tests/unit/workers` — 75 files, 653 tests, all pass.
- `npm run lint` — 0 errors (52 pre-existing warnings in unrelated files: `hooks/useCartPersistence.ts`, `lib/hooks/useCartHydration.ts`, `lib/hooks/useEnhancedUserContext.ts`, `workers/observability-tail/worker-configuration.d.ts`; none touch the files modified by this fix pass).
- `npm run typecheck` — clean, no errors.
- `cf-typecheck` was not run locally per instructions (CI-only).

---

_Fixed: 2026-09-02T13:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
