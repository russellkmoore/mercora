---
phase: 02-observability-and-regression-guards
plan: 04
subsystem: testing
tags: [nextjs, params, notfound, vitest, checkout, allocation, money]

requires:
  - phase: 02-observability-and-regression-guards
    provides: "allocateDiscount and allocateLargestRemainder exported from lib/services/checkout-pricing.ts (plan 02-01)"
provides:
  - "Real HTTP 404 on /category/<unknown> through Next's notFound() boundary, matching /product/<unknown>"
  - "Both slug pages typed with Promise<{ slug: string }> params, no any escapes on the category page"
  - "Deterministic sum-exactness coverage for allocateLargestRemainder and allocateDiscount at 1, 2, 10, and 100 lines"
affects: []

actuals:
  tokens: 9000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "notFound() called bare (no return) on a never-typed branch, matching app/order-status/[id]/page.tsx and the now-fixed app/product/[slug]/page.tsx"
    - "Module-import unit tests for server components: mock the data layer and next/navigation, call the default export directly with Promise.resolve({...}), assert on the mocked notFound sentinel via .rejects.toThrow"
    - "Deterministic allocation test tables: fixed uniform/ascending/awkward weight fixtures generated with Array.from, swept via it.each across 1/2/10/100 lines rather than four hand-written duplicates"

key-files:
  created:
    - tests/unit/app/category-slug-page.test.ts
    - tests/unit/app/product-slug-page.test.ts
    - tests/unit/lib/services/checkout-allocation.test.ts
  modified:
    - app/category/[slug]/page.tsx
    - app/product/[slug]/page.tsx

key-decisions:
  - "Product page diff kept to 3 added / 2 removed lines by collapsing the params type onto the function-signature line, satisfying the plan's byte-identical-behavior diff-size gate"
  - "Category and product page tests do not mock next/image, CategoryDisplay, ProductDisplay, or Breadcrumbs — verified empirically that importing (not invoking) these components under vitest's node environment causes no failure, so only the actual data-layer and next/navigation collaborators needed mocks"
  - "Tie-break test uses equal weights [5,5,5] against a non-divisible total (7) to force a genuine remainder tie, pinning the exact output array [3,2,2] rather than only its sum"

patterns-established: []

requirements-completed: [OBS-03, OBS-04]

coverage:
  - id: D1
    description: "An unknown /category/<slug> returns a real 404 through notFound() instead of a 200 sentinel div; existing categories render unchanged including the product-fetch error path"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "tests/unit/app/category-slug-page.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both slug pages type params as Promise<{ slug: string }> and await it; the category page carries no any/any[] and no synchronous params.slug read"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "grep gates in 02-04-PLAN.md Task 1/Task 2 <verify> blocks (Promise<{ slug: string }>, no `: any`/`any[]`, no `params.slug`)"
        status: pass
      - kind: unit
        ref: "tests/unit/app/product-slug-page.test.ts (7 tests, including a deferred-Promise test proving await is exercised)"
        status: pass
    human_judgment: false
  - id: D3
    description: "allocateLargestRemainder and allocateDiscount sum exactly to their total/applied amount across 1, 2, 10, and 100 lines, including penny remainders, zero-weight lines, clamping, partial eligibility, and a deterministic ascending-index tie-break"
    requirement: "OBS-04"
    verification:
      - kind: unit
        ref: "tests/unit/lib/services/checkout-allocation.test.ts (19 test blocks, 78 assertions total across the file's it/it.each expansion)"
        status: pass
      - kind: other
        ref: "npm test (241 files, 1854 tests), npm run lint, npm run typecheck"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-02
status: complete
---

# Phase 2 Plan 4: Slug-Page 404 Regression and Allocation Sum-Exactness Guards Summary

**Category page now 404s through Next's boundary instead of a 200 sentinel div, both slug pages share a `Promise<{ slug: string }>` params signature, and the tax/discount allocation functions are pinned by sum-exactness tables at 1, 2, 10, and 100 lines.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-02T19:56:57Z
- **Tasks:** 3
- **Files modified:** 5 (2 pages, 3 new test files)

## Accomplishments
- `app/category/[slug]/page.tsx`: `params` is now `Promise<{ slug: string }>` and awaited; an unknown category calls `notFound()` instead of rendering `<div>Category not found for slug: ...</div>`; `products: any[]` is now `Product[]`; `catch (e: any)` is now `catch (e)` with `instanceof Error` narrowing. The product-fetch error display and all other rendering are unchanged.
- `app/product/[slug]/page.tsx`: `params` typed `Promise<{ slug: string }>` and awaited before `getProductBySlug`; the existing `notFound()` guard (missing product or non-active status) is untouched. Diff is 3 added / 2 removed lines.
- Two new module-import unit test files (`tests/unit/app/category-slug-page.test.ts`, 9 tests; `tests/unit/app/product-slug-page.test.ts`, 7 tests) covering unknown slug, empty/whitespace/percent-encoded/mixed-case slug pass-through, the product-fetch-error path, active-product filtering, the non-active-status 404, and a deferred-Promise test proving the new signature is genuinely awaited.
- New `tests/unit/lib/services/checkout-allocation.test.ts` (19 `it`/`it.each` blocks) directly exercising the plan-02-01-exported `allocateLargestRemainder` and `allocateDiscount`: sum exactness across uniform/ascending/awkward weight tables at 1, 2, 10, and 100 lines; penny edge cases; a zero-weight line; a single line; zero total; five guard-throw cases; a zero-weight-total-and-zero-total case; an exact-array tie-break assertion; and `allocateDiscount`'s clamping, prior-discount, partial-eligibility, and no-input-mutation behavior.

## Task Commits

1. **Task 1: Category page — Promise params, a real 404, and no untyped escapes** - `e05dfc5` (feat)
2. **Task 2: Product page — Promise params with the 404 path pinned** - `c7cbb2a` (feat)
3. **Task 3: Deterministic allocation sum-exactness tables** - `894cfad` (test)

**Plan metadata:** commit follows this SUMMARY.

## Files Created/Modified
- `app/category/[slug]/page.tsx` - Promise-typed params, `notFound()` on category miss, typed products array, narrowed catch
- `app/product/[slug]/page.tsx` - Promise-typed params only; existing 404 branch untouched
- `tests/unit/app/category-slug-page.test.ts` - 9-case coverage of the category page's 404 and rendering paths
- `tests/unit/app/product-slug-page.test.ts` - 7-case coverage of the product page's two 404 conditions and the Promise-params contract
- `tests/unit/lib/services/checkout-allocation.test.ts` - Deterministic sum-exactness tables for both allocation functions at 1/2/10/100 lines

## Decisions Made
- Kept the product page's diff to 3 added / 2 removed lines by writing the params type inline on the function-signature line rather than a multi-line destructured type, satisfying the plan's `git diff --numstat` gate (at most 5 added, 3 removed) that guards against unintended behavior drift.
- Verified empirically (rather than assuming) that `next/image`, `CategoryDisplay`, `ProductDisplay`, and `Breadcrumbs` need no mocks under vitest's node environment when the page's default export is called directly — JSX element creation does not invoke child component bodies, so only the data-layer and `next/navigation` collaborators required `vi.mock`.
- Chose weights `[5, 5, 5]` against total `7` for the tie-break test because equal weights against a non-divisible total force a genuine three-way remainder tie, letting the test assert the exact output array `[3, 2, 2]` (extra units to the lowest indices) rather than only its sum.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OBS-03 and OBS-04 are both complete; this was the last plan in Phase 2 touching either requirement.
- Phase 2 (`02-observability-and-regression-guards`) has no remaining plans after this one.
- No blockers.

## Self-Check: PASSED

- `app/category/[slug]/page.tsx` FOUND
- `app/product/[slug]/page.tsx` FOUND
- `tests/unit/app/category-slug-page.test.ts` FOUND
- `tests/unit/app/product-slug-page.test.ts` FOUND
- `tests/unit/lib/services/checkout-allocation.test.ts` FOUND
- Commit `e05dfc5` FOUND in `git log --oneline --all`
- Commit `c7cbb2a` FOUND in `git log --oneline --all`
- Commit `894cfad` FOUND in `git log --oneline --all`
- All plan-level `<verification>` commands re-run and passing: targeted vitest across the 4 named files (94 tests), full `npm test` (241 files, 1854 tests), `npm run lint` (exit 0, 0 errors), `npm run typecheck` (exit 0), and `grep -c 'Promise<{ slug: string }>'` reports 1 for both pages.

---
*Phase: 02-observability-and-regression-guards*
*Completed: 2026-09-02*
