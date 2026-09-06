---
phase: 05-token-contract-component-sweep
plan: 06
subsystem: ui
tags: [tailwind, tokens, product-card, category, product-detail, home, screenshot-diff]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end, the mechanism this plan substitutes class names against"
  - phase: 05-04
    provides: "components/ui/* primitives (card, badge, select, button) scan-clean; the CSS-specificity pitfall pattern (unconditional consumer override vs. a primitive's now-real data-state class), and the !important fix already applied to CategoryDisplay.tsx's sort-toggle active indicator, which this plan preserved"
  - phase: 05-05
    provides: "the shared shell (header, footer, breadcrumbs, promotional banner, root layout) scan-clean and screenshot-stable, the frame every later chunk's diff sits inside; chunk-2-shell full seven-route coverage as this plan's diff baseline"
provides:
  - "components/ProductCard.tsx, components/ProductRecommendations.tsx, app/category/[slug]/CategoryDisplay.tsx, app/category/[slug]/page.tsx, app/product/[slug]/ProductDisplay.tsx, app/product/[slug]/page.tsx, and app/page.tsx scan-clean against scripts/scan-hardcoded-colors.mjs"
  - "stock/availability badges mapped onto the status quartet by meaning (success=available, warning=coming-soon/unavailable) across ProductCard.tsx and ProductDisplay.tsx"
  - "chunk-3-catalog full coverage section in 05-SCREENSHOTS.md for the home, category, and product routes"
  - "a new registered shade-consolidation snap (S15) covering ProductCard.tsx's and ProductDisplay.tsx's card/gallery-well bg-neutral-800 -> bg-surface-elevated consolidation"
affects: [05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 8060
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-quartet badge mapping by meaning, not by nearest shade: ProductCard.tsx's and ProductDisplay.tsx's binary available/unavailable state maps to success/warning (not danger) because this codebase's only unavailable copy is 'Coming Soon'/'Currently unavailable' -- anticipatory/temporary language, not a discontinued-product signal -- reserving danger for a genuinely permanent out-of-stock state this app does not currently render"
    - "Literal-mapping precedence over role-reinterpretation when a phase has already established a pixel-identical no-op for the exact same class: app/page.tsx's and app/product/[slug]/page.tsx's bg-neutral-900 page wrapper was first (incorrectly) reinterpreted as page-background role (bg-surface, #000000) before Task 3's screenshot diff caught an ~83% pixel shift; corrected to bg-surface-elevated, matching 05-05's own documented no-op precedent for the identical class on app/layout.tsx's header fallback"
    - "PIL ImageChops.difference bbox + random-sample pixel-pair comparison (15-20 samples per capture) to confirm a large-area screenshot diff traces to a single root-cause value pair rather than being left as an unexplained percentage, reused and extended from 05-04/05-05's investigation method"

key-files:
  created: []
  modified:
    - components/ProductCard.tsx
    - components/ProductRecommendations.tsx
    - app/category/[slug]/CategoryDisplay.tsx
    - app/category/[slug]/page.tsx
    - app/product/[slug]/ProductDisplay.tsx
    - app/product/[slug]/page.tsx
    - app/page.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "ProductCard.tsx's and ProductDisplay.tsx's binary available/coming-soon state maps to success/warning, not success/danger -- this app's only unavailable copy ('Coming Soon', 'Currently unavailable') reads as anticipatory/temporary, and there is no 'discontinued' or true out-of-stock state anywhere in the storefront's copy to reserve danger for"
  - "Sale-price accents (ProductCard's and ProductDisplay's on-sale price text, 'On Sale'/'Limited-time offer' labels) map to primary, not success -- directed explicitly by this plan's own <interfaces> block ('prices, sale accents, links, and hover highlights are primary'), matching the brand-accent role rather than a positive-status role"
  - "components/ProductCard.tsx's neutral-700 image well maps to border-border, not bg-surface-elevated, preserving the exact pixel value (#404040, an exact match per 05-TOKEN-MAP.md's S2 snap) rather than the literal table's 'raised chip' alternative, which would have shifted the visible shade with no registered snap to cover it"
  - "app/page.tsx's and app/product/[slug]/page.tsx's page-wrapper bg-neutral-900 maps to bg-surface-elevated, not bg-surface -- corrected mid-plan (Rule 1) after Task 3's screenshot diff caught the initial bg-surface interpretation producing an unregistered ~83% full-page pixel shift; 05-05 already established bg-neutral-900 -> bg-surface-elevated as a pixel-identical no-op for the same literal class on app/layout.tsx's header fallback"
  - "ProductCard.tsx's and ProductDisplay.tsx's bg-neutral-800 card surface / gallery well (rgb(38,38,38)) consolidating onto bg-surface-elevated (rgb(23,23,23)) is a legitimate, table-directed shade consolidation, not a defect -- registered as new snap S15 after PIL-diffing all ten differing chunk-3-catalog cells back to this single root cause"

patterns-established:
  - "When two literal classes in the same substitution-table row (e.g. bg-neutral-900 and bg-neutral-800, both mapping to bg-surface-elevated) are used adjacently for genuinely distinct surfaces (a card vs. its own image well), prefer the pixel-exact alternative (border-border for the #404040 value) over the table's generic role label when the generic label would introduce an unregistered visible shift"

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "ProductCard.tsx and ProductRecommendations.tsx are scan-clean, use only main-set tokens, and stock/availability badges map to the status quartet by meaning (success=available, warning=coming-soon)"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/ProductCard.tsx / ProductRecommendations.tsx -> 0 violations each"
        status: pass
      - kind: other
        ref: "grep -c 'text-success\\|text-warning\\|text-danger\\|text-info' components/ProductCard.tsx -> 2 (at least two status tokens referenced)"
        status: pass
      - kind: other
        ref: "grep -cE '(bg|text|border)-(surface-inverse|on-inverse|muted-on-inverse|border-inverse)' components/ProductCard.tsx components/ProductRecommendations.tsx | grep -v ':0$' | wc -l -> 0"
        status: pass
      - kind: other
        ref: "git diff --name-only lib/utils/image-placeholders.ts -> empty (untouched)"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged; typecheck clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CategoryDisplay.tsx and app/category/[slug]/page.tsx are scan-clean; the sort-toggle's 05-04 !important fix is preserved with the new primary/on-primary tokens"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path app/category -> 0 violations"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "ProductDisplay.tsx, app/product/[slug]/page.tsx, and app/page.tsx are scan-clean; ProductDisplay.tsx's layout-affecting class count is unchanged (colour-only sweep); stock/shipping status text now takes the status quartet by meaning"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path app/product / app/page.tsx -> 0 violations each"
        status: pass
      - kind: other
        ref: "layout-affecting class census on ProductDisplay.tsx: 35 before, 35 after (git show HEAD vs. working tree at plan start) -> layout-stable"
        status: pass
      - kind: other
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed (matches 05-03/05-04/05-05's documented baseline); build/lint/typecheck clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "chunk-3-catalog full coverage (home, category, product; cart/checkout/account carried for completeness) captured and diffed cell-by-cell against chunk-2-shell; every one of the ten differing cells is root-caused to a single, expected shade consolidation (new snap S15) and no badge changed status meaning"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-3-catalog --allow-missing -> captured 22 cell(s), 4 missing (matches the pre-existing order-status gap)"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + 15-20 random differing-pixel samples per capture on all ten differing cells: every sample lands on rgb(38,38,38)->rgb(23,23,23) (or the same pair dimmed under the cart drawer's backdrop scrim, rgb(19,19,19)->rgb(11,11,11)), no content/layout/polarity change"
        status: pass
      - kind: manual_procedural
        ref: "visual side-by-side of product__1280__resting.png and category__1280__resting.png (chunk-3-catalog vs. chunk-2-shell): price, Add to Cart button, and 'In stock'/'Coming soon' text unchanged; 'In stock' reads success-green, unavailable reads warning-amber at both resolutions"
        status: pass
    human_judgment: true
    rationale: "I visually inspected the product and category resting captures at 1280px and confirmed the price, CTA, badge text, and badge colour family are unchanged to the eye. A human should still perform this plan's own human-check instruction -- a direct side-by-side of chunk-3-catalog vs. baseline product-route captures at both 1280px and 390px -- since a scripted pixel-pair sample plus a two-image spot check is not the same as a deliberate interactive QA pass across every captured cell."

# Metrics
duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 6: Catalogue Sweep (ProductCard, Category, Product Detail, Home) Summary

**The three routes a shopper actually browses -- home, category, and product detail -- along with the card components they share now speak only the 23-token contract, with stock badges remapped onto the status quartet by meaning and a full screenshot diff isolating every visible change to one traced, registered shade consolidation (S15).**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-04T15:07:00Z (approx.)
- **Completed:** 2026-09-04T15:42:00Z
- **Tasks:** 3 completed
- **Files modified:** 8 (7 source files, 1 screenshot manifest)

## Accomplishments

- Swept `ProductCard.tsx` (card surface, image well, name/description/rating text, sale price accent, and the "In Stock"/"Coming Soon" availability badge) and `ProductRecommendations.tsx` (section divider, heading chip) to main-set tokens. The availability badge maps to `success`/`warning` by meaning -- this codebase's only unavailable copy reads as anticipatory ("Coming Soon"), not discontinued, so `danger` is reserved for a state this storefront doesn't currently surface.
- Swept `CategoryDisplay.tsx`'s sort-toggle group (border, hover highlight, and the active-state `!important` override 05-04 already applied) and `app/category/[slug]/page.tsx`'s hero overlay, heading, description, and error text, all onto main-set tokens with the exact same border/primary/on-primary substitutions used elsewhere in this chunk.
- Swept `ProductDisplay.tsx` (the chunk's largest file: gallery well, thumbnail selection border, review/tab chrome, the variant `Select` overrides, price and sale-accent text, and the stock-status paragraph) and confirmed a before/after layout-affecting class census (grid/flex/gap/padding/margin/width/height/aspect classes) is unchanged at 35 -- the sweep touched colour only.
- Swept `app/product/[slug]/page.tsx` and `app/page.tsx`'s page wrappers and the home hero's description and CTA button. A first-pass reinterpretation of the page-wrapper `bg-neutral-900` as page-background role (`bg-surface`) was caught by Task 3's own screenshot diff as an unregistered ~83% full-page pixel shift and corrected to `bg-surface-elevated`, matching 05-05's already-documented pixel-identical mapping for the same literal class.
- Captured `chunk-3-catalog` (22/26 cells; the 4 `order-status` cells MISSING, matching the pre-existing baseline gap) and diffed every cell against `chunk-2-shell`. Ten cells differ, all traced with `PIL.ImageChops.difference` plus random pixel-pair sampling to a single root cause -- `ProductCard.tsx`'s and `ProductDisplay.tsx`'s `bg-neutral-800` card/gallery surfaces consolidating onto `bg-surface-elevated` (`rgb(38,38,38)` -> `rgb(23,23,23)`) -- and registered as a new snap, S15. The remaining differing cells (six `390 nav-open` rows, `account`, and one `checkout` cell) are byte-identical carry-forwards of the already-registered S13/S14 from `chunk-2-shell`; none of this chunk's files touch those routes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the catalogue cards and the category route** - `5bf392d` (feat)
2. **Task 2: Sweep the product detail template and the home route** - `0001a97` (feat)
3. **Mid-plan fix: page-wrapper bg-neutral-900 -> bg-surface-elevated, not bg-surface** - `d57ca70` (fix, Rule 1, found during Task 3's screenshot diff)
4. **Task 3: Prove the catalogue routes did not move** - `e0d8ed3` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/ProductCard.tsx` - card surface, image well, price/rating/description text, sale accent, and availability badge rewritten to main-set + status tokens
- `components/ProductRecommendations.tsx` - section divider and heading chip rewritten
- `app/category/[slug]/CategoryDisplay.tsx` - sort-toggle border, hover, and active state (preserving the 05-04 `!important` fix) rewritten; empty-state text rewritten
- `app/category/[slug]/page.tsx` - hero overlay, heading, description, and error text rewritten
- `app/product/[slug]/ProductDisplay.tsx` - gallery well, thumbnail selection state, review/tab chrome, variant `Select` overrides, price/sale text, and stock status text rewritten; layout-class census confirmed unchanged
- `app/product/[slug]/page.tsx` - page wrapper rewritten to `bg-surface-elevated`/`text-foreground`
- `app/page.tsx` - page wrapper, hero description, and CTA button rewritten
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-3-catalog` section (26 rows), new registered snap S15, and a coverage note explaining all ten differing cells

## Decisions Made

- Binary available/unavailable badges map to `success`/`warning`, not `success`/`danger` -- the app's only unavailable copy ("Coming Soon", "Currently unavailable") reads as temporary/anticipatory, and there's no discontinued-product state to reserve `danger` for.
- Sale-price accents map to `primary` (not `success`), per this plan's own `<interfaces>` guidance that prices and sale accents are a brand-accent role, not a positive-status role.
- `ProductCard.tsx`'s `bg-neutral-700` image well maps to `border-border` (an exact `#404040` pixel match) rather than the substitution table's generic `bg-surface-elevated` alternative, avoiding an unregistered shade shift.
- `app/page.tsx`'s and `app/product/[slug]/page.tsx`'s page-wrapper `bg-neutral-900` was corrected mid-plan from `bg-surface` to `bg-surface-elevated` after Task 3's screenshot diff caught the initial mapping as an unregistered ~83% pixel shift; 05-05 already established the pixel-identical mapping for the same literal class.
- The `bg-neutral-800` card-surface/gallery-well consolidation onto `bg-surface-elevated` was confirmed via pixel sampling as a single, table-directed shade change and registered as new snap S15 rather than reverted or left unexplained.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Page-wrapper background mapped to the wrong token, producing an unregistered ~83% full-page pixel shift**
- **Found during:** Task 3 (screenshot diff against `chunk-2-shell`)
- **Issue:** `app/page.tsx`'s and `app/product/[slug]/page.tsx`'s `bg-neutral-900` page wrapper was initially mapped to `bg-surface` (`#000000`) on the theory that a full-route wrapper is "page background" role. This produced a real, visible, uniform darkening (`#171717` -> `#000000`) across nearly the entire viewport on both routes -- far beyond any registered snap, and inconsistent with 05-05's own documented finding that the identical literal class (`bg-neutral-900` on `app/layout.tsx`'s header Suspense fallback) is a pixel-identical no-op onto `bg-surface-elevated`.
- **Fix:** Remapped both wrappers to `bg-surface-elevated`, restoring the exact prior pixel value.
- **Files modified:** `app/page.tsx`, `app/product/[slug]/page.tsx`
- **Verification:** Recaptured `chunk-3-catalog`; the home/product page-background component of the diff disappeared, leaving only the expected `bg-neutral-800`-consolidation diff (S15).
- **Committed in:** `d57ca70`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug). **Impact:** Caught before the SUMMARY was written, via the plan's own Task 3 verification step; no lasting effect. No scope creep -- the fix stayed within the two files Task 2 already touched.

## Issues Encountered

- The first `chunk-3-catalog` capture (taken before the Rule 1 fix above) left a stale, duplicate `## Label: \`chunk-3-catalog\`` section in `05-SCREENSHOTS.md` when the manifest script was re-run after the fix. Caught by a `grep -c` sanity check before committing; removed the stale section manually, keeping only the post-fix capture. No lasting effect, not a deviation from the plan itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The three highest-traffic storefront routes (home, category, product) and the card components they share are scan-clean and speak only the frozen 23-token contract. Stock/availability badges carry their intended meaning, not just a converged shade.
- A new manifest snap (S15) is registered for any later chunk that captures a `ProductCard` grid or the product gallery well -- those cells will legitimately continue to show the `bg-neutral-800` -> `bg-surface-elevated` shift for the reasons already documented here, not because of anything a later chunk's own sweep does.
- `order-status` coverage remains deferred (unchanged from 05-02's original note): whichever later chunk sweeps that route should seed a real local D1 order and re-run its own capture with `--order-id`.
- `lib/utils/image-placeholders.ts` remains untouched and on the manual-review registry, confirmed by an empty `git diff` across every commit in this plan.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/ProductCard.tsx (modified)
- FOUND: components/ProductRecommendations.tsx (modified)
- FOUND: app/category/[slug]/CategoryDisplay.tsx (modified)
- FOUND: app/category/[slug]/page.tsx (modified)
- FOUND: app/product/[slug]/ProductDisplay.tsx (modified)
- FOUND: app/product/[slug]/page.tsx (modified)
- FOUND: app/page.tsx (modified)
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md (modified)
- FOUND commit: 5bf392d
- FOUND commit: 0001a97
- FOUND commit: d57ca70
- FOUND commit: e0d8ed3
