---
phase: 05-token-contract-component-sweep
plan: 04
subsystem: ui
tags: [tailwind, shadcn, tokens, css-specificity, dropdown-menu, select, dialog]

# Dependency graph
requires:
  - phase: 05-03
    provides: "the frozen 23-token contract wired end to end (themes/volt-dark.css, tailwind.config.ts, getThemeTokens()), the mechanism this plan substitutes class names against"
provides:
  - "all 19 components/ui/* primitives scan-clean against scripts/scan-hardcoded-colors.mjs"
  - "chunk-2-ui screenshot coverage in 05-SCREENSHOTS.md, including two supplementary D-17 cells (dropdown-item focus, invalid-input ring)"
  - "the CSS-specificity pitfall this rewrite exposes when a consumer applies an unconditional override class alongside a primitive's now-real data-state variant class"
affects: [05-05, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 11537
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead-shadcn-class rewrite via exact-substring, word-boundary-safe substitution (bg-accent -> bg-surface-elevated, etc.) preserving every variant prefix and alpha-modifier suffix verbatim"
    - "Forcing a Tailwind utility to win a same-property CSS tie against a token-driven data-state variant requires the ! important modifier, not source-order reshuffling — Tailwind's data-[state=X]: variants compile to an attribute-selector-qualified rule (specificity 0,2,0), which now legitimately outranks a plain unconditional override class (0,1,0) once the underlying token exists"

key-files:
  created: []
  modified:
    - components/ui/button.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/select.tsx
    - components/ui/navigation-menu.tsx
    - components/ui/dialog.tsx
    - components/ui/alert-dialog.tsx
    - components/ui/sheet.tsx
    - components/ui/loading.tsx
    - components/ui/badge.tsx
    - components/ui/table.tsx
    - components/ui/card.tsx
    - components/ui/input.tsx
    - components/ui/textarea.tsx
    - components/ui/checkbox.tsx
    - components/ui/switch.tsx
    - components/ui/toggle.tsx
    - "app/category/[slug]/CategoryDisplay.tsx"
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "text-white on a bg-destructive/bg-danger button/badge maps to text-foreground, not a new on-danger token — foreground's volt-dark value (#ffffff) is byte-identical to what text-white rendered, so this substitution is pixel-preserving (D-16) rather than a design choice, and the 23-token contract has no on-danger slot to spend"
  - "bg-black (the dialog/alert-dialog/sheet overlay scrim) maps to bg-surface, not left as a raw class — surface's volt-dark value (#000000) is byte-identical to bg-black, so the overlay's alpha-modified variants (bg-surface/50, bg-surface/80) render pixel-identically while eliminating the last raw palette literal in these files"
  - "ring-offset-background (dialog.tsx, sheet.tsx close buttons) maps to ring-offset-surface even though it wasn't flagged by scan-hardcoded-colors.mjs's prefix list — it is the same class of dead-shadcn-variable bug this task exists to fix, left unaddressed it would have stayed silently broken past this chunk's own screenshot-diff gate"

patterns-established:
  - "When a token substitution turns a previously-dead data-state/aria-* variant class into a real CSS rule, any consumer applying an unconditional override class for the same property must be re-checked for a specificity collision — grep-based scan-clean is necessary but not sufficient; a full-tree screenshot diff against a pre-sweep baseline is what actually catches this class of regression, per D-16/T-05-04-03"

requirements-completed: [TOKEN-03, TOKEN-05]

coverage:
  - id: D1
    description: "All 16 of the 19 components/ui/* primitives carrying palette occurrences are rewritten to the 23-token contract in place; the three expected-clean files (label.tsx, separator.tsx, toggle-group.tsx) were opened and confirmed to already carry no colour class"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "mise exec -- npm run scan:tokens -- --path components/ui -> [scan-tokens] 0 violations"
        status: pass
      - kind: other
        ref: "git diff --name-only tailwind.config.ts -> empty (no config alias layer added, D-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every rewritten class preserves its variant-prefix chain (dark/hover/focus/focus-visible/aria-invalid/data-state) and alpha-modifier suffix exactly; text-muted-foreground is untouched everywhere (15 occurrences before and after); bg-primary/text-primary/border-primary are untouched"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "grep -c 'text-muted-foreground' components/ui/*.tsx -> 15 (unchanged); manual diff review of all 16 rewritten files confirms every prefix/suffix survives substitution verbatim"
        status: pass
      - kind: other
        ref: "mise exec -- npm run build -> succeeds; .next/static/css/*.css contains a bg-danger rule and a bg-surface-elevated rule; grep -o 'bg-primary...{...}' confirms bg-primary still resolves through --store-primary"
        status: pass
    human_judgment: false
  - id: D3
    description: "mise exec -- npm run test / typecheck / lint all pass with zero regressions after every task in this plan (1882/1882 tests, 0 typecheck errors, 0 lint errors / 52 pre-existing warnings unchanged)"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "npm run test -> 244 test files / 1882 tests passed; npm run typecheck -> clean; npm run lint -> 0 errors, 52 warnings (matches 05-03's documented pre-existing baseline)"
        status: pass
    human_judgment: false
  - id: D4
    description: "chunk-2-ui screenshot coverage captured and diffed against the pre-sweep baseline: 22/26 standard cells captured (4 order-status cells MISSING, matching the baseline's own documented gap), every differing row attributed to either S12 (pre-existing 05-03 fix, unrelated to this chunk) or a D-17 newly-visible interaction state, plus two supplementary D-17 cells beyond the standard grid"
    requirement: "TOKEN-05"
    verification:
      - kind: other
        ref: "mise exec -- node scripts/screenshot-routes.mjs --label chunk-2-ui --allow-missing -> captured 22 cell(s), 4 missing; scripted hash diff against baseline (this session) confirms only the 3 account rows differ, all hash-identical to chunk-1-contract's already-documented S12 fix"
        status: pass
      - kind: other
        ref: "awk '/^\\| /' 05-SCREENSHOTS.md | wc -l -> 97 (gt 40 required by the plan's own verify command)"
        status: pass
      - kind: manual_procedural
        ref: "visual read of category__1280__resting.png (before/after the Rule 1 fix), category__1280__dropdown-item-focused.png, and checkout__1280__discount-input-invalid.png"
        status: pass
    human_judgment: true
    rationale: "I diffed all 26 standard rows programmatically (byte-for-byte hash comparison, twice for determinism) and visually inspected the three new/changed images described in <verify>'s human-check. A human should still click through the account dropdown, navigation menu, a focused invalid field, and a hovered button in the live storefront once, per this task's own human-check instruction, since a scripted hash diff plus a targeted image review is not the same as a deliberate interactive QA pass."
  - id: D5
    description: "A CSS-specificity regression this plan's own token rewrite exposed on a file outside its edit scope (app/category/[slug]/CategoryDisplay.tsx's sort-toggle active-state override) was found via the screenshot diff, root-caused, and fixed, then re-verified byte-identical to baseline"
    requirement: "TOKEN-03"
    verification:
      - kind: other
        ref: "PIL ImageChops.difference bbox before fix: (real diff region over the Featured toggle); after !bg-orange-500 !text-black fix: category resting/nav-open hashes byte-identical to baseline across two independent capture runs"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-04
status: complete
---

# Phase 5 Plan 4: Component Sweep Chunk 2 (shadcn Primitives) Summary

**All 19 `components/ui/*` shadcn primitives now speak only the 23-token contract — dead classes like `bg-accent`, `bg-popover`, `bg-destructive`, and `bg-input` are rewritten to real tokens, making hover/focus/selected/invalid states visible for the first time across dropdowns, the nav menu, select, dialogs, and buttons — and a CSS-specificity regression that rewrite silently caused on an unrelated page was caught by the chunk's own screenshot diff and fixed.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-04T15:09:00Z
- **Tasks:** 3 completed
- **Files modified:** 18 (16 `components/ui/*.tsx`, 1 `app/category/[slug]/CategoryDisplay.tsx` deviation fix, 1 `05-SCREENSHOTS.md`)

## Accomplishments

- Rewrote the seven interaction-heavy primitives (`button`, `dropdown-menu`, `select`, `navigation-menu`, `dialog`, `alert-dialog`, `sheet`): every dead shadcn class (`bg-accent`, `bg-popover`, `bg-secondary`, `bg-input`, `bg-background`, `bg-black` overlay scrim, `ring-offset-background`, `text-primary-foreground`, `text-accent-foreground`, `text-popover-foreground`) rewritten to the frozen contract per `05-TOKEN-MAP.md` §2b, with every variant-prefix chain and alpha-modifier suffix preserved byte-for-byte.
- Rewrote the nine remaining primitives (`loading`, `badge`, `table`, `card`, `input`, `textarea`, `checkbox`, `switch`, `toggle`); `loading.tsx`'s raw Tailwind palette classes (`bg-neutral-800/700`, `border-orange-500`) mapped to `bg-surface-elevated` and `border-primary` by role. Confirmed `label.tsx`, `separator.tsx`, and `toggle-group.tsx` already carried no colour class — left unmodified.
- `mise exec -- npm run scan:tokens -- --path components/ui` reports `0 violations` across the full 19-file directory; `tailwind.config.ts` untouched (no alias layer, per D-17); full build/test/typecheck/lint suite green throughout.
- Captured `chunk-2-ui` screenshot coverage (22/26 cells; the 4 `order-status` cells MISSING, matching the baseline's own pre-existing gap) and diffed every row against the pre-sweep `baseline` — plus two supplementary D-17 cells beyond the standard grid: the Categories dropdown's first item focused via keyboard nav (revealing the previously-dead `focus:bg-accent` highlight, now `focus:bg-surface-elevated`), and the checkout discount-code input with `aria-invalid` forced true (revealing the previously-dead `aria-invalid:ring-destructive`, now `aria-invalid:ring-danger`).
- **Found and fixed a real CSS-specificity regression the token rewrite exposed**, not merely documented it: `app/category/[slug]/CategoryDisplay.tsx`'s sort-toggle "Featured" indicator lost its orange active-state highlight once `toggle.tsx`'s `data-[state=on]:bg-accent` became a real, higher-specificity rule (`data-[state=on]:bg-surface-elevated`, specificity 0,2,0) that now legitimately outranks the page's own unconditional `bg-orange-500` override (0,1,0) — before this chunk, `bg-accent` generated no CSS rule at all, so the override always won by default with no real contest. Fixed by marking the override `!important`, restoring the exact prior pixel (verified byte-identical to baseline across two independent capture runs).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the interaction-heavy primitives** - `770c994` (feat)
2. **Task 2: Rewrite the remaining primitives and confirm the clean ones** - `cf5b3cd` (feat)
3. **Task 3: Capture the newly-visible interaction states** - `53ca57e` (feat, includes the CategoryDisplay.tsx Rule 1 fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/ui/button.tsx` - `cva()` variant block rewritten to contract tokens (`text-on-primary`, `bg-danger`, `bg-surface-elevated`, `border-border`)
- `components/ui/dropdown-menu.tsx` - `bg-popover`/`bg-accent`/`text-destructive` family rewritten; 6 rewritten class strings
- `components/ui/select.tsx` - trigger, content, and item classes rewritten
- `components/ui/navigation-menu.tsx` - trigger, viewport, content, and link classes rewritten (10 `bg-accent` occurrences alone)
- `components/ui/dialog.tsx` - overlay (`bg-black/80` -> `bg-surface/80`), content (`bg-background` -> `bg-surface`), close button `ring-offset-background` -> `ring-offset-surface`
- `components/ui/alert-dialog.tsx` - overlay and content classes rewritten
- `components/ui/sheet.tsx` - overlay, content, and close button classes rewritten
- `components/ui/loading.tsx` - raw Tailwind palette (`neutral-800/700`, `orange-500`) mapped to tokens by role
- `components/ui/badge.tsx` - all four variants rewritten
- `components/ui/table.tsx` - footer and row `bg-muted` occurrences rewritten
- `components/ui/card.tsx` - `bg-card`/`text-card-foreground` rewritten
- `components/ui/input.tsx` - `border-input`, `bg-input`, `ring-destructive`, `text-primary-foreground` rewritten
- `components/ui/textarea.tsx` - same family as input.tsx
- `components/ui/checkbox.tsx` - same family plus `data-[state=checked]` variants
- `components/ui/switch.tsx` - track and thumb classes rewritten
- `components/ui/toggle.tsx` - base + outline variant classes rewritten
- `app/category/[slug]/CategoryDisplay.tsx` - Rule 1 fix: `toggleClass()`'s active-state override marked `!important` to survive the now-real `data-[state=on]` specificity
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - `chunk-2-ui` section (26 rows) plus a 2-row supplementary D-17 section

## Decisions Made

- `text-white` on a danger-background button/badge maps to `text-foreground` (both `#ffffff` under `volt-dark`) rather than inventing an `on-danger` token — pixel-preserving, and the frozen 23-token contract has no slot to spend on a fifth "on-X" token.
- `bg-black` (dialog/alert-dialog/sheet overlay scrim) maps to `bg-surface` (`#000000`, byte-identical) rather than being left as a raw class, so the overlay's alpha modifiers (`/50`, `/80`) stay pixel-identical while removing the last raw literal from these files.
- `ring-offset-background` was rewritten to `ring-offset-surface` even though the scanner's prefix list doesn't flag it — it's the same class of dead-shadcn-variable bug this task exists to fix, and leaving it would have kept the dialog/sheet close-button's focus ring-offset silently broken past this chunk's own gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS-specificity regression on CategoryDisplay.tsx's sort-toggle active indicator**
- **Found during:** Task 3's screenshot diff (`category` route's `resting`/`nav-open`/`390-resting` cells hash-differed from baseline with no interactive control involved — a resting-state difference the task's own acceptance criteria forbid leaving unexplained)
- **Issue:** `CategoryDisplay.tsx`'s `toggleClass()` helper applies an unconditional `bg-orange-500 text-black` override when a sort toggle is active. Before this chunk, `toggle.tsx`'s `data-[state=on]:bg-accent` compiled to no CSS rule at all (`accent` was undefined), so the override always won trivially. After Task 2 rewrote it to `data-[state=on]:bg-surface-elevated` — a real rule with specificity `(0,2,0)` from the attribute selector — it legitimately outranked the plain `(0,1,0)` override, silently dropping the intended orange highlight on the default-selected "Featured" toggle.
- **Fix:** Marked the active-state override `!important` (`!bg-orange-500 !text-black`), restoring the exact original pixel regardless of the now-real specificity tie.
- **Files modified:** `app/category/[slug]/CategoryDisplay.tsx`
- **Verification:** Re-captured `category` route screenshots twice independently; both runs produced hashes byte-identical to the `baseline` label for `resting` and `390 resting`/`nav-open` (the only genuine difference left, `1280 nav-open`, traced separately to Playwright image-load timing nondeterminism, confirmed by a third manual re-capture that matched baseline exactly).
- **Committed in:** `53ca57e`

---

**Total deviations:** 1 auto-fixed (Rule 1 — a regression this plan's own change caused, on a file outside the plan's original edit scope but squarely within the deviation rules' "fix bugs found during the task" mandate). **Impact:** Necessary for correctness — without it, the default-selected sort toggle would have silently lost its active-state indicator store-wide. No scope creep: the fix is a single `!important` addition, not a redesign, and it restores rather than changes the rendered pixel.

## Issues Encountered

- One `category__1280__nav-open` capture attempt showed a spurious hash difference traced to Playwright/image-loading race timing (the product thumbnail's alt-text briefly visible before the image finished loading), not a CSS regression — confirmed by a clean re-capture producing a hash byte-identical to `baseline`. Documented here because a flaky capture that "looks like" a regression is exactly the kind of thing worth being explicit about, not because it affected the final result.
- `mv -i` (interactive alias, same as noted in 05-03's summary) blocked a manifest-truncation step silently; caught immediately via `wc -l` not matching expectations, resolved with `\cp -f`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 19 `components/ui/*` primitives are now scan-clean and speak only the token contract; every later chunk (05-05 through 05-12) that renders these primitives inherits correctly-wired hover/focus/selected/invalid states with no further work needed on the primitives themselves.
- The CSS-specificity pitfall this plan surfaced (a consumer's unconditional override colliding with a primitive's now-real `data-state`/`aria-*` variant) is a pattern later chunks should watch for wherever a page applies a hardcoded className override to a `components/ui/*` primitive — `HeaderClient.tsx`'s Categories dropdown, `ProductDisplay.tsx`'s variant Select, `ShippingForm.tsx`'s country Select, and `ProductReviewsSection.tsx`'s filter/sort Selects all carry such overrides today and are scheduled for later chunks (05-05 shared shell; 05-06/07/08 home+category+product).
- `chunk-2-ui`'s screenshot coverage confirms zero unexplained visual regressions; the only differing cells are the pre-existing S12 fix (account/404, from 05-03) and the two intentionally-added D-17 supplementary cells.

---
*Phase: 05-token-contract-component-sweep*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: components/ui/button.tsx (modified)
- FOUND: components/ui/dropdown-menu.tsx (modified)
- FOUND: components/ui/select.tsx (modified)
- FOUND: components/ui/navigation-menu.tsx (modified)
- FOUND: components/ui/dialog.tsx (modified)
- FOUND: components/ui/alert-dialog.tsx (modified)
- FOUND: components/ui/sheet.tsx (modified)
- FOUND: components/ui/loading.tsx (modified)
- FOUND: components/ui/badge.tsx (modified)
- FOUND: components/ui/table.tsx (modified)
- FOUND: components/ui/card.tsx (modified)
- FOUND: components/ui/input.tsx (modified)
- FOUND: components/ui/textarea.tsx (modified)
- FOUND: components/ui/checkbox.tsx (modified)
- FOUND: components/ui/switch.tsx (modified)
- FOUND: components/ui/toggle.tsx (modified)
- FOUND: app/category/[slug]/CategoryDisplay.tsx (modified)
- FOUND: .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md (modified)
- FOUND commit: 770c994
- FOUND commit: cf5b3cd
- FOUND commit: 53ca57e
