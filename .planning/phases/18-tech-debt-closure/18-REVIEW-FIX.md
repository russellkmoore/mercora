---
phase: 18-tech-debt-closure
fixed_at: 2026-09-11T12:15:00Z
review_path: .planning/phases/18-tech-debt-closure/18-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-09-11T12:15:00Z
**Source review:** .planning/phases/18-tech-debt-closure/18-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (2 Warning, 2 Info)
- Fixed: 3 (both Warnings, one Info closed with a documenting test)
- Skipped: 1 (Info -- reviewer's own "no action required" conclusion re-verified against current code, confirmed rather than silently skipped)

| id | title | status | commit |
| --- | --- | --- | --- |
| WR-01 | Gift-card delivery telemetry carries no identifier | fixed | eac58eb |
| WR-02 | `isDigitalOnlyCart` misclassifies a flagged-only cart | fixed | 134ae6a |
| IN-01 | `order-effects-gift-card-env.test.ts` is a literal-string canary, not semantic | skipped: no action needed (confirmed) | -- |
| IN-02 | `cart-store.ts` line-merge can combine two different invalid gift notes | fixed (test added) | 5067f48 |

## Fixed Issues

### WR-01: Gift-card delivery telemetry carries no identifier

**Files modified:** `lib/observability/telemetry.ts`, `lib/services/gift-card-fulfillment.ts`, `tests/unit/lib/observability/telemetry.test.ts`, `tests/integration/lib/services/gift-card-fulfillment.test.ts`
**Commit:** eac58eb
**Applied fix:** Added one new non-enum field to the closed telemetry taxonomy —
`delivery_id` — validated by a new `boundedIdentifier` sanitizer (bounded
length, safe charset: letters/digits/underscore/hyphen only, no free text,
no PII possible). `recordDeliveryFailure` in `gift-card-fulfillment.ts` now
threads `claimed.id` (the `gift_card_deliveries.id` row) through all three
call sites — the code-material-missing terminal case, the post-send-failure
retry/terminal split, and the catch-block retry/terminal split — so both
`gift_card.delivery_retry` and `gift_card.delivery_failed` events carry it.
Updated the doc comment above `recordDeliveryFailure` (previously claimed
"deliberately no gift-card id" — no longer true). Updated the integration
test's terminal/retry-split assertions (`escalates a permanently failing
delivery...`, `records a single retryable send failure...`, `moves corrupted
retry material to review...`) to assert `fields.delivery_id` matches the
actual delivery row's id, and added a unit test in `telemetry.test.ts`
asserting `sanitizeTelemetryFields` accepts a well-formed id and rejects
free text, emails, oversized values, and non-strings.
**Verification:** Ran the full unit + integration suites for both files
(9 unit tests, 25 integration tests, all passing) and confirmed the
serialized envelope in a live drain run carries `delivery_id` for every
retry/terminal event, including the admin-issue prefix variant
(`gift_delivery_admin_...`).

### WR-02: `isDigitalOnlyCart` misclassifies a flagged-only cart

**Files modified:** `lib/checkout/digital-only.ts`, `tests/unit/lib/checkout/digital-only.test.ts`, `.planning/WINDOWS.md`
**Commit:** 134ae6a
**Applied fix:** Widened `isDigitalOnlyCart`'s predicate to treat
`giftCardNoteInvalid === true` the same as a present `giftCardCustomization`
— both mean "this is a gift-card/digital line" for classification purposes,
since checkout refuses a flagged line regardless of which client-side step
renders. Updated the function's doc comment to explain the two-signal OR
and reference the fix. Added a fifth fixture (`one flagged (invalid-note)
gift-card line`) to the paired-invariant test array, bumped the pinned
floor `MIN_NON_EMPTY_CART_FIXTURES` from 4 to 5, and added two direct unit
tests (flagged-line-true and a `giftCardNoteInvalid: false` control case).
Closed WINDOWS.md ledger entry 12 via `gsd-tools windows fixed 12`.
**Verification:** 17/17 tests pass in `digital-only.test.ts` (up from
11), including the strengthened paired-invariant loop against
`hasPhysicalCheckoutLines`. `npx tsc --noEmit` and `eslint` on the changed
files and `CheckoutClient.tsx` (the sole caller) are clean — the widened
parameter type is structurally compatible with `CartItem`, which already
carries `giftCardNoteInvalid?: boolean`.

### IN-02: `cart-store.ts` line-merge can combine two different invalid gift notes

**Files modified:** `tests/unit/lib/stores/cart-store-lines.test.ts`
**Commit:** 5067f48
**Applied fix:** No code change (the reviewer's own conclusion: "no action
required for correctness" — the original note text is unrecoverable
either way, so there is no data-loss consequence beyond what already
exists). Took the review's offered lighter-weight option and added a test
(`merges two different invalid gift notes for the same product/variant
into one flagged line (IN-02)`) that documents the merge is intentional and
will fail loudly if the behavior is ever silently changed in either
direction.
**Verification:** Confirmed the premise directly against current source —
`canonicalLineFacts` in `lib/gift-cards/line-identity.ts:34-42` omits
`giftCardCustomization` for a flagged line, reducing to
`[productId, variantId, null]`, so `sameCartLineFacts` (used by
`migrateCartState` in `lib/stores/cart-store.ts:396`) merges two flagged
lines for the same product/variant regardless of their (both-invalid, both
unrecoverable) note content. New test passes; full `cart-store-lines.test.ts`
suite (7/7) passes.

## Skipped Issues

### IN-01: `order-effects-gift-card-env.test.ts` is a literal-string canary, not semantic

**File:** `tests/unit/lib/services/order-effects-gift-card-env.test.ts:20-22`
**Reason:** No-action-needed, confirmed rather than silently skipped.
Re-read the test directly. It confirms exactly what the review found:
`expect(source).not.toContain('{ DB: runtime.database }')` is a
byte-identical reintroduction check, not an AST-based semantic guard. The
review's own Fix text is explicit — "No action required; noted for
awareness" — and calls the proposed TS-AST alternative "disproportionate
for a single-line guard." Nothing about the test or the surrounding code
has changed since the review; the conclusion holds unmodified. No code
or test change made.
**Original issue:** The test would catch a byte-identical reintroduction
of the removed `{ DB: runtime.database }` fallback expression, but not a
reformatted equivalent (different spacing, multi-line, or an added key).
This is an accepted, known limitation of a source-contract canary test,
not a defect.

## Verification Performed

- `npm run lint` → 0 errors, 54 pre-existing warnings (none in files
  touched by this fix pass; confirmed by targeted `eslint` runs on each
  changed file, which returned clean).
- `npm run typecheck` → clean, no errors.
- `mise exec -- npm test` → **2954/2954 tests passed, 322/322 files.**
- `mise exec -- npm run test:workers` → **255/255 tests passed, 33/33 files**
  (covers the D1-backed gift-card-fulfillment integration suite touched by
  WR-01).
- Targeted reruns during development: `telemetry.test.ts` (9/9),
  `gift-card-fulfillment.test.ts` integration (25/25), `digital-only.test.ts`
  (17/17), `cart-store-lines.test.ts` (7/7) — all passing before the full
  suite run above.

## FIX COMPLETE

- Fixed: 3 (WR-01, WR-02, IN-02)
- Skipped: 1 (IN-01 — no action needed, confirmed and documented, not silently dropped)
- Gates: lint clean (0 errors), typecheck clean, `npm test` 2954/2954 passed, `test:workers` 255/255 passed.

---

_Fixed: 2026-09-11T12:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
