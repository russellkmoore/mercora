---
phase: 09-gift-card-catalogue
plan: 02
subsystem: testing
tags: [vitest, inventory, gift-card, mach, characterization-tests]

requires:
  - phase: 09-01
    provides: "prod_33 / variant_33..36 / price_33 seeded into data/d1/seed.sql with the exact untracked-inventory shape and txcd_00000000 tax code these tests pin"
provides:
  - "First-ever coverage for lib/inventory/availability.ts (tests/unit/lib/inventory/availability.test.ts, new directory and file)"
  - "Coverage proving a paid gift-card line is excluded from the inventory-decrement demand map, both alone and mixed with a physical line"
  - "Coverage proving toPublicProduct projects all four gift-card denominations as available_for_sale with unchanged minor-unit amounts, correct $ rendering, a checkout-regex-valid tax code, and continued cost/barcode/inventory stripping"
affects: [09-03, 09-04]

actuals:
  tokens: 2803
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Hand-written D1 fake (prepare/bind returning recorded args, batch resolving) injected via stagePaidInventoryAdjustments' options.database, exercising the real staging code path without vi.mock"

key-files:
  created:
    - tests/unit/lib/inventory/availability.test.ts
  modified:
    - tests/unit/lib/services/inventory-adjustments.test.ts
    - tests/unit/lib/models/mach/product-serializer.test.ts

key-decisions:
  - "Treated all three tasks as characterization tests over already-shipped, already-correct production code (isInventoryAvailable/isVariantAvailable, the aggregateOrderDemand gift-card skip, toPublicProduct) rather than literal TDD RED->GREEN->REFACTOR — every assertion passed on first run because the behavior under test already exists and is correct. Commits use test(09-02): per this plan's own commit contract; no feat(09-02) commit exists because no production code changed."
  - "Gift-card-only cases (stagePaidInventoryAdjustments, assertCheckoutInventoryAvailable) call the real function with no injected database at all, proving the skip by the absence of any D1 resolution rather than by mocking one away"
  - "Mixed-order case injects a hand-written fake database object (not vi.mock) so the assertion exercises stageInventoryAdjustments' real batch/prepare/bind call shape"
  - "giftCardFixture() mirrors the exact seeded literals (ids, skus, minor-unit amounts, txcd_00000000, {track_inventory: false}) rather than a convenient stand-in, so the test is a statement about the shipped seed row"

patterns-established: []

requirements-completed: [CAT-02, CAT-04]

coverage:
  - id: D1
    description: "isInventoryAvailable returns true for the exact seeded {track_inventory: false} shape (no quantity key), for undefined and null; isVariantAvailable returns true for active status, false for inactive status, true for null/absent status, all against that same seeded shape"
    requirement: "CAT-04"
    verification:
      - kind: unit
        ref: "tests/unit/lib/inventory/availability.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A gift-card-shaped OrderItem (fulfillment_type digital + gift_card object) is excluded from the paid-decrement demand map; a gift-card-only order resolves via stagePaidInventoryAdjustments without ever resolving a database"
    requirement: "CAT-04"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/inventory-adjustments.test.ts > paid-order gift-card skip > stages nothing and never resolves a database for a gift-card-only paid order"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/services/inventory-adjustments.test.ts > paid-order gift-card skip > identifies a gift-card order line only when the digital gift_card field is present"
        status: pass
    human_judgment: false
  - id: D3
    description: "A mixed order (one gift-card line + one physical line) stages exactly one adjustment, bound to the physical variant, via a hand-written D1 fake"
    requirement: "CAT-04"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/inventory-adjustments.test.ts > paid-order gift-card skip > stages exactly one adjustment for the physical line when a gift-card line and a physical line share an order"
        status: pass
    human_judgment: false
  - id: D4
    description: "toPublicProduct projects a four-variant gift-card fixture to four variants, all available_for_sale true, with minor-unit amounts 2500/5000/10000/20000 surviving unchanged and in order"
    requirement: "CAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/lib/models/mach/product-serializer.test.ts > gift-card denomination projection > projects all four denominations as available for sale"
        status: pass
      - kind: unit
        ref: "tests/unit/lib/models/mach/product-serializer.test.ts > gift-card denomination projection > carries the four minor-unit amounts through unchanged, in order"
        status: pass
    human_judgment: false
  - id: D5
    description: "Money.fromMinor renders the four amounts as $25.00, $50.00, $100.00, $200.00 -- the strings ProductDisplay puts beside each option value"
    requirement: "CAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/lib/models/mach/product-serializer.test.ts > gift-card denomination projection > renders the four amounts as the dollar strings shown beside each option value"
        status: pass
    human_judgment: false
  - id: D6
    description: "The seeded tax code txcd_00000000 satisfies /^txcd_\\d{8}$/, the same regex lib/services/checkout-pricing.ts applies, on every projected gift-card variant"
    requirement: "CAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/lib/models/mach/product-serializer.test.ts > gift-card denomination projection > keeps every projected variant tax code passing the checkout tax-code regex"
        status: pass
    human_judgment: false
  - id: D7
    description: "toPublicVariant still strips cost, barcode and inventory from the gift-card fixture, so the untracked-inventory shape does not leak to the client"
    requirement: "CAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/lib/models/mach/product-serializer.test.ts > gift-card denomination projection > strips cost, barcode and inventory from every gift-card variant"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-08
status: complete
plan_head_before: ea6bdf2
---

# Phase 9 Plan 02: Gift Card Test Coverage Summary

**Wrote 16 new unit tests (1 new file, 2 extended) pinning three already-shipped behaviors CAT-02/CAT-04 depend on: untracked gift-card inventory reads as available, a paid gift-card line never touches the inventory-decrement path, and the public product projection carries four correctly-priced, available-for-sale denominations.**

## Performance
- Duration: 12 min
- Completed: 2026-09-08
- Tasks: 3
- Files modified: 3 (1 created, 2 modified)

## Accomplishments
- Created `tests/unit/lib/inventory/availability.test.ts` (first coverage ever for `lib/inventory/availability.ts`), 6 tests pinning `isInventoryAvailable`, `isVariantAvailable`, and `canFulfillInventory` against the exact seeded `{"track_inventory": false}` object, including the active/inactive/null-status matrix.
- Extended `tests/unit/lib/services/inventory-adjustments.test.ts` with a `paid-order gift-card skip` describe block (4 new tests): `isGiftCardOrderLine` asserted both ways; a gift-card-only order stages nothing and never resolves a database; a mixed gift-card + physical order stages exactly one adjustment bound to the physical variant, via a hand-written D1 fake rather than `vi.mock`; `assertCheckoutInventoryAvailable` resolves for a gift-card-only item list without resolving a database.
- Extended `tests/unit/lib/models/mach/product-serializer.test.ts` with a `giftCardFixture()` helper (prod_33 / variant_33..36, mirroring the seeded literals exactly) and a `gift-card denomination projection` describe block (6 new tests): all four variants project `available_for_sale: true`; the four minor-unit amounts (2500/5000/10000/20000) survive unchanged and in order; `Money.fromMinor` renders them as `$25.00`/`$50.00`/`$100.00`/`$200.00`; the seeded `txcd_00000000` tax code passes the checkout regex on every variant; `cost`/`barcode`/`inventory` are still stripped; the product-level `type`/`fulfillment_type` survive the projection.
- Ran the full suite, lint, and typecheck after every task: 269 files / 2219 tests, 0 lint errors, clean typecheck. No production source file changed.

## Task Commits
1. **Task 1: New availability test file covering the seeded untracked-inventory shape** - `3ff6702` (test)
2. **Task 2: Prove a paid gift-card line never reaches the inventory decrement path** - `e02089b` (test)
3. **Task 3: Prove the public projection carries four available, correctly priced denominations** - `01ff3bd` (test)

## Files Created/Modified
- `tests/unit/lib/inventory/availability.test.ts` - new file, new directory; 6 tests for untracked gift-card inventory
- `tests/unit/lib/services/inventory-adjustments.test.ts` - added `paid-order gift-card skip` describe block, 4 tests (6 -> 10 total)
- `tests/unit/lib/models/mach/product-serializer.test.ts` - added `giftCardFixture()` and `gift-card denomination projection` describe block, 6 tests (3 -> 9 total)

## Decisions Made
- **Characterization tests, not literal TDD RED/GREEN.** All three tasks are `tdd="true"` in the plan, but every function under test (`isInventoryAvailable`, `isVariantAvailable`, `canFulfillInventory`, the `aggregateOrderDemand` gift-card skip, `toPublicProduct`/`toPublicVariant`) already shipped correctly with no gift-card coverage before this plan. Every assertion passed on the first run — there was no RED phase to intentionally fail on an assertion, because the behavior already exists. Per this plan's own guidance and 09-01's precedent, these are `test(09-02):` commits proving existing behavior, not `feat(09-02):` implementation commits. See "TDD Gate Compliance" below.
- **No database injected for either gift-card-only case.** `stagePaidInventoryAdjustments` and `assertCheckoutInventoryAvailable` both resolve a database only after the demand map is non-empty; a gift-card-only order/item-list never reaches that branch. Calling them with no `options.database` and asserting a clean resolve is itself the proof the skip fired — injecting a fake there would have hidden the very thing under test.
- **Mixed-order case uses a hand-written D1 fake, not `vi.mock`.** `stageInventoryAdjustments` accepts an optional `database` in its options bag; a plain object with `prepare`/`bind`/`batch` exercises the real staging code path end to end and lets the test assert on the actual bound arguments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 09-03 (Workers-AI-generated product image targeting `products/gift-card-33.png`) and 09-04 (production seed apply + `docs/DEPLOYMENT_SETUP.md` correction). No blockers. This plan touched only `tests/`; `lib/`, `app/`, `components/`, and `migrations/` are unchanged.

## TDD Gate Compliance

All three tasks are `tdd="true"` in the plan but target production code that already ships correctly (`lib/inventory/availability.ts`, the gift-card skip in `lib/services/inventory-adjustments.ts`, `lib/models/mach/product-serializer.ts`) with no prior gift-card test coverage. Writing each test and running it immediately produced a passing result — there is no assertion that could intentionally fail, because the behavior under test is not being introduced by this plan, only pinned. This mirrors 09-01's Task 2 precedent (a guard test over already-correct seed data). Per this plan's own `project_notes` guidance, these were executed as `type="auto"` characterization-test tasks with `test(09-02):` commits rather than forcing an artificial RED phase. `workflow.tdd_mode` is `false` for this project, so the orchestrator-side RED-commit gate does not apply; no `feat(09-02):` commit exists because no production source file changed in this plan (confirmed by `git status --porcelain lib/ app/ components/ migrations/` being empty after every task).

## Self-Check: PASSED

- `tests/unit/lib/inventory/availability.test.ts` - FOUND
- `tests/unit/lib/services/inventory-adjustments.test.ts` - FOUND (modified)
- `tests/unit/lib/models/mach/product-serializer.test.ts` - FOUND (modified)
- `git log --oneline --all | grep 3ff6702` - FOUND
- `git log --oneline --all | grep e02089b` - FOUND
- `git log --oneline --all | grep 01ff3bd` - FOUND
- `mise exec -- npx vitest run tests/unit/lib/inventory/availability.test.ts` - 6/6 passed
- `mise exec -- npx vitest run tests/unit/lib/services/inventory-adjustments.test.ts` - 10/10 passed
- `mise exec -- npx vitest run tests/unit/lib/models/mach/product-serializer.test.ts` - 9/9 passed
- `mise exec -- npm test` - 269 files / 2219 tests passed
- `mise exec -- npm run lint` - 0 errors (52 pre-existing, unrelated warnings)
- `mise exec -- npm run typecheck` - clean
- `git status --porcelain lib/ app/ components/ migrations/` - empty

---
*Phase: 09-gift-card-catalogue*
*Completed: 2026-09-08*
