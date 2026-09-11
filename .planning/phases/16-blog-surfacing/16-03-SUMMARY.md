---
phase: 16-blog-surfacing
plan: 03
subsystem: ui
tags: [blog, home-page, nextjs, server-component, tdd, tailwind]

# Dependency graph
requires:
  - phase: 16-blog-surfacing
    provides: "getContentSettings() (content.* admin settings), resolveBlogExcerpt(), getPublishedBlogPosts({ includeHtml })"
provides:
  - "components/home/BlogHighlights.tsx — synchronous server component rendering the home page's latest-articles cards"
  - "app/page.tsx wiring: one resolved BlogHighlights element rendered at exactly one of two fixed slots (before/after the featured-products grid), gated on the enabled flag and non-empty posts"
affects: [16-04-blog-admin-tab]

actuals:
  tokens: 4530
  tasks: 2
  commits: 4
  plan_head_before: c30584e

tech-stack:
  added: []
  patterns:
    - "Home-page block placement resolved once into a single JSX local, then rendered at two sibling slots guarded on the placement enum — makes double-rendering or slot divergence structurally impossible"
    - "Card markup copied verbatim from BlogIndex.tsx with only the heading level demoted (h2 -> h3) to preserve document outline when nested under the block's own h2"

key-files:
  created:
    - components/home/BlogHighlights.tsx
    - tests/unit/components/home/blog-highlights.test.ts
    - tests/unit/app/page-blog-highlights.test.ts
  modified:
    - app/page.tsx

key-decisions:
  - "BlogHighlights is a plain synchronous server component (no async, no hooks, no client directive) — app/page.tsx owns all data reads, so the component is directly testable with React.createElement and renderToStaticMarkup."
  - "The excerpt is computed once per card into a local and the paragraph renders only when non-empty, matching resolveBlogExcerpt's empty-string contract for a post with neither an excerpt nor a body."
  - "The disabled short-circuit skips the getPublishedBlogPosts call entirely rather than fetching and filtering afterward — a disabled block costs nothing."

requirements-completed: [BLOG-02, BLOG-03]

coverage:
  - id: D1
    description: "BlogHighlights renders one linked card per post — title, optional cover image, formatted date, and an excerpt following the explicit-else-derived rule — plus a heading and a 'Read all' link to /blog"
    requirement: "BLOG-03"
    verification:
      - kind: unit
        ref: "tests/unit/components/home/blog-highlights.test.ts#BlogHighlights"
        status: pass
    human_judgment: false
  - id: D2
    description: "The home page renders the block at exactly one of two fixed positions per the resolved placement setting, never both, and the block disappears (no query, no markup) when disabled or when there are no published posts"
    requirement: "BLOG-02"
    verification:
      - kind: unit
        ref: "tests/unit/app/page-blog-highlights.test.ts#HomePage — BlogHighlights placement and gating"
        status: pass
    human_judgment: false
  - id: D3
    description: "No article body text is reproduced on the home page — only the capped excerpt — and every card links out to /blog/[slug]"
    requirement: "BLOG-03"
    verification:
      - kind: unit
        ref: "tests/unit/components/home/blog-highlights.test.ts#BlogHighlights"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production build succeeds — no server-only module crosses a client boundary via the new component or wiring"
    verification:
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-11
status: complete
---

# Phase 16 Plan 3: Blog Home Block Summary

**Latest-articles block on the home page — admin-controlled heading, count, on/off, and one of two fixed positions relative to the featured-products grid, cards copied from the blog index's own markup.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-11T08:45:53Z
- **Completed:** 2026-09-11T08:50:34Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `components/home/BlogHighlights.tsx` — a synchronous server component rendering a heading, a "Read all" link to `/blog`, and one card per post (title link, optional cover image, formatted date, excerpt), with all 23-token-contract colors and no `dangerouslySetInnerHTML`.
- `app/page.tsx` resolves `content.*` settings once, computes a single `BlogHighlights` element (or `null`), and renders it at exactly one of two sibling slots — before or after the featured-products grid — chosen by the resolved placement, so it can never appear twice or diverge between positions.
- A disabled block, or an enabled block with zero published posts, renders nothing — not even the heading — and `getPublishedBlogPosts` is never called when disabled.
- Two new test suites (20 total cases) cover every behavior bullet from the plan: card rendering, excerpt precedence, cover-image presence, both placements, exactly-once rendering, the disabled short-circuit, and the empty-posts case.

## Task Commits

Each task was committed atomically:

1. **Task 1: BlogHighlights (RED)** - `fe65090` (test)
2. **Task 1: BlogHighlights (GREEN)** - `48f6f75` (feat)
3. **Task 2: Home page wiring (RED)** - `7728ce6` (test)
4. **Task 2: Home page wiring (GREEN)** - `f2faa63` (feat)

**Plan metadata:** this SUMMARY's commit.

_Both tasks carried `tdd="true"`: each has a failing-test commit followed by the minimal-implementation commit. Neither needed a separate REFACTOR commit — each GREEN implementation was already the intended final shape._

## Files Created/Modified

- `components/home/BlogHighlights.tsx` - the latest-articles block's cards, heading, and "Read all" link
- `app/page.tsx` - settings read, single resolved block element, two placement-guarded insertion points
- `tests/unit/components/home/blog-highlights.test.ts` - 12 cases covering the component's own `<behavior>` block
- `tests/unit/app/page-blog-highlights.test.ts` - 8 cases covering placement, gating, and pass-through

## Decisions Made

- Held the resolved block element in a single local rather than constructing it inline at each slot — makes "renders exactly once, identical content at both positions" a structural guarantee rather than a convention to remember (D-10).
- Reworded the component's file-header comment to avoid the literal substring `"use client"` inside its own explanatory prose — the plan's acceptance-criteria grep for that exact directive string doesn't distinguish a comment from the real directive, and the safer fix was rewording, not weakening the check.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first `git commit -F` for Task 1's GREEN commit picked up a stale message file (a `cat >| <path>` collision with a leftover file from an earlier session under the scratchpad path), landing the diff under an unrelated commit message. Caught immediately via `git log`/`git show`, corrected with `git commit --amend -F` before any further work — the diff itself was always correct, only the message was wrong, and no other commit was affected.
- Ran in parallel with the 16-02 executor in the same checkout (no worktrees), per this plan's `<parallel_execution>` instructions. Commits interleaved on `main` as expected (`b71ac09`, `b66fd56`, `17fadf1` are 16-02's, visible between this plan's own commits in `git log`). `actuals.commits` above is a scoped count (`git log --grep="(16-03)"`), not a `plan_head_before..HEAD` range count — a range count would have included 16-02's interleaved commits, which the parallel-checkout setup makes structurally unreliable for this plan alone. `plan_head_before` (`c30584e`) is recorded for traceability only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The home page now surfaces the blog per BLOG-02/BLOG-03. `content.*` settings (`blogHomeBlockEnabled`, `blogHomeBlockHeading`, `blogHomeBlockCount`, `blogHomeBlockPlacement`) are fully wired end-to-end from resolver to render.
- 16-04 (admin Content tab) can now write to the same `content.*` settings this plan reads — no blockers.
- No blockers. Full suite (314 files / 2838 tests), `scan:tokens`, `lint`, `typecheck`, and `build` all pass with these changes in place.

---
*Phase: 16-blog-surfacing*
*Completed: 2026-09-11*

## Self-Check: PASSED
