---
phase: 18-tech-debt-closure
plan: 02
subsystem: checkout
tags: [documentation, testing, digital-only, gift-cards, DEBT-05]

# Dependency graph
requires:
  - phase: 18-tech-debt-closure
    provides: "18-CONTEXT.md D-05 decision — documented equivalence, not literal code sharing"
provides:
  - "Cross-reference doc comments pinning lib/checkout/digital-only.ts's isDigitalOnlyCart to lib/gift-cards/checkout.ts's hasPhysicalCheckoutLines"
  - "A hardened invariant test that fails if either cross-reference comment is removed or the fixture list is hollowed out"
affects: [checkout, gift-cards]

# Actuals (#2632)
actuals:
  tokens: 1800
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-contract test pattern (readFileSync + toContain) reused from tests/unit/components/cart-line-source.test.ts to pin doc-comment cross-references"

key-files:
  created: []
  modified:
    - lib/checkout/digital-only.ts
    - lib/gift-cards/checkout.ts
    - tests/unit/lib/checkout/digital-only.test.ts

key-decisions:
  - "Documented equivalence, not literal code sharing — plumbing fulfillment_type onto the client CartItem stays a Deferred Idea (D-05); this plan only makes the existing pin discoverable and unremovable-without-noise."
  - "Cross-reference comments live as prose only — lib/checkout/digital-only.ts (client) gained no import of lib/gift-cards/checkout.ts, preserving the client bundle's type graph."

patterns-established:
  - "Pin an invariant with two guards: a cardinality floor on the fixture list (catches silent hollowing) plus a source-contract test on both sides of the pin (catches comment removal)."

requirements-completed: [DEBT-05]

coverage:
  - id: D1
    description: "lib/checkout/digital-only.ts's isDigitalOnlyCart carries a doc comment naming hasPhysicalCheckoutLines, the equivalence it must hold, why the two signals differ, and the exact path to the invariant test."
    requirement: "DEBT-05"
    verification:
      - kind: unit
        ref: "tests/unit/lib/checkout/digital-only.test.ts#cross-reference source contract (D-05) > lib/checkout/digital-only.ts names the invariant test and the server-side predicate"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/gift-cards/checkout.ts's hasPhysicalCheckoutLines carries a matching doc comment naming isDigitalOnlyCart, the equivalence, and its own authoritative-server-signal role (consumed by app/api/payment-intent/route.ts)."
    requirement: "DEBT-05"
    verification:
      - kind: unit
        ref: "tests/unit/lib/checkout/digital-only.test.ts#cross-reference source contract (D-05) > lib/gift-cards/checkout.ts names the invariant test and the client-side predicate"
        status: pass
    human_judgment: false
  - id: D3
    description: "The invariant test fails if the fixture list is hollowed below the coverage floor (4 non-empty-cart fixtures, both expected outcomes present)."
    requirement: "DEBT-05"
    verification:
      - kind: unit
        ref: "tests/unit/lib/checkout/digital-only.test.ts#paired invariant against hasPhysicalCheckoutLines > the fixture list has not been hollowed out below the pinned floor"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neither predicate's runtime behaviour changed — the diff across both source files is comment text only."
    requirement: "DEBT-05"
    verification:
      - kind: other
        ref: "git diff cd28a11..fe90ae6 -- lib/checkout/digital-only.ts lib/gift-cards/checkout.ts (non-comment added/removed lines: 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-11
status: complete
---

# Phase 18 Plan 02: Digital-Only Predicate Cross-Reference Summary

**Doc-comment cross-references pin `isDigitalOnlyCart` and `hasPhysicalCheckoutLines` to each other and to the invariant test that proves their equivalence, with a hardened test that fails if either pin disappears.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-11T11:44:00Z
- **Completed:** 2026-09-11T11:56:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `lib/checkout/digital-only.ts`'s `isDigitalOnlyCart` now carries a JSDoc block naming `hasPhysicalCheckoutLines` (module path included), stating the required equivalence, explaining why the two signals read different fields, and pointing at `tests/unit/lib/checkout/digital-only.test.ts` as the enforcement mechanism.
- `lib/gift-cards/checkout.ts`'s `hasPhysicalCheckoutLines` carries the matching comment, plus a note on its authoritative server-side role (consumed by `app/api/payment-intent/route.ts` to decide whether to persist a shipping address).
- The invariant test in `tests/unit/lib/checkout/digital-only.test.ts` gained two guards: a cardinality assertion (fixture list pinned at a floor of **4** non-empty-cart fixtures, current count is exactly 4, covering both `true` and `false` outcomes) and a new `cross-reference source contract (D-05)` describe block that `readFileSync`s both predicate files and asserts each still contains the other's name and the test's own path.
- No executable line changed in either predicate — confirmed via `git diff <task-1-sha>^..<task-1-sha>` filtered to non-comment lines (zero results).

## Task Commits

Each task was committed atomically:

1. **Task 1: Each digital-only predicate names the other and the test that binds them** - `73ace3c` (docs)
2. **Task 2: The invariant test refuses to be quietly emptied** - `fe90ae6` (test)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified
- `lib/checkout/digital-only.ts` - JSDoc above `isDigitalOnlyCart` cross-referencing `hasPhysicalCheckoutLines` and the invariant test
- `lib/gift-cards/checkout.ts` - JSDoc above `hasPhysicalCheckoutLines` cross-referencing `isDigitalOnlyCart`, the invariant test, and its authoritative-server-signal role
- `tests/unit/lib/checkout/digital-only.test.ts` - cardinality guard (`MIN_NON_EMPTY_CART_FIXTURES = 4`) and a new source-contract describe block

## Decisions Made
- Kept the pin as prose-only cross-reference, per D-05: `lib/checkout/digital-only.ts` (client-side) gained no import of `lib/gift-cards/checkout.ts` — an import would pull the gift-card module into the client bundle's type graph, which the plan explicitly forbids.
- Literal single-function sharing (plumbing `fulfillment_type` onto the client `CartItem`) remains a Deferred Idea (D-05) — out of scope for this tech-debt closure plan; not attempted here.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DEBT-05 closed. `hasPhysicalCheckoutLines` and `isDigitalOnlyCart` remain independently defined but are now mutually discoverable and pinned by a strengthened test.
- Ready for the next plan in Phase 18 (parallel plans 18-01, 18-03..18-06 running concurrently in the same checkout).

---
*Phase: 18-tech-debt-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED
- All key-files (lib/checkout/digital-only.ts, lib/gift-cards/checkout.ts, tests/unit/lib/checkout/digital-only.test.ts) found on disk.
- Both task commits (73ace3c, fe90ae6) found in git log.
