---
phase: 05-token-contract-component-sweep
plan: 05
subsystem: ui
tags: [tailwind, tokens, header, footer, promotional-banner, screenshot-diff]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end, the mechanism this plan substitutes class names against"
  - phase: 05-04
    provides: "all components/ui/* primitives scan-clean; the CSS-specificity pitfall pattern (unconditional consumer override vs. a primitive's now-real data-state class) this plan watched for in HeaderClient.tsx"
provides:
  - "the shared shell (HeaderClient, Header, Breadcrumbs, Footer, PromotionalBanner, app/layout.tsx's last two colour expressions) scan-clean against scripts/scan-hardcoded-colors.mjs"
  - "chunk-2-shell full seven-route screenshot coverage in 05-SCREENSHOTS.md, proving the frame every later chunk's screenshot sits inside did not move"
  - "two newly registered shade-consolidation snaps (S13, S14) covering the first appearance of Footer's near-black convergence and the mobile category cards' gray/orange convergence"
affects: [05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 7930
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-inverted main-set substitution for a light-on-dark override that isn't in the four scoped inverse-token surfaces: the header's white Categories dropdown panel uses bg-foreground/text-surface (both frozen main-set tokens whose values happen to be white/black) instead of the forbidden surface-inverse/on-inverse tokens, satisfying both D-16 pixel-preservation and the task's own automated inverse-token exclusion check"
    - "PIL ImageChops.difference bbox + pixel-pair sampling as the standard method for classifying an unexplained screenshot hash diff as a legitimate shade-consolidation snap vs. a defect, reused from 05-04's CategoryDisplay.tsx investigation"

key-files:
  created: []
  modified:
    - components/HeaderClient.tsx
    - components/Breadcrumbs.tsx
    - components/Footer.tsx
    - components/PromotionalBanner.tsx
    - app/layout.tsx
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "The Categories dropdown panel (HeaderClient.tsx's DropdownMenuContent override) maps bg-white/text-black to bg-foreground/text-surface, not to the inverse token set — the task's acceptance criteria explicitly forbid inverse-set tokens in this chunk's three files, and foreground (#ffffff) / surface (#000000) are both main-set tokens whose frozen values happen to equal white/black, so this substitution is both pixel-preserving and rule-compliant"
  - "PromotionalBanner's warning variant text (previously text-black on a yellow/amber background) maps to text-surface, not a new on-warning token — same reasoning as 05-04's on-danger decision: surface's value (#000000) is byte-identical to text-black, and the frozen 23-token contract has no on-warning slot to spend"
  - "app/layout.tsx's header Suspense fallback (bg-neutral-900) confirmed as a true no-op: neutral-900 and surface-elevated are both #171717"
  - "Footer.tsx's bg-neutral-950 -> bg-surface and HeaderClient.tsx's mobile category-card gray/orange shades -> muted-foreground/primary produced two new, previously-unregistered shade-consolidation snaps (S13, S14) rather than defects to revert -- both are directed by 05-TOKEN-MAP.md's own frozen substitution table and fall squarely under D-15's 'close-enough snaps are expected, not regressions' allowance; each was isolated with a PIL pixel diff before being annotated, never annotated blind"

patterns-established:
  - "When a screenshot cell differs from the immediately-prior chunk's capture with no obvious cause, isolate the diff region and sample before/after pixel values with PIL before deciding whether it's a registrable snap or a defect requiring a revert -- the token map's substitution table can mandate a value shift that was never visible until the specific file carrying that shade was finally swept"

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "HeaderClient.tsx, Header.tsx, and Breadcrumbs.tsx are scan-clean, use only main-set tokens (no inverse-set token class), and the build/lint/typecheck suite is green"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/HeaderClient.tsx / Header.tsx / Breadcrumbs.tsx -> 0 violations each"
        status: pass
      - kind: other
        ref: "grep -cE '(bg|text|border)-(surface-inverse|on-inverse|muted-on-inverse|border-inverse)' components/HeaderClient.tsx components/Header.tsx components/Breadcrumbs.tsx | grep -v ':0$' | wc -l -> 0"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build && npm run lint && npm run typecheck -> all pass (0 lint errors, 52 pre-existing warnings unchanged; typecheck clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Footer.tsx, PromotionalBanner.tsx, and app/layout.tsx's remaining colour expressions are scan-clean; the promotional banner genuinely reaches all four status tokens; the Sonner toaster and Suspense fallback carry no arbitrary-value custom-property class; the Clerk appearance prop is untouched"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/Footer.tsx / PromotionalBanner.tsx / app/layout.tsx -> 0 violations each"
        status: pass
      - kind: other
        ref: "for t in success warning danger info; do grep -q -- \"-$t\" components/PromotionalBanner.tsx || exit 1; done -> quartet-present"
        status: pass
      - kind: other
        ref: "grep -cE 'bg-\\(--store-' app/layout.tsx -> 0; grep -n appearance app/layout.tsx confirms Clerk block unchanged"
        status: pass
      - kind: other
        ref: "mise exec -- npm run test -> 244 test files / 1882 tests passed (matches 05-03/05-04's documented baseline); lint/typecheck clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk-2-shell full seven-route (minus deferred order-status), two-viewport screenshot grid captured and diffed cell-by-cell against chunk-2-ui; every resting and 1280-nav-open row is a byte-identical hash match, and every differing row (six 390-nav-open cells, three account cells) is root-caused via PIL pixel diff and registered as a new shade-consolidation snap (S13, S14), not left unexplained"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-2-shell --allow-missing -> captured 22 cell(s), 4 missing (matches the pre-existing order-status gap)"
        status: pass
      - kind: other
        ref: "chunk-2-shell and baseline sections both have 26 rows (row-count parity)"
        status: pass
      - kind: other
        ref: "PIL ImageChops.difference bbox + pixel sampling on all differing cells: account__* isolated to the footer's y-range (10,10,10)->(0,0,0); 390-nav-open cells isolated to gray/orange anti-aliased text and border-edge shifts, no layout/content change"
        status: pass
      - kind: manual_procedural
        ref: "visual read of home__1280__resting.png, home__1280__nav-open.png (dropdown panel), account__1280__resting.png (404 + footer), category__390__resting.png, and a side-by-side chunk-2-shell vs. chunk-2-ui comparison of home__390__nav-open.png"
        status: pass
    human_judgment: true
    rationale: "I visually inspected five representative captures plus a direct side-by-side pair for the largest pixel-diff (390 nav-open) and confirmed the header, footer, breadcrumb trail, and dropdown panel are indistinguishable to the eye at both viewports. A human should still skim the remaining screenshot pairs once and resize a live browser through the mobile breakpoint per this task's own human-check instruction, since a scripted hash/pixel diff plus a five-image spot check is not the same as a deliberate interactive QA pass."

# Metrics
duration: ~50min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 5: Shared Shell Sweep (Navigation, Footer, Banner, Layout) Summary

**The header, footer, breadcrumb trail, promotional banner, and root layout's last two colour expressions now speak only the 23-token contract, with a full seven-route screenshot diff proving the frame every later chunk's screenshot sits inside did not move — two small, expected shade-consolidation snaps (S13, S14) traced and registered, zero defects found.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-04T15:24:02Z
- **Tasks:** 3 completed
- **Files modified:** 6 (5 source files, 1 screenshot manifest)

## Accomplishments

- Swept `HeaderClient.tsx` (largest file in the chunk: desktop nav, Categories dropdown and its fallback list, mobile Sheet menu, mobile category cards) and `Breadcrumbs.tsx` to main-set tokens by role — every hover state that used a lighter/darker orange now uses `primary` with a reduced-alpha modifier, and every variant prefix and alpha suffix was preserved exactly. `Header.tsx` confirmed to carry zero colour classes, left unmodified.
- The Categories dropdown panel's white-background/black-text override (`bg-white text-black`) — not one of the four scoped inverse-token surfaces — maps to `bg-foreground text-surface`, both main-set tokens whose frozen values equal white/black, satisfying the pixel-preservation requirement and the task's automated "no inverse tokens in this chunk" check simultaneously.
- Swept `Footer.tsx` (surface, headings, hover links, muted copy, decorative watermark) and `PromotionalBanner.tsx`, whose variant map now genuinely reaches all four status tokens — success, warning, danger, and info — instead of collapsing into a single hue.
- Confirmed `app/layout.tsx`'s header Suspense fallback (`bg-neutral-900` → `bg-surface-elevated`) is a true no-op (`#171717` both ways), and that the Sonner toaster was already rewritten onto `primary`/`on-primary` tokens in 05-03 — no arbitrary-value custom-property class remains anywhere in the file, and the Clerk `appearance` prop is byte-identical.
- Captured the `chunk-2-shell` full coverage grid (22/26 cells; the 4 `order-status` cells MISSING, matching the pre-existing baseline gap) and diffed every row against `chunk-2-ui`: every `resting` and `1280 nav-open` row is a byte-identical SHA-256 match. The only differing rows — six `390 nav-open` cells and three `account` cells — were each root-caused with a `PIL.ImageChops.difference` pixel diff before being annotated, and registered as two new intentional shade-consolidation snaps (S13: Footer's `bg-neutral-950`→`bg-surface`, ~10/255 per-channel convergence to true black, visible only on the short 404 page where the footer sits in the captured viewport; S14: the mobile category cards' gray/orange shade convergence, first visible because `390 nav-open` is the only capture state that renders that content) rather than left unexplained or reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the navigation chrome** - `589054d` (feat)
2. **Task 2: Sweep the footer, promotional banner, and the layout's last two colour expressions** - `e36fc59` (feat)
3. **Task 3: Prove the shell frame did not move** - `0d34ce5` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/HeaderClient.tsx` - desktop/mobile nav, Categories dropdown (incl. fallback list), mobile Sheet menu, mobile category cards, all rewritten to main-set tokens
- `components/Header.tsx` - confirmed 0 colour occurrences; unmodified
- `components/Breadcrumbs.tsx` - trail, chevrons, and hover links rewritten to main-set tokens
- `components/Footer.tsx` - surface, headings, hover links, muted copy, and watermark rewritten
- `components/PromotionalBanner.tsx` - variant map rewritten to reach all four status tokens
- `app/layout.tsx` - header Suspense fallback moved to `bg-surface-elevated`; Sonner toaster and Clerk block confirmed already-correct/untouched
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-2-shell` section (26 rows) plus two new registered snaps (S13, S14) and a coverage note explaining both

## Decisions Made

- The Categories dropdown panel uses `bg-foreground text-surface` rather than the inverse token set, since it isn't one of the four scoped inverse surfaces and the task's own acceptance criteria forbid inverse tokens in this chunk — main-set tokens whose frozen values happen to equal white/black give a pixel-identical, rule-compliant result.
- PromotionalBanner's warning-variant text maps to `text-surface` (not a new `on-warning` token), matching 05-04's `on-danger` precedent: the frozen 23-token contract has no slot for a fifth "on-X" token, and `surface` (#000000) is byte-identical to the prior `text-black`.
- Two previously-unregistered shade-consolidation differences (Footer's near-black convergence, the mobile category cards' gray/orange convergence) were investigated with pixel diffs, confirmed as directed by the frozen substitution table and D-15's close-enough-snap allowance, and registered as new manifest snaps S13/S14 rather than reverted — reverting either would have meant leaving a raw Tailwind class in place, failing this plan's own `scan:tokens` acceptance criterion.

## Deviations from Plan

None - plan executed exactly as written. The two new snaps (S13, S14) are within the plan's own Task 3 instruction ("annotate each difference with... a defect to fix" implicitly allows registering a new, investigated snap — see 05-03's own precedent of adding S12 mid-plan), not a deviation from it.

## Issues Encountered

- A stale temp file at `/tmp/commit-msg-t1.txt` (left over from an earlier `05-01` session, same machine) caused the Task 1 commit's heredoc write to silently no-op (shell `noclobber`-style "file exists" error) and the subsequent `git commit -F` picked up the stale file's `05-01` message instead of the intended `05-05` one. Caught immediately by inspecting `git show --stat HEAD`; fixed with `git commit --amend` before any further work happened on top of it (own just-created commit, not shared history). No lasting effect. Documented here as a reminder that GSD scratchpad paths, not ad hoc `/tmp` filenames, avoid this class of collision.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shell (header, footer, breadcrumbs, promotional banner, and the root layout's last two colour expressions) is scan-clean and speaks only the frozen 23-token contract. Every later chunk (05-06 through 05-12) that captures a screenshot now measures its own change against a frame proven stable, not a moving one.
- Two new manifest snaps (S13, S14) are registered for any later chunk that captures a short page (404/account-adjacent) or the mobile nav-open state — those cells will legitimately continue to differ from `baseline`/`chunk-1-contract`/`chunk-2-ui` for the reasons already documented, not because of anything a later chunk's own sweep does.
- `order-status` coverage remains deferred (unchanged from 05-02's original note): whichever later chunk sweeps that route should seed a real local D1 order and re-run its own capture with `--order-id`.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/HeaderClient.tsx (modified)
- FOUND: components/Breadcrumbs.tsx (modified)
- FOUND: components/Footer.tsx (modified)
- FOUND: components/PromotionalBanner.tsx (modified)
- FOUND: app/layout.tsx (modified)
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md (modified)
- FOUND commit: 589054d
- FOUND commit: e36fc59
- FOUND commit: 0d34ce5
