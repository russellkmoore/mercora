---
phase: 02-observability-and-regression-guards
plan: 01
subsystem: observability
tags: [telemetry, checkout, tax, stripe, vitest]

requires:
  - phase: 01-security-and-admin-auth-truth
    provides: "commerce.telemetry.v1 closed-taxonomy producer and tail-worker parity contract"
provides:
  - "checkout.tax_fallback telemetry event, wired at the exact fallback call site"
  - "payment.intent_failed and analytics.vitals_sink_unavailable event registrations (taxonomy only, consumed by 02-03 and 02-02)"
  - "operation:'price', outcome:'degraded', and the reason enum field, mirrored in both parity files"
  - "allocateDiscount and allocateLargestRemainder exported for direct testing"
affects: [02-02, 02-03, 02-04]

actuals:
  tokens: 3122
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Telemetry event registration is always a same-commit dual-file edit (TELEMETRY_EVENTS/ALLOWED_FIELD_ENUMS + tail-worker ENUM_FIELDS), verified by the parity test before considering the change done"
    - "recordTelemetry calls at a degradation site pass only low-cardinality enum fields, never identifiers, and never accompany a console.error/warn(..., error) call in the same file (AST contract)"

key-files:
  created: []
  modified:
    - lib/observability/telemetry.ts
    - workers/observability-tail/src/core.ts
    - lib/services/checkout-pricing.ts
    - tests/unit/lib/services/checkout-pricing.test.ts

key-decisions:
  - "reason enum values placed alphabetically between provider and trigger in both ALLOWED_FIELD_ENUMS and ENUM_FIELDS, matching D-07's five-value list exactly as specified in 02-CONTEXT.md"
  - "analytics.vitals_sink_unavailable registered at sampleRate 0.01 (not 1) per plan rationale: a missing binding is a persistent condition on an unauthenticated high-volume beacon endpoint"

patterns-established:
  - "Fallback-branch telemetry test pattern: spy on console.warn, JSON.parse the first call argument, assert marker/event/severity/fields with toMatchObject, then assert no address/product/variant identifier appears in the serialized string"

requirements-completed: [OBS-01, OBS-04]

coverage:
  - id: D1
    description: "checkout.tax_fallback fires exactly once when Stripe Tax fails and the flat rate is applied, carrying no identifier"
    requirement: "OBS-01"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#emits a checkout.tax_fallback telemetry envelope when the tax provider fails"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#does not fire checkout.tax_fallback when the tax provider succeeds"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#fires checkout.tax_fallback exactly once per fallback priceCheckout call"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#fires checkout.tax_fallback exactly once for a multi-line fallback cart"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#carries no identifier from the pricing input in the checkout.tax_fallback envelope"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#carries no numeric field or error_class in the checkout.tax_fallback envelope"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/checkout-pricing.test.ts#leaves the fallback quote unchanged even when console.warn itself throws"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three new events, two new enum values, and the reason field are registered identically in lib/observability/telemetry.ts and workers/observability-tail/src/core.ts"
    requirement: "OBS-01"
    verification:
      - kind: unit
        ref: "tests/unit/workers/observability-tail-core.test.ts#mirrors ALLOWED_FIELD_ENUMS field-for-field and value-for-value"
        status: pass
      - kind: unit
        ref: "tests/unit/observability/instrumentation-source.test.ts (all three assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "allocateDiscount and allocateLargestRemainder are exported with unchanged signature and body"
    requirement: "OBS-04"
    verification:
      - kind: unit
        ref: "npm test (full suite, includes existing checkout-pricing.test.ts sum-exactness coverage)"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-02
status: complete
---

# Phase 2 Plan 1: Telemetry Foundation and Tax-Fallback Tracer Summary

**`checkout.tax_fallback` fires on every Stripe Tax degradation with zero identifiers, registered alongside two forward-looking events and a `reason` enum in both parity files, plus the two allocation functions exported for `02-04`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-02T19:16:01Z (approx, per STATE.md)
- **Completed:** 2026-09-02T19:41:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Registered `checkout.tax_fallback`, `payment.intent_failed`, and `analytics.vitals_sink_unavailable` in `TELEMETRY_EVENTS`, plus `operation:'price'`, `outcome:'degraded'`, and a five-value `reason` enum in `ALLOWED_FIELD_ENUMS` — mirrored byte-for-byte in the tail worker's `ENUM_FIELDS`.
- Wired `recordTelemetry('checkout.tax_fallback', ...)` at the exact line `lib/services/checkout-pricing.ts` sets `taxSource = 'configured_fallback'`, passing only `operation`/`outcome`/`provider` — no address, order, customer, product, or variant identifier.
- Added 7 tests proving the event fires once and only on the fallback branch (including a multi-line cart), carries no identifier and no numeric field, and cannot change the returned quote even when `console.warn` itself throws.
- Exported `allocateDiscount` and `allocateLargestRemainder` from `lib/services/checkout-pricing.ts` for plan `02-04`'s table tests, with zero behavior change.

## Task Commits

1. **Task 1: End-to-end — a Stripe Tax failure becomes a visible operator event** - `f50ef36` (feat)
2. **Task 2: Pin the negative case and the no-identifier contract** - `dd3345e` (test)
3. **Task 3: Export the two allocation functions for direct testing** - `3aa2c83` (refactor)

**Plan metadata:** commit follows this SUMMARY.

## Files Created/Modified
- `lib/observability/telemetry.ts` - Three new taxonomy events; `price`/`degraded` enum values; new `reason` enum field
- `workers/observability-tail/src/core.ts` - Byte-equal mirror of the same enum additions
- `lib/services/checkout-pricing.ts` - `recordTelemetry` call at the fallback site; `allocateDiscount`/`allocateLargestRemainder` exported
- `tests/unit/lib/services/checkout-pricing.test.ts` - 7 new tests covering fires-on-fallback, silent-on-success, exactly-once, no-identifier, no-numeric-field, and fail-open-on-hostile-console

## Decisions Made
- `reason` enum values placed alphabetically between `provider` and `trigger` in both parity files, matching D-07.
- `analytics.vitals_sink_unavailable` registered at `sampleRate: 0.01` per the plan's stated rationale (bounding log cost on an unauthenticated high-volume beacon endpoint); this event is not wired to a call site by this plan — `02-02` consumes it.
- `payment.intent_failed` is registered here (taxonomy only) so `02-03` never needs to touch these two parity files.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `02-02` (web-vitals sink) and `02-03` (failed-payment handler) can now call `recordTelemetry` with their pre-registered event keys without touching `lib/observability/telemetry.ts` or `workers/observability-tail/src/core.ts`.
- `02-04` can import `allocateDiscount`/`allocateLargestRemainder` by name from `@/lib/services/checkout-pricing` for its table tests.
- No blockers.

## Self-Check: PASSED

- `lib/observability/telemetry.ts` FOUND
- `workers/observability-tail/src/core.ts` FOUND
- `lib/services/checkout-pricing.ts` FOUND
- `tests/unit/lib/services/checkout-pricing.test.ts` FOUND
- Commit `f50ef36` FOUND in `git log --oneline --all`
- Commit `dd3345e` FOUND in `git log --oneline --all`
- Commit `3aa2c83` FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run and passing: targeted vitest (3 files, 45 tests), full `npm test` (235 files, 1739 tests), `npm run lint` (exit 0), `npm run typecheck` (exit 0), `git grep -c "checkout.tax_fallback"` matches both `lib/observability/telemetry.ts` and `lib/services/checkout-pricing.ts`.

---
*Phase: 02-observability-and-regression-guards*
*Completed: 2026-09-02*
