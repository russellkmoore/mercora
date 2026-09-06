---
phase: 07-layout-switches
plan: 03
subsystem: layout
tags: [layout-switches, product-gallery, client-boundary, rsc-boundary]

# Dependency graph
requires:
  - phase: 07-01
    provides: "PRODUCT_GALLERIES enum, DEFAULT_LAYOUTS.productGallery, getLayoutSettings(), and the resolved-enum-value-as-prop pattern proven on the category switch"
provides:
  - "components/layout/product/ProductGalleryLeft.tsx — verbatim extraction of today's two-column product gallery, proven by a source-level parity test against a frozen pre-extraction recording"
  - "components/layout/product/ProductGalleryTop.tsx — the full-width gallery-above-information variant"
  - "components/layout/product/gallery-media-url.ts — the media URL helper moved out of ProductDisplay verbatim so both gallery variants share one implementation"
  - "app/product/[slug]/ProductDisplay.tsx — PRODUCT_GALLERY_MAP (component per enum member) and PRODUCT_GALLERY_LAYOUT (per-variant container/info wrapper classes), both held inside the client component and both plain object lookups, never a comparison against a member name literal"
  - "app/product/[slug]/page.tsx resolving and rendering the gallery switch server-side, existing parallel data fetches and revalidate=0 export untouched"
affects: [07-04, 07-05]

# Actuals (#2632)
actuals:
  tokens: 7346
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second Record<Enum, {...}> map, co-located with the component-lookup map inside the same client component, used purely for per-variant outer-wrapper/info-column class strings — an index operation on the already-validated enum value, not a comparison against a member name literal, so the display can give each gallery variant its own container geometry without a `layout` prop or an if/switch on the enum."
    - "A required cross-boundary prop temporarily declared optional (with a DEFAULT_LAYOUTS fallback) when the plan's own task/file split puts the resolver-wiring page edit in a later task than the prop's introduction — keeps every intermediate commit's typecheck green without pulling a later task's file into an earlier task's diff."

key-files:
  created:
    - components/layout/product/gallery-media-url.ts
    - components/layout/product/ProductGalleryLeft.tsx
    - components/layout/product/ProductGalleryTop.tsx
    - tests/unit/components/layout/product/product-gallery-variants.test.ts
    - tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt
  modified:
    - app/product/[slug]/ProductDisplay.tsx
    - app/product/[slug]/page.tsx

key-decisions:
  - "The media helper (getMediaUrl) moved into its own module (components/layout/product/gallery-media-url.ts) rather than becoming a prop — the UI-SPEC's gallery props table has no slot for it, both variants need it, and duplicating the body in two files would let them drift. The product display imports it from the new module. Per 07-RESEARCH.md's open question 1, it was deliberately NOT swapped for the shared resolveProductImageSrc helper: the two helpers do not normalise identically, and the default gallery extraction carries a byte-identical obligation — that swap stays out of scope for this phase."
  - "PRODUCT_GALLERY_MAP and a sibling PRODUCT_GALLERY_LAYOUT map both live inside ProductDisplay.tsx itself, not a separate module — unlike the category/home switches, this map doesn't need to be importable independently of a server page's data-fetching code, since every test that needs it already imports the client component directly."
  - "productGallery is declared optional on ProductDisplayProps with a DEFAULT_LAYOUTS.productGallery fallback in the destructure, rather than required. The plan's own task/file split puts app/product/[slug]/page.tsx's wiring in Task 3 while the prop is introduced in Task 2, and Task 2's own acceptance criteria requires a green `npm run typecheck` immediately after that commit — a required prop would have broken that gate since page.tsx (Task 3's file) doesn't pass it yet at that point. The optional marker has no runtime effect once Task 3 wires the only call site."
  - "The outer container/info-column class strings that give ProductGalleryLeft vs ProductGalleryTop their different overall page geometry live in a second Record map (PRODUCT_GALLERY_LAYOUT) inside ProductDisplay, keyed by the same enum as the component map, rather than as a prop on the gallery components themselves — GalleryProps stays exactly the four fields the interfaces block specifies (\"and nothing else\"), so the layout decision had to live somewhere else, and a second index-only map (never a comparison) keeps LAYOUT-04's anti-genericity rule intact."

patterns-established:
  - "Per-variant outer-geometry lookup via a second enum-keyed Record map, sibling to the component-lookup map, for switches whose variants need different page-level layout (grid vs stacked) without adding a prop to the shared variant-component contract."

requirements-completed: []  # LAYOUT-03 and LAYOUT-04 are also declared by sibling plan 07-04 (admin), not yet executed — requirements.ready-ids reported 0/2 ready; will be marked complete once every declaring plan has a SUMMARY.

coverage:
  - id: D1
    description: "ProductGalleryLeft is a provably verbatim extraction of today's two-column product gallery, and the moved media helper's behavior (null/undefined, string, nested-object, no-usable-url) is unchanged from its pre-move source"
    requirement: LAYOUT-03
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/product/product-gallery-variants.test.ts (helper's 4 behavior cases, source parity, render order/empty/single-image/selection-border cases — 12 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ProductGalleryTop renders the main image full width above the information block with the same thumbnail strip, empty/single-image cases handled identically to the default variant"
    requirement: LAYOUT-03
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/product/product-gallery-variants.test.ts (ProductGalleryTop render/empty/single-image/selection-border cases — 6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PRODUCT_GALLERY_MAP's key list equals the gallery enum in order with no duplicates, and every enum member resolves through the map to a component that renders non-empty markup"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/product/product-gallery-variants.test.ts (map key/enum equality, every-member-renders — 2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ProductDisplay's new prop is typed to the gallery union (never a bare string), no component (including ProductDisplay itself) branches on the resolved value against a member name literal, and the information column's markup is unchanged apart from the wrapper geometry the two variants own"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/product/product-gallery-variants.test.ts (source-contract: typed prop, no name-literal comparison, info column markup unchanged — 3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "app/product/[slug]/page.tsx awaits getLayoutSettings() directly in the page body, above the returned tree, passes productGallery under its own name, and a live dev-server probe proves flipping the stored value changes the served HTML with no restart"
    requirement: LAYOUT-04
    verification:
      - kind: unit
        ref: "tests/unit/components/layout/product/product-gallery-variants.test.ts (page source-contract: resolver call, prop wiring, unchanged fetches/export — 3 tests)"
        status: pass
      - kind: integration
        ref: "live probe against a running dev server: POST appearance.product_gallery=top then left, /product/vivid-mission-pack's data-product-gallery attribute count flips 0->1 and back, no restart, stored value restored to default"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-09-05
status: complete
---

# Phase 7 Plan 3: Product Gallery Switch — Verbatim Extraction, Full-Width Variant, Client-Boundary Map Summary

**The product gallery's position becomes a stored, server-chosen decision: today's two-column gallery is a proven-verbatim client component, a new full-width variant sits beside it, and `ProductDisplay` dispatches through a typed map plus a sibling per-variant layout map — with a live dev-server probe proving the served HTML flips with no restart.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-05T08:22:00Z (approx.)
- **Completed:** 2026-09-05T08:35:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Recorded `ProductDisplay.tsx`'s pre-Phase-7 gallery block verbatim (HEAD read, unmodified indentation) into `tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt`, then moved the local `getMediaUrl` helper into `components/layout/product/gallery-media-url.ts` with its body byte-for-byte unchanged (placeholder path, string passthrough, nested-object URL, no-usable-URL fallback all preserved).
- Extracted `ProductGalleryLeft.tsx` as a client component taking the four shared gallery props (`allImages`, `selectedImage`, `onSelect`, `productName`). A source-level parity test proves every recorded line survives in order, with exactly three permitted deviations called out explicitly by name: the outer `<div>`'s opening tag (gained `data-product-gallery="left"`), the `alt` attribute (closure `product.name` expression → `productName` prop), and the thumbnail `onClick` (closure `setSelectedImage` → `onSelect` prop) — everything else, including every class string, matches character for character.
- Built `ProductGalleryTop.tsx` per the UI-SPEC: a full-width main image (`aspect-video`, `sizes="100vw"`), the identical thumbnail strip now spanning full width, and its own `data-product-gallery="top"` attribute. Same four props, same selection/border behavior as the default variant.
- Rewired `ProductDisplay.tsx`: added `PRODUCT_GALLERY_MAP` (enum → component) and a sibling `PRODUCT_GALLERY_LAYOUT` (enum → `{ container, info }` class strings) — both plain object lookups held inside the client component, both keyed by the already-validated `productGallery` value, neither a comparison against a member name literal. The two-column default's container/info classes are byte-identical to the pre-phase source (`grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12` / `mt-6 lg:mt-0`); the full-width variant collapses to `flex flex-col` with the info column capped at `mt-8 lg:mt-10 max-w-2xl`, satisfying "capped for readability rather than stretched" without adding a `layout` prop anywhere or branching on the enum name in the display.
- Wired `app/product/[slug]/page.tsx`: `getLayoutSettings()` is awaited directly in the page body, above the returned tree, and the resolved `productGallery` value is passed to `ProductDisplay` under its own name. The existing parallel data fetches (`Promise.all` for reviews/eligibility/recommendations) and `revalidate = 0` export are untouched.
- Proved the switch live against the already-running local dev server (reused rather than started fresh — Next.js's dev-server singleton lock refuses a second instance in the same project directory): POSTing `appearance.product_gallery: "top"` then `"left"` via the dev-bypass header flipped `/product/vivid-mission-pack`'s `data-product-gallery` attribute count from 0→1 and back, with no server restart between requests. The stored value was left at the default (`left`).
- Full suite green after Task 3: `vitest` 2051/2051 (up from 2048 — 3 new tests this task, 26 total new across the plan), `npm run typecheck` (exit 0), `npm run lint` (0 errors, the same 52 pre-existing unrelated warnings), `npm run build` (exit 0, `/product/[slug]` still emits `ƒ`), `npm run scan:tokens` (0 violations, 2 manual-review rows, unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the pre-extraction gallery block, move the media helper, and extract the two-column gallery verbatim** - `58b667d` (test)
2. **Task 2: The full-width gallery variant and the typed map inside the product display** - `87bca44` (feat)
3. **Task 3: Wire the product page to the gallery switch and prove it on a real server** - `df95788` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/layout/product/gallery-media-url.ts` - the moved `getMediaUrl` helper, body unchanged
- `components/layout/product/ProductGalleryLeft.tsx` - verbatim default extraction
- `components/layout/product/ProductGalleryTop.tsx` - full-width variant
- `app/product/[slug]/ProductDisplay.tsx` - `PRODUCT_GALLERY_MAP`, `PRODUCT_GALLERY_LAYOUT`, the new `productGallery` prop
- `app/product/[slug]/page.tsx` - resolves `productGallery`, passes it to `ProductDisplay`
- `tests/unit/components/layout/product/product-gallery-variants.test.ts` - 26 tests (helper behavior, parity, per-variant render/empty/selection, map/enum equality, source-contract for both the display and the page)
- `tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt` - the frozen recording

## Decisions Made

- **Media helper moved to its own module, not a prop** — see key-decisions above; recorded per this plan's own `<verification>` requirement to document the flagged decision and repeat the carried-forward note that swapping it for `resolveProductImageSrc` stays out of scope.
- **A second enum-keyed map (`PRODUCT_GALLERY_LAYOUT`) for per-variant outer geometry**, sibling to `PRODUCT_GALLERY_MAP`, both held inside `ProductDisplay.tsx` rather than a separate module — no `layout` prop introduced anywhere, no comparison against a member name literal, and the default variant's classes stay byte-identical to the pre-phase source.
- **`productGallery` declared optional with a `DEFAULT_LAYOUTS` fallback**, tightened in effect (though not in type) once Task 3 wires the only call site — necessary to keep Task 2's own `npm run typecheck` gate green given the plan's task/file split (page.tsx is Task 3's file).
- **Reused the already-running dev server on :3000 for the live probe** instead of starting a new one — Next.js refuses a second dev-server instance against the same project directory (a file lock, not a port conflict). Only the stored D1 setting needed restoring afterward; the server's lifecycle was never mine to manage since I didn't start it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `productGallery` declared optional rather than required, to keep Task 2's typecheck gate green**
- **Found during:** Task 2, while adding the new prop per the interfaces block ("gains exactly one new prop, `productGallery: ProductGallery`")
- **Issue:** The interfaces block describes `productGallery` as a plain required prop, but the plan's own task/file split puts `app/product/[slug]/page.tsx` (the only call site) in Task 3's files, not Task 2's. A required prop with no call site passing it would fail `tsc --noEmit` (`Property 'productGallery' is missing`) immediately after Task 2's commit, breaking Task 2's own acceptance criterion ("`npm run typecheck` ... exit 0").
- **Fix:** Declared `productGallery?: ProductGallery` with a destructure-time default of `DEFAULT_LAYOUTS.productGallery` (the same single source of truth every other fallback in this phase uses). No runtime behavior changes once Task 3 wires the only call site to pass the resolved value explicitly.
- **Files modified:** `app/product/[slug]/ProductDisplay.tsx`
- **Verification:** `npm run typecheck` exits 0 immediately after both Task 2's and Task 3's commits; the source-contract test asserts the prop's declared type is still the gallery union (`productGallery\??:\s*ProductGallery`), never a bare string.
- **Committed in:** `87bca44` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 — a blocking issue created by the plan's own task/file split, not an implementation mistake). **Impact:** No effect on any must-have truth, prohibition, or LAYOUT-04 anti-genericity assertion — the prop is still typed to the frozen union everywhere, and the only real call site (`page.tsx`, wired in Task 3) always passes the resolved value explicitly. Every task's own acceptance gates stayed green at every commit.

## Issues Encountered

- **Next.js's dev-server singleton lock.** A dev server was already running on :3000 (pre-existing, not started by this plan). Attempting to start a second instance on a different port for the live probe failed with `⨯ Another next dev server is already running` — Next.js locks per project directory, not per port. Resolved by reusing the existing server for the probe (it picked up the plan's file changes via its own file watcher) rather than starting or stopping any server process; only the stored D1 setting was restored to default afterward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `components/layout/product/ProductGalleryLeft.tsx`, `ProductGalleryTop.tsx`, and `gallery-media-url.ts` are stable; plan 07-05's screenshot diff should compare against the `phase-07-pre-extraction-volt-dark` baseline 07-01 recorded (the default `left` gallery should be pixel-identical; `top` is a new intentional capture).
- LAYOUT-03 and LAYOUT-04 are NOT yet marked complete in `REQUIREMENTS.md` — both are also declared by sibling plan 07-04 (admin, still unexecuted), so the shared-ID gate correctly held them back (`requirements.ready-ids` reported 0/2 ready). They will flip to Complete once 07-04 also has a SUMMARY.
- The stored `appearance.product_gallery` D1 value is at its default (`left`) — no manual cleanup needed before the next plan runs.
- All three layout switches (category, home hero, product gallery) now follow the same resolved-enum-value-as-prop pattern; plan 07-04 (admin `LayoutSwitches` island) is the last piece wiring the D1 write side for all three keys together.

---
*Phase: 07-layout-switches*
*Completed: 2026-09-05*

## Self-Check: PASSED

- FOUND: components/layout/product/gallery-media-url.ts
- FOUND: components/layout/product/ProductGalleryLeft.tsx
- FOUND: components/layout/product/ProductGalleryTop.tsx
- FOUND: tests/unit/components/layout/product/product-gallery-variants.test.ts
- FOUND: tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt
- FOUND: app/product/[slug]/ProductDisplay.tsx (modified, verified via git diff)
- FOUND: app/product/[slug]/page.tsx (modified, verified via git diff)
- FOUND commit: 58b667d
- FOUND commit: 87bca44
- FOUND commit: df95788
- Re-ran plan-level verification: vitest tests/unit/components/layout/product/ (26/26), npm run scan:tokens (0 violations, 2 manual-review rows: image-placeholders.ts, Promotion.ts), npm run typecheck (exit 0), npm run lint (0 errors, 52 pre-existing unrelated warnings), npm test (2051/2051), npm run build (exit 0, /product/[slug] emits ƒ), live dev-server probe (data-product-gallery flips top→1, left→1, no restart, stored value restored to default)
