---
phase: 05-token-contract-component-sweep
plan: 08
subsystem: ui
tags: [tailwind, tokens, cms, blog, prose, screenshot-tooling]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end, the mechanism this plan substitutes class names against"
  - phase: 05-04
    provides: "components/ui/* primitives (card, button) scan-clean and their real token vocabulary to match"
provides:
  - "components/pages/* (SectionCard, PageCta, PageHero, LegalDocument, FaqAccordion, PageRail, ContactGrid, StoryBody) and app/[slug]/PageRenderer.tsx scan-clean and token-driven, so no merchant-authored CMS page can render a hardcoded palette value"
  - "components/blog/BlogIndex.tsx, app/blog/page.tsx, app/blog/[slug]/page.tsx scan-clean and token-driven"
  - "an opt-in --include-content flag on scripts/screenshot-routes.mjs that resolves a blog post and CMS page slug from the sitemap for future content-route captures"
  - "chunk-3-content screenshot coverage in 05-SCREENSHOTS.md for the blog index, one blog post, and one CMS page, diffed against a genuine pre-sweep capture"
affects: [05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 8563
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every `prose`/`prose-invert`/`prose-orange` block in this chunk (SectionCard, LegalDocument, FaqAccordion, ContactGrid, StoryBody, PageRenderer's guide lead, and the blog post body) runs entirely on the Typography plugin's own built-in orange colour scheme -- there is no raw-palette override anywhere in this chunk to replace with a token class. The plugin's default accent happens to equal the current primary token's hex (#f97316 is Tailwind's orange-500, and volt-dark's primary is also #f97316), so nothing visibly breaks today, but the accent will not move if a future theme changes primary -- prose content stays pinned to the plugin's static orange until Phase 6 wires a custom typography colour scheme off the CSS variables."
    - "hover:bg-orange-500 (a hover state that fills to the exact base primary shade, not a lighter or darker one) maps to hover:bg-primary at full opacity rather than a reduced-alpha variant -- the TOKEN-MAP §2 alpha rows only cover orange-400 (lighter) and orange-600/700 (darker) hovers; a hover that lands on the base shade itself gets the base token, paired with hover:text-on-primary per the existing white-on-orange rule."
  patterns-established:
    - "scripts/screenshot-routes.mjs's route grid can be extended per-capture via an opt-in flag (--include-content) rather than a permanent grid change, so a plan needing evidence for routes outside the D-20 seven-route grid doesn't alter the captured-cell count every other chunk's <verify> block already depends on."

key-files:
  created: []
  modified:
    - components/pages/SectionCard.tsx
    - components/pages/PageCta.tsx
    - components/pages/PageHero.tsx
    - components/pages/LegalDocument.tsx
    - components/pages/FaqAccordion.tsx
    - components/pages/PageRail.tsx
    - components/pages/ContactGrid.tsx
    - components/pages/StoryBody.tsx
    - components/blog/BlogIndex.tsx
    - app/blog/page.tsx
    - app/blog/[slug]/page.tsx
    - scripts/screenshot-routes.mjs
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "app/[slug]/PageRenderer.tsx needed no sweep: read in full, it carries exactly one colour-bearing class (a prose block for the guide template's lead paragraph) and no raw palette class of its own. Confirmed by reading rather than trusting the pre-sweep measured-zero count, per the task's own instruction."
  - "All eight prose usages in this chunk (SectionCard x2, LegalDocument x2, FaqAccordion x2, ContactGrid x1, StoryBody x2, PageRenderer's guide lead x1) plus the blog post body run on Typography plugin defaults (prose-invert prose-orange) with no raw-palette override -- nothing to substitute, but recorded per the plan's own instruction since this content will not track a future theme change until Phase 6 wires custom typography colours."
  - "scripts/screenshot-routes.mjs had no concept of blog or CMS routes before this plan (Rule 3 -- a blocking gap, not a design choice), despite the plan's own read_first describing it as already resolving them. Extended it with an opt-in --include-content flag rather than changing the default route grid, so every other chunk's captured-cell count and <verify> expectations stay exactly what they were."
  - "Produced a genuine pre-sweep baseline for the three new content cells via a git worktree checked out at the commit before this plan's Task 1 (not a stash, to avoid disturbing the sequential-executor working tree), running a second local dev server on port 3001 against the same local D1 state. Turbopack's next dev refused a symlinked node_modules pointing outside the worktree's own filesystem subtree ('points out of the filesystem root'); switched to an rsync --link-dest hardlink copy of node_modules and .wrangler instead, which Turbopack accepted."
  - "Inserted one synthetic, local-only blog_posts row directly via wrangler d1 execute --local (this project's local dev seed carries zero blog posts) so /blog and a real post both had content to screenshot and human-check for prose contrast. Matches the local-only-fixture precedent 05-06/05-07 already established; the row lives only in gitignored .wrangler/ state, not in any tracked seed file."
  - "chunk-3-content's manifest section (and its pre-chunk-3-content pre-state section) were trimmed to the three new routes only (6 rows each), rather than keeping the --include-content flag's full 28-row capture verbatim -- the other 22 cells duplicate what chunk-3-catalog/chunk-3-engagement already cover against the D-20 baseline and would only bloat the manifest without adding evidence this task needs."
  - "cms-page/PageHero's bg-neutral-950 -> bg-surface diff (#0a0a0a -> #000000) is the identical value pair already registered as snap S13 for Footer.tsx; referenced S13 rather than minting a new snap number for the same table-directed mapping applied to a second file."

patterns-established: []

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "All eight CMS block components (SectionCard, PageCta, PageHero, LegalDocument, FaqAccordion, PageRail, ContactGrid, StoryBody) and app/[slug]/PageRenderer.tsx are scan-clean and token-driven; no inverse-set token leaked in; build/lint/typecheck all pass"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/pages -> 0 violations"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path 'app/[slug]' -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -rcE '(bg|text|border)-(surface-inverse|on-inverse|muted-on-inverse|border-inverse)' components/pages | grep -v ':0$' | wc -l -> 0"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged; typecheck clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "BlogIndex.tsx, app/blog/page.tsx, and app/blog/[slug]/page.tsx are scan-clean and token-driven; the blog post body shares the CMS story body's prose approach; test suite green"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/blog -> 0 violations"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path app/blog -> 0 violations"
        status: pass
      - kind: other
        ref: "grep -rcE '(bg|text|border)-(surface-inverse|on-inverse|muted-on-inverse|border-inverse)' components/blog app/blog | grep -v ':0$' | wc -l -> 0"
        status: pass
      - kind: unit
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed"
        status: pass
      - kind: other
        ref: "mise exec -- npm run lint && npm run typecheck -> pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk-3-content captured for the blog index, one blog post, and one CMS page at both viewports, diffed against a genuine pre-sweep worktree capture; every differing pixel traces to the TOKEN-MAP substitution table or the S13 near-black consolidation; long-form body copy reads with clear contrast"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-3-content --include-content --allow-missing -> captured 28 cell(s), 4 missing (matches pre-existing order-status gap)"
        status: pass
      - kind: other
        ref: "grep -c 'chunk-3-content' 05-SCREENSHOTS.md -> 17 (non-zero)"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + 15 random differing-pixel samples per cell, all 6 content cells, against pre-chunk-3-content: every sample lands on text-orange-400->text-primary (identical hex), border-neutral-800(#262626)->border-border(#404040), text-neutral-300(#d4d4d4)->text-muted-foreground(#a3a3a3), or the S13-pattern bg-neutral-950(#0a0a0a)->bg-surface(#000000) pair"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/pages -> 0 violations (re-checked after capture)"
        status: pass
    human_judgment: true
    rationale: "I visually inspected the chunk-3-content blog-index, blog-post, and cms-page captures at 1280px via the Read tool and confirmed headings, body copy, links, and card borders are all clearly distinguishable with strong contrast against the dark surface -- the plan's own human-check criterion. A human should still perform the plan's own interactive pass (opening these three routes live in a browser) since a scripted pixel diff plus a static image review is not the same as a deliberate interactive QA pass, matching the same caveat 05-06/05-07 recorded for their own human-check items."

# Metrics
duration: 25min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 8: CMS Page Block and Blog Surface Sweep Summary

**Every CMS block component a merchant-authored page can compose, plus the blog index and post surfaces, now speak only the 23-token contract -- closing the highest-risk gap in the phase, since a CMS-authored page composes these blocks at runtime and would otherwise ship a raw palette value to a page nobody screenshotted.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-04T16:08:00Z (approx.)
- **Completed:** 2026-09-04T16:30:00Z
- **Tasks:** 3 completed
- **Files modified:** 13 (11 source files, 1 screenshot tooling script, 1 screenshot manifest)

## Accomplishments

- Swept all eight CMS page block components (`SectionCard.tsx`, `PageCta.tsx`, `PageHero.tsx`, `LegalDocument.tsx`, `FaqAccordion.tsx`, `PageRail.tsx`, `ContactGrid.tsx`, `StoryBody.tsx`) onto main-set tokens per TOKEN-MAP §2: card/panel backgrounds to `bg-surface-elevated`, headings to `text-foreground`, captions/metadata to `text-muted-foreground`, every CTA/link/accent to `text-primary`/`bg-primary`, and every outline to `border-border`. Confirmed by full read that `app/[slug]/PageRenderer.tsx` (the CMS block dispatcher) carries no colour class of its own beyond a plugin-default prose block, closing the loop the objective called the phase's highest-risk omission.
- Documented that all eight prose (`prose prose-invert prose-orange`) usages in this chunk, plus the blog post body, run entirely on the Typography plugin's own built-in colour scheme with no raw-palette override to replace -- nothing to sweep, but flagged since this content will not follow a future theme until Phase 6 wires custom typography colours.
- Swept the three blog surfaces (`BlogIndex.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`) onto the same main-set tokens: post cards to `bg-surface-elevated`, dates/authors/excerpts to `text-muted-foreground`, tags/links/read-more to `text-primary`, dividers to `border-border`.
- Extended `scripts/screenshot-routes.mjs` with an opt-in `--include-content` flag (Rule 3 auto-fix -- the script had no concept of blog or CMS routes at all, which blocked Task 3 outright despite the plan's read_first describing it as already handling them) and captured a genuine pre-sweep baseline from a git worktree, then the post-sweep `chunk-3-content` set. Pixel-diffed every one of the 6 new cells: every difference traces cleanly to the TOKEN-MAP substitution table or the already-registered S13 near-black consolidation. No unregistered change; visual contrast confirmed clean on direct inspection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the CMS page block components** - `0823d08` (feat)
2. **Task 2: Sweep the blog surfaces** - `f413bf6` (feat)
3. **Task 3: Screenshot the three routes outside the standard grid** - `5f2be33` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/pages/SectionCard.tsx` - card surfaces, headings, spec chips, callouts, and product link rewritten to main-set tokens
- `components/pages/PageCta.tsx` - CTA section, primary/secondary action buttons, and policy links rewritten to main-set tokens
- `components/pages/PageHero.tsx` - header background, eyebrow, title, and lede rewritten to main-set tokens
- `components/pages/LegalDocument.tsx` - document card, updated-label chip, and section headings rewritten to main-set tokens
- `components/pages/FaqAccordion.tsx` - accordion card, question buttons, and chevron rewritten to main-set tokens
- `components/pages/PageRail.tsx` - on-this-page nav rewritten to main-set tokens including active/hover states
- `components/pages/ContactGrid.tsx` - contact cards and icons rewritten to main-set tokens
- `components/pages/StoryBody.tsx` - story article card and section headings rewritten to main-set tokens
- `components/blog/BlogIndex.tsx` - tag filter pills, post cards, pagination rewritten to main-set tokens
- `app/blog/page.tsx` - blog index header eyebrow/title rewritten to main-set tokens
- `app/blog/[slug]/page.tsx` - post header, byline, excerpt, related-posts card rewritten to main-set tokens
- `scripts/screenshot-routes.mjs` - added opt-in `--include-content` flag resolving a blog post and CMS page slug from the sitemap
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-3-content` and `pre-chunk-3-content` sections (6 rows each) with per-cell comparison verdicts

## Decisions Made

- `app/[slug]/PageRenderer.tsx` needed no sweep after a full read confirmed it carries no colour class beyond a plugin-default prose block.
- All prose usages in this chunk run on Typography plugin defaults (no raw override to substitute); recorded for Phase 6 awareness rather than fixed now.
- `hover:bg-orange-500` (fills to the exact base primary shade) maps to `hover:bg-primary` at full opacity plus `hover:text-on-primary`, since it's neither a lighter nor darker hover per TOKEN-MAP §2's alpha rows.
- `scripts/screenshot-routes.mjs` gained a new opt-in flag rather than a permanent grid change, to avoid altering every other chunk's expected captured-cell count.
- A genuine pre-sweep baseline was captured from a git worktree (not a stash) with a hardlink-copied `node_modules`/`.wrangler` (symlinks broke Turbopack's own filesystem-root check).
- One synthetic, local-only `blog_posts` row was inserted via `wrangler d1 execute --local` so the blog surfaces had real content to render and human-check, matching the local-only-fixture precedent from 05-06/05-07.
- `chunk-3-content`/`pre-chunk-3-content` manifest sections were trimmed to the 3 new routes (6 rows) rather than the flag's full 28-row capture, since the other 22 cells duplicate existing chunk-3-catalog/chunk-3-engagement coverage.
- The CMS page's `PageHero` background diff is the same value pair as the already-registered S13 snap (Footer.tsx); referenced S13 rather than minting a new snap number.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `scripts/screenshot-routes.mjs` had no concept of blog or CMS routes**
- **Found during:** Task 3
- **Issue:** The plan's own `<read_first>` described the script as already resolving blog and CMS slugs from the sitemap, but the script (as built in 05-02) only resolved product and category slugs. Without this, Task 3's own `<verify>` command (which invokes the script) could not produce the required `chunk-3-content` cells at all.
- **Fix:** Added an opt-in `--include-content` flag that resolves a blog post path (`/blog/<slug>`) and a CMS page path (a single-segment sitemap path not in a reserved-route set) from `/sitemap.xml`, and adds `blog-index`/`blog-post`/`cms-page` cells only when the flag is passed. Off by default so no other chunk's grid or expected cell count changes.
- **Files modified:** `scripts/screenshot-routes.mjs`
- **Verification:** `node --check` syntax-clean; ran successfully against both a pre-sweep and post-sweep dev server, correctly resolving `/about` (a real CMS page) and the synthetic blog post.
- **Committed in:** `5f2be33` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3). **Impact on plan:** Necessary to complete Task 3 at all; scoped as a narrow, opt-in addition that leaves every other chunk's screenshot behavior byte-identical.

## Issues Encountered

- Turbopack's `next dev` refused a symlinked `node_modules`/`.wrangler` pointing from the pre-sweep git worktree back to the main repo ("Symlink ... is invalid, it points out of the filesystem root"). Resolved by using `rsync -a --link-dest` to hardlink-copy both directories into the worktree instead of symlinking them, which Turbopack accepted without complaint.
- This project's local D1 dev seed carries zero blog posts, so `/blog/<slug>` had nothing to render. Resolved by inserting one synthetic, local-only `blog_posts` row directly into local D1 (gitignored `.wrangler/` state only, not a tracked seed file), matching the precedent already set in 05-06/05-07.

## User Setup Required

None - no external service configuration required. The synthetic blog post row lives only in the local, gitignored `.wrangler/` D1 state and was not added to any tracked seed file.

## Next Phase Readiness

- Every CMS block component a merchant-authored page can compose is now token-driven and scan-clean, and the CMS block dispatcher (`PageRenderer.tsx`) is confirmed to carry no colour of its own -- the phase's highest-risk omission (an untokenised block rendered at runtime on an unphotographed page) is closed.
- The blog index and blog post surfaces are token-driven and scan-clean, sharing the CMS story body's prose approach.
- All prose (`prose-invert prose-orange`) usages across this chunk -- 8 CMS block files plus the blog post body -- remain on Typography plugin defaults. This is a known, recorded gap for whichever future phase (likely Phase 6, when the light preset lands) wires custom typography colours off the CSS variables; until then, prose accent colour will not move with the theme even though the surrounding chrome does.
- `scripts/screenshot-routes.mjs`'s new `--include-content` flag is available for any later chunk that needs blog/CMS route evidence; it does not affect the default seven-route grid.
- The synthetic local-only blog post fixture remains in local D1 for any later plan that wants to screenshot blog content again; it is not part of any tracked seed file.
- `lib/utils/image-placeholders.ts` and `lib/types/mach/Promotion.ts` remain untouched and on the manual-review registry.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/pages/SectionCard.tsx
- FOUND: components/pages/PageCta.tsx
- FOUND: components/pages/PageHero.tsx
- FOUND: components/pages/LegalDocument.tsx
- FOUND: components/pages/FaqAccordion.tsx
- FOUND: components/pages/PageRail.tsx
- FOUND: components/pages/ContactGrid.tsx
- FOUND: components/pages/StoryBody.tsx
- FOUND: components/blog/BlogIndex.tsx
- FOUND: app/blog/page.tsx
- FOUND: app/blog/[slug]/page.tsx
- FOUND: scripts/screenshot-routes.mjs
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md
- FOUND commit: 0823d08
- FOUND commit: f413bf6
- FOUND commit: 5f2be33
