---
phase: 02-observability-and-regression-guards
reviewed: 2026-09-02T20:13:19Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - lib/services/checkout-pricing.ts
  - tests/unit/lib/services/checkout-allocation.test.ts
  - tests/unit/lib/services/checkout-pricing.test.ts
  - app/api/analytics/vitals/route.ts
  - tests/unit/app/api/vitals-route.test.ts
  - app/api/webhooks/stripe/handlers/decline-reason.ts
  - app/api/webhooks/stripe/route.ts
  - tests/unit/app/api/stripe-webhook-payment-failed.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 02: Code Review Report (Iteration 2 — Fix Re-Review)

**Reviewed:** 2026-09-02T20:13:19Z
**Depth:** standard
**Files Reviewed:** 8 (iteration 2 re-read only the fixer's touched files, listed above — not the full 19-file iteration-1 scope)
**Status:** clean

## Summary

This is a re-review of iteration 1's fix pass (`.planning/phases/02-observability-and-regression-guards/02-REVIEW.iter2.md`), verifying commits `2f4baa1` (CR-01), `fdf9a0f` (WR-01), `b82b1c4` (WR-02), and `c970578` (WR-03) against the current tree.

**CR-01 (`allocateDiscount` per-line overrun):** Re-derived the fix mathematically and verified all four required invariants hold for *every* input, not just the tested cases:

- `parts[i] <= available[i]` for all `i` — proven: initial `shares[i] = min(capacity_i, floor(...))` is `<= capacity_i` by construction (and the `min` is provably a no-op here since `appliedMinor <= availableTotalMinor` always), and the redistribution loop only ever adds `take = min(room, remaining)` where `room = capacity_i - shares_i >= 0`, so the cap is never crossed.
- All parts are nonnegative integers — `floor()` of nonnegative operands, and `take` is bounded below by 0 in the loop.
- `sum(parts) === min(discount, sum(available))` — proven algebraically: total spare room across all lines after the initial floor pass is `(availableTotalMinor - appliedMinor) + remaining_initial`, which is always `>= remaining_initial` since `appliedMinor <= availableTotalMinor`. The single ascending pass therefore always fully exhausts `remaining` by the time it reaches the last line, so the sum invariant holds exactly, not just in the tested weight tables.
- Deterministic ascending-index redistribution — the loop iterates `position = 0..shares.length-1` in a fixed order with no randomness or object-key iteration; confirmed deterministic.

Ran an independent adversarial script (not part of the committed suite) directly against the exported `allocateDiscount`, covering: all-zero capacities, discount far exceeding total capacity, a single eligible line (both under- and over-capacity), 100 lines with an uneven, non-uniform weight pattern, partial pre-existing discounts on some lines, a mix of zero- and nonzero-capacity eligible lines, and the exact CR-01 repro from iteration 1. Every case satisfied the cap, nonnegativity, and sum invariants. Also re-ran the full `tests/unit/lib/services` and `tests/unit/app/api` suites (`mise exec -- npx vitest run tests/unit/lib/services tests/unit/app/api`): 48 files, 511 tests, all pass.

Also checked golden-value stability in `checkout-pricing.test.ts`: no test there exercises a multi-line percentage/fixed discount that produces a nonzero floor-rounding remainder across more than one eligible line, so none of the pre-existing expected quote values could have moved as a side effect of the CR-01 fix. Confirmed by inspection and by the full suite passing unchanged. See IN-02 below for one behavioral nuance worth being aware of even though it caused no test regression.

**WR-01 (vitals body size cap):** `readBoundedBody()` checks `content-length` up front (rejecting non-numeric, unsafe, or over-cap declared lengths) and separately bounds actual bytes read via a streaming reader that cancels once `MAX_VITALS_BODY_BYTES` (4096) is exceeded, before any `JSON.parse`. Oversized/malformed bodies fall through to the existing always-200/no-write path. Verified against `tests/unit/app/api/vitals-route.test.ts`, including the new oversized-body test; 200 and no `writeDataPoint` call are correctly asserted.

**WR-02 (`mapDeclineReason` decline_code refinement):** The `card_declined` branch now checks `decline_code` against `insufficient_funds`, `expired_card`, and `authentication_required` before falling back to the generic `card_declined` value, matching Stripe's real error shape. New tests cover all three specific `decline_code` values plus an unrecognized-`decline_code` fallback case. Verified against `tests/unit/app/api/stripe-webhook-payment-failed.test.ts`.

**WR-03 (dead catch in `handlePaymentFailed`):** The unreachable `try/catch` was removed and replaced with a comment documenting why (`recordTelemetry` fails open by contract, `mapDeclineReason` is total). Confirmed `webhook.processing_failed` telemetry remains correctly wired at the two other call sites in `route.ts` (the top-level POST catch and `handleCheckoutCompleted`), so removing this particular wrapper does not reduce observability coverage elsewhere in the file.

No regressions were introduced by any of the four fixes. All findings from iteration 1's Critical and Warning sections are resolved.

## Structural Findings (fallow)

None provided for this iteration.

## Narrative Findings (AI reviewer)

No Critical or Warning findings remain. Two Info-level notes below (one carried forward, one newly observed during CR-01 verification).

## Info

### IN-01: Inconsistent `notFound()` call style between the two updated pages (carried forward, out of scope this iteration)

**File:** `app/category/[slug]/page.tsx:62-64`

**Issue:** Carried forward unchanged from iteration 1 — this file is outside iteration 2's fix scope (`fix_scope: critical_warning`) and was not part of this iteration's file list, so it was not re-read. The category page still calls `notFound();` without `return`, while the product page changed in the same original diff uses `return notFound();`. Functionally equivalent today since `notFound()` throws, but fragile if code is ever added beneath the `if` block, or against a test double that doesn't throw.

**Fix:** `if (!category) { return notFound(); }` for consistency with the sibling file. Non-blocking; can be picked up in a future pass.

### IN-02: `allocateDiscount`'s floor-rounding remainder now lands on the first line(s) with room, not the last line

**File:** `lib/services/checkout-pricing.ts:270-282`

**Issue:** The CR-01 fix is correct and necessary, but it also changes *which* eligible line absorbs a nonzero floor-rounding remainder compared to the pre-fix algorithm, even in cases where the old algorithm never overflowed a line's capacity. Example verified directly against the function: three eligible lines each with 10 minor units of available capacity, discount of 10 minor units. Old algorithm (pre-CR-01): `[3, 3, 4]` (all rounding loss dumped on the last line). Current algorithm: `[4, 3, 3]` (loss distributed starting at the first line with spare room, ascending). Both are valid allocations — the sum, per-line-cap, and nonnegativity invariants hold either way, and no line's price is exceeded — so this is not a correctness bug. It is a genuine behavior change in which specific product line receives an extra cent (or a few cents, bounded by `eligible.length - 1`) of discount when a promotion doesn't divide evenly across eligible lines.

No test in `checkout-pricing.test.ts` or `checkout-allocation.test.ts` currently pins down *which* line receives the redistributed remainder (the new per-line-capacity test only asserts `<=`, and the sum-exactness tests only assert the total). This means a future refactor could silently change the redistribution order again (e.g., back to largest-remainder-first like `allocateLargestRemainder` uses) without any test catching the shift. Not blocking — no currently-shipped test value moved because none of the existing `checkout-pricing.test.ts` scenarios produce a multi-line remainder — but worth a small follow-up test to lock in the intended policy if the specific per-line cent assignment is ever product-relevant (e.g., for customer-facing discount receipts).

**Fix:** Optional. Add a test such as `allocateDiscount(Money.fromMinor(10), [0,1,2], [10,10,10 minor], zero)` asserting the exact `[4,3,3]` distribution, documenting that ascending-index-first is the intended (not incidental) redistribution policy.

---

_Reviewed: 2026-09-02T20:13:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2 (fix re-review)_
