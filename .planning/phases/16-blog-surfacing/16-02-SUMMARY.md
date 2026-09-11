---
phase: 16-blog-surfacing
plan: 02
subsystem: navigation
tags: [blog, header, nav, next-link, rsc, vitest]

requires:
  - phase: 16-blog-surfacing (plan 01)
    provides: "getContentSettings() (blogNavLabel) and getPublishedBlogPosts({ limit }) — the exact two reads this plan calls"
provides:
  - "HeaderClient showBlogNav/blogNavLabel props — the frozen interface 16-03 does not consume but sits beside"
  - "Server-resolved, boolean-only blog-existence gate pattern for Header.tsx (no post row ever reaches the client bundle)"
affects: [16-04-blog-admin-tab]

actuals:
  tokens: 2760
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Server component computes a boolean gate + a label once, passes both as props to the client nav; both render sites (desktop, mobile) read the same two props so they cannot disagree — no nav-array abstraction introduced for a single conditional entry."

key-files:
  created:
    - tests/unit/components/header-blog-nav.test.ts
  modified:
    - components/Header.tsx
    - components/HeaderClient.tsx

key-decisions:
  - "Blog nav link renders as plain text with no icon, matching the Categories trigger's own label style (D-07's discretion note)."
  - "No components/header-links.ts array builder created — one inline `{showBlogNav && <Link href=\"/blog\">{blogNavLabel}</Link>}` conditional in the desktop nav and one in the mobile sheet, both reading the same two props (D-07)."
  - "components/Footer.tsx and components/cart/CartDrawer.tsx left completely untouched (D-14; mobile-header-contract.test.ts's pinned regions)."
  - "getPublishedBlogPosts({ limit: 1 }) result is collapsed to a boolean (`.length > 0`) at the point it is computed in Header.tsx — no post row, draft or published, ever becomes a prop (T-16-11)."

patterns-established:
  - "Server-resolved boolean+label nav gate: one server-side existence check + one settings read, passed down as two client props, both render sites gated identically — proven by occurrence-count assertions rather than snapshot/visual inspection."

requirements-completed: [BLOG-01]

coverage:
  - id: D1
    description: "Header() resolves blog nav visibility (any published article exists) and the admin-set label server-side; the existence check is a strict boolean by the time it reaches HeaderClient, and no post object/array crosses the boundary"
    requirement: "BLOG-01"
    verification:
      - kind: unit
        ref: "tests/unit/components/header-blog-nav.test.ts#Header() resolves blog nav visibility and label server-side"
        status: pass
    human_judgment: false
  - id: D2
    description: "Desktop nav and mobile sheet each render exactly one conditional /blog link, both gated on showBlogNav and both labelled from blogNavLabel — proven by source occurrence counts, with the pinned mobile-width-contract test staying green unmodified"
    requirement: "BLOG-01"
    verification:
      - kind: unit
        ref: "tests/unit/components/header-blog-nav.test.ts#HeaderClient.tsx: desktop and mobile navs read the same two props"
        status: pass
      - kind: unit
        ref: "tests/unit/components/mobile-header-contract.test.ts#mobile header width contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "The blog link's live visual appearance and interaction (spacing, hover state, mobile sheet close-on-click) reads correctly in the running storefront header"
    human_judgment: true
    rationale: "No browser/e2e screenshot was captured in this plan — only source-contract and prop-boolean unit assertions ran. Visual confirmation is deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase; the markup and gating logic are covered by D1/D2."

duration: 8min
completed: 2026-09-11
status: complete
---

# Phase 16 Plan 2: Blog Header Navigation Summary

**`Header.tsx` resolves blog-post existence and the admin-set label server-side as a strict boolean+string pair; `HeaderClient.tsx` renders one identical conditional `/blog` link in the desktop nav and the mobile sheet, proven by a source-occurrence-count test suite that pins both call sites and the pre-existing mobile-width contract.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-11T08:42:00Z
- **Completed:** 2026-09-11T08:49:54Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `components/Header.tsx` awaits `getContentSettings()` and `getPublishedBlogPosts({ limit: 1 })`, collapses the post list to a strict boolean (`showBlogNav`), and passes both it and `blogNavLabel` to `HeaderClient` alongside `categories` — matching the existing fetch-then-prop-pass shape used for categories.
- `components/HeaderClient.tsx` gained `showBlogNav`/`blogNavLabel` props and one conditional `/blog` link in the desktop nav (beside the Categories dropdown) and one in the mobile sheet (below the category list, closing the sheet on click) — both reading the same two props, both plain text with no icon.
- `tests/unit/components/header-blog-nav.test.ts` proves the server gate (boolean in both empty/non-empty cases, label passed verbatim, exactly one call to `getPublishedBlogPosts` with `limit: 1`, no post object/array reaching the client props) and desktop/mobile parity (exactly two `showBlogNav &&` conditionals, two `{blogNavLabel}` reads, two `/blog` links) via source occurrence counts — mutation-tested by temporarily removing one conditional and confirming the count assertions fail.
- `tests/unit/components/mobile-header-contract.test.ts` passes unmodified; `components/Footer.tsx` and `components/cart/CartDrawer.tsx` are untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Header.tsx resolves blog visibility and label server-side** - `b71ac09` (feat)
2. **Task 2: HeaderClient renders the conditional link in both navs** - `b66fd56` (feat)
3. **Task 3: Prove the server gate and desktop/mobile parity** - `17fadf1` (test)

**Plan metadata:** committed alongside this SUMMARY.

_Task 3 carried `tdd="true"`; the test was written, run RED against a deliberately over-strict first draft of one assertion (see Deviations), corrected, and confirmed GREEN against the finished Tasks 1-2 implementation in the same commit — the plan's own text permits either committing the test before implementation or running it against the finished tasks, and this plan took the latter path since Tasks 1-2 landed first._

## Files Created/Modified

- `components/Header.tsx` - Resolves `showBlogNav` (boolean) and `blogNavLabel` server-side, passes both to `HeaderClient`
- `components/HeaderClient.tsx` - Accepts the two new props, renders one conditional `/blog` link in the desktop nav and one in the mobile sheet
- `tests/unit/components/header-blog-nav.test.ts` - Server-gate boolean/label proof + desktop/mobile parity occurrence-count proof

## Decisions Made

- No icon on the blog nav link — plain text, matching the Categories trigger's own label (D-07 discretion, resolved as documented in `key-decisions`).
- No `components/header-links.ts` array builder — a single boolean gating a single link does not need one, per D-07's own text.
- `Footer.tsx`'s independent hardcoded blog link stays exactly as-is (D-14) — not opened, not re-labelled.

## Deviations from Plan

None — plan executed exactly as written. Two clarifying notes on how this plan's own acceptance-criteria text was interpreted, neither of which changed the implementation:

**1. `unstable_cache` occurrence count.** Task 1's acceptance criterion expects `grep -c "unstable_cache" components/Header.tsx` to return `1`. The file already contained 2 line-matches before this plan touched it (the `import { unstable_cache }` line and the `getCachedCategories = unstable_cache(...)` line both contain the substring) — confirmed via `git show HEAD~3:components/Header.tsx | grep -c unstable_cache` returning `2` prior to any edit in this plan. The actual invariant the criterion protects — no *second* `unstable_cache` wrapper added for the two new reads — is met and directly verified: `getContentSettings()` and `getPublishedBlogPosts()` are called uncached, exactly as Task 1's `<action>` specifies.

**2. `git diff` line-removal criterion on `Header.tsx`.** Task 1's acceptance criterion expects the diff to remove no existing line except the single-prop `HeaderClient` element. The task's own `<action>` separately instructs extending the header comment's `Data Flow` and `Architecture` lines to describe the new data flow — doing so, as instructed, replaced (removed-then-re-added) three comment lines in addition to the `HeaderClient` element line. No non-comment, non-render line was removed.

## Issues Encountered

None blocking. During Task 3's TDD authoring, the first draft of the "no post data crosses the boundary" assertion was over-strict (`Array.isArray(value)` alone), which failed against the legitimate `categories` prop (itself an array, mocked empty in this test). Narrowed to "no array containing objects" before the RED/GREEN cycle completed — the corrected assertion is what ships and what the mutation test above confirms still catches a real regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BLOG-01 is fully satisfied: a shopper with published articles sees the blog link in both header locations; a shopper on an article-free store sees no blog markup anywhere in the header.
- `getContentSettings()` and `getPublishedBlogPosts` are proven safe to call uncached from a second server component — 16-04 (admin Content tab) can read/write the same `content.*` settings without needing to touch this plan's files.
- No blockers for 16-04.

---
*Phase: 16-blog-surfacing*
*Completed: 2026-09-11*

## Self-Check: PASSED
