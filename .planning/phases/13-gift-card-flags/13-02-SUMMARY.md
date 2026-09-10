---
phase: 13-gift-card-flags
plan: 02
subsystem: catalog
tags: [gift-cards, feature-flags, vitest, next.js, mcp]

# Dependency graph
requires:
  - phase: 13-gift-card-flags (plan 01)
    provides: lib/gift-cards/visibility.ts — the shared GCF-01 visibility predicate
provides:
  - Nine public listing call sites (storefront pages, /api/products, Volt agent tools, recommendations, CMS product blocks) filtered through the shared gift-card visibility predicate
  - A route test pinning the admin-vs-public split on /api/products
  - A source-contract test that fails if any call site drifts to an inline check or the filter leaks into the shared model layer
affects: [13-08, 14-gift-card-admin]

actuals:
  tokens: 4900
  tasks: 3
  commits: 4
  # Measured via commit-message grep, not `git rev-list --count BASE..HEAD`: this
  # repo runs concurrent wave-2 executors (13-03/13-04/13-05) on one shared branch
  # (use_worktrees: false), so a linear BASE..HEAD range also contains their
  # interleaved commits. `git log --oneline --grep="(13-02)"` isolates this plan's
  # own 4 commits (3 task commits + this docs commit).
plan_head_before: caa3d8efd52a8b78372c623dbece8d0df9f52b96

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read commerce.features once per request/render with a synchronous getStoreConfig() call, then pass the two booleans into the shared predicate — never thread a new parameter through public function signatures"
    - "Filter after the status filter and before any slice/limit, so pagination totals and truncated grids (home page's slice(0, 3)) describe the post-filter set"

key-files:
  created:
    - tests/unit/lib/gift-cards/listing-call-sites-source.test.ts
  modified:
    - app/api/products/route.ts
    - app/page.tsx
    - app/category/[slug]/page.tsx
    - lib/recommendations/index.ts
    - lib/mcp/catalog.ts
    - lib/mcp/tools/search.ts
    - lib/mcp/tools/assess.ts
    - lib/mcp/tools/recommend.ts
    - lib/cms/page-products.ts
    - tests/unit/app/api/products-public.test.ts

key-decisions:
  - "app/api/products/route.ts gets its own filterByVisibility closure beside the existing filterByStatus, gated on !isAdmin, applied at the same three spots (category branch, allProducts total, page result) — matching 13-PATTERNS.md's composition shape exactly rather than merging the two filters into one"
  - "lib/cms/page-products.ts deletes hidden entries from the Map returned by getProductsBySlugs before the resolve loop reads it, rather than filtering the loop's output — keeps the try/catch's empty-map-on-failure behavior untouched and the loop body unchanged"
  - "lib/mcp/tools/recommend.ts reassigns `recommendations` once, in one place, after the four-branch assignment and before the budget filter — the five searchProducts-calling helper functions were not touched, per the plan's explicit prohibition"

patterns-established:
  - "Every public listing/agent/CMS call site imports filterListedProducts (or isPubliclyVisibleProduct for a Map) from lib/gift-cards/visibility rather than checking product.type inline — pinned by tests/unit/lib/gift-cards/listing-call-sites-source.test.ts"

requirements-completed: [GCF-01, GCF-03]

coverage:
  - id: D1
    description: "Anonymous caller to GET /api/products with sell off never sees the gift card; total counts only visible products"
    requirement: GCF-01
    verification:
      - kind: unit
        ref: "tests/unit/app/api/products-public.test.ts#public product endpoints > omits the gift card from an anonymous listing with sell off (GCF-01, GCF-03, D-14)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin caller to GET /api/products with sell off still sees the gift card, unaffected by the public filter"
    requirement: GCF-03
    verification:
      - kind: unit
        ref: "tests/unit/app/api/products-public.test.ts#public product endpoints > still returns the gift card to an authenticated admin with sell off (D-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Anonymous caller sees the gift card again with sell on (no behavior change from before this plan)"
    verification:
      - kind: unit
        ref: "tests/unit/app/api/products-public.test.ts#public product endpoints > returns the gift card to an anonymous caller with sell on"
        status: pass
    human_judgment: false
  - id: D4
    description: "All nine public call sites import the shared predicate; the model layer (lib/models/mach/products.ts) never re-implements or references it, so /admin/products and Phase 14 keep seeing the card"
    verification:
      - kind: unit
        ref: "tests/unit/lib/gift-cards/listing-call-sites-source.test.ts (10 cases: 9 per-site imports + 1 model-layer absence)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Home page, category page, Volt search/assess/recommend, catalog capabilities, and CMS product blocks all route through the shared predicate"
    verification:
      - kind: unit
        ref: "tests/unit/app/category-slug-page.test.ts, tests/unit/lib/mcp/*, tests/unit/lib/cms/page-products.test.ts, tests/unit/recommendations/* (all pre-existing suites, unchanged assertions, still green after the filter was inserted)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-10
status: complete
---

# Phase 13 Plan 02: Gift-Card Listing Filter Summary

**All nine public browse surfaces — /api/products, the home and category pages, Volt's search/assess/recommend tools, catalog capabilities, and CMS product blocks — now hide the gift card through one shared predicate when selling is off, while /admin/products keeps seeing it untouched.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-10T16:24:00Z (approx.)
- **Completed:** 2026-09-10T16:36:46Z
- **Tasks:** 3 of 3
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments

- `app/api/products/route.ts` gets a `filterByVisibility` closure that mirrors the existing `filterByStatus` shape, gated on `!isAdmin`, applied at the category branch, the `allProducts` total, and the `page` result. Admin's status-filtering and validation logic is untouched.
- `app/page.tsx` and `app/category/[slug]/page.tsx` filter before their `.map(toPublicProduct)` step — critically, before the home page's `.slice(0, 3)`, so a hidden gift card can't silently shrink the featured grid to two cards.
- `lib/recommendations/index.ts` filters the catalog once at its source (`listProducts` result), which covers both the provider call and `blendRecommendations` together.
- `lib/mcp/catalog.ts`, `lib/mcp/tools/search.ts`, `lib/mcp/tools/assess.ts` and `lib/mcp/tools/recommend.ts` each wrap their existing active-status filter (or, for `recommend.ts`, the four-branch `recommendations` assignment) in the shared predicate, so Volt search, fulfillment assessment, and recommendations can never surface or credit a hidden gift card.
- `lib/cms/page-products.ts` drops any resolved product failing the predicate from the `getProductsBySlugs` map before the render loop reads it — a page-builder block referencing the gift card by slug now resolves to nothing while selling is off (D-14, overriding 13-RESEARCH.md's open question 1).
- New `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts`: 9 cases confirm every call site imports from `lib/gift-cards/visibility`, plus 1 case confirms `lib/models/mach/products.ts` contains none of the predicate's export names (comment-stripped, so an inline doc comment can't fake a pass). Manually verified the model-layer case and a call-site case both fail when the corresponding filter is reverted, then restored the file.
- `tests/unit/app/api/products-public.test.ts` gains a `getStoreConfig` mock and three new cases: anonymous+sell-off (gift card absent, total 1), admin+sell-off (both present, total 2), anonymous+sell-on (both present, total 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Storefront listing surfaces** - `760541f` (feat)
2. **Task 2: Agent, recommendation and CMS surfaces** - `5e2c279` (feat)
3. **Task 3: Admin-versus-public listing tests** - `4922d5b` (test)

**Plan metadata:** commit for this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md (see final commit below).

## Files Created/Modified

- `app/api/products/route.ts` - added `filterByVisibility`, applied beside `filterByStatus` at all three points; admin branch unaffected
- `app/page.tsx` - `filterListedProducts` inserted before the slice-to-3
- `app/category/[slug]/page.tsx` - `filterListedProducts` inserted before `.map(toPublicProduct)`
- `lib/recommendations/index.ts` - `allProducts` wrapped in `filterListedProducts` at its source
- `lib/mcp/catalog.ts` - `publicProducts` wrapped in `filterListedProducts`
- `lib/mcp/tools/search.ts` - `filteredProducts` initial assignment wrapped
- `lib/mcp/tools/assess.ts` - each item's `searchProducts` result wrapped before `calculateConfidence`
- `lib/mcp/tools/recommend.ts` - one-line reassignment of `recommendations` after the four-branch selection, before the budget filter
- `lib/cms/page-products.ts` - hidden entries deleted from the resolved `Map` before the render loop
- `tests/unit/app/api/products-public.test.ts` - `getStoreConfig` mock + three new admin/public/sell-state cases
- `tests/unit/lib/gift-cards/listing-call-sites-source.test.ts` - new source-contract test

## Decisions Made

- Kept `filterByStatus` and the new `filterByVisibility` as two separate closures in `route.ts` rather than merging them — matches 13-PATTERNS.md's prescribed shape and keeps each closure's single responsibility legible.
- In `lib/cms/page-products.ts`, mutated the `Map` returned by `getProductsBySlugs` (delete-in-place) rather than building a second filtered map — the loop below reads `products.get(slug)`, so deleting hidden entries first makes a hidden slug resolve to `undefined` through the exact same code path an unknown slug already takes, with no new branch.
- Test helper `setGiftCardFeatures()` in `products-public.test.ts` defaults both flags to `true` so all six pre-existing cases keep passing with zero changes to their assertions.

## Deviations from Plan

None - plan executed exactly as written. All nine call sites, both new/extended test files, and the manual revert-and-confirm check for the source-contract test were completed per the plan's action and acceptance criteria.

## Issues Encountered

`mise exec -- npm test` showed transient failures from two other wave-2 executors' in-flight TDD RED states (`tests/unit/components/gift-card-unavailable-source.test.ts` for 13-03, `tests/unit/lib/gift-cards/honor-guard.test.ts` for 13-04) — both files sit outside this plan's `files_modified` list and outside `lib/gift-cards/visibility.ts`'s consumers. This repo runs wave-2 executors concurrently on one shared branch (`use_worktrees: false`), so a mid-flight `npm test` can catch a sibling plan between its RED and GREEN commits. Re-running `npm test` after 13-03 landed its GREEN commit confirmed its suite passed; 13-04's `honor-guard` suite was still RED at last check, a file this plan never touches. This plan's own scope — `npm run typecheck`, `npm run lint`, and every test file listed in this plan's `files_modified` plus the pre-existing suites for `lib/cms`, `lib/mcp`, `lib/recommendations`, and `app/category/[slug]` — all pass cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All nine public listing surfaces now hide the gift card correctly per GCF-01/GCF-03; `/admin/products` is unaffected, satisfying D-14 for the listing half of this phase.
- `lib/gift-cards/visibility.ts` now has proven consumers across storefront, agent, and CMS layers — plan 13-08 (or any later plan reusing the predicate) has working examples to follow for each shape (array filter, Map-entry filter).
- No blockers for the remaining wave-2/wave-3 plans in this phase.

---
*Phase: 13-gift-card-flags*
*Completed: 2026-09-10*

## Self-Check: PASSED

All 10 created/modified files and 3 task commit hashes (760541f, 5e2c279, 4922d5b) verified present on disk and in git log.
