---
phase: 06-theme-file-mechanism-presets
plan: 05
subsystem: theming
tags: [visual-qa, screenshot-harness, light-preset, scrim, accessibility-contrast]

# Dependency graph
requires:
  - phase: 06-03
    provides: "themes/midnight.css, themes/luxe.css (23-token contract), the three-entry manifest"
  - phase: 06-04
    provides: "the admin Appearance save path (POST /api/admin/settings, x-dev-admin dev-bypass header) used to switch presets for capture"
provides:
  - ".planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md — per-preset route-grid captures, the light-preset findings table, the change register, and the phase-close evidence roll-up"
  - "Dark-alpha, polarity-independent scrims in components/ui/dialog.tsx, components/ui/alert-dialog.tsx, components/ui/sheet.tsx"
affects: [07, 08]

# Actuals (#2632)
actuals:
  tokens: 11400
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-DOM compositing injection test (navigate a real page under the real compiled CSS, inject a div with the exact Tailwind class under test, screenshot) as a substitute for a live UI trigger that isn't reachable in an unauthenticated/no-seeded-data environment — used for the two scrim sites (Dialog, AlertDialog) this session couldn't otherwise trigger"
    - "Read a live element's computed style (getComputedStyle) as evidence a token-driven class resolves exactly as specified, distinct from judging whether the resulting visual effect achieves its design intent"

key-files:
  created:
    - .planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md
  modified:
    - components/ui/dialog.tsx
    - components/ui/alert-dialog.tsx
    - components/ui/sheet.tsx

key-decisions:
  - "This plan's own three capture labels (phase-06-05-volt-dark/midnight/luxe) went into a new, phase-scoped .planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md rather than appending to Phase 5's 05-SCREENSHOTS.md — the plan's own frontmatter and verify commands target this new path. The screenshot harness's --manifest flag defaults to the Phase 5 file; the first capture run used that default by mistake, was caught before committing, and the three label sections were moved (not re-captured) into the correct file. 05-SCREENSHOTS.md was restored byte-for-byte to its pre-06-05 state."
  - "Dialog, AlertDialog, and Sheet overlays (bg-surface/80, bg-surface/50 x2) changed to a literal bg-black/NN wrapped in the token scanner's existing gsd:scan-ignore sentinel, per D-04's 'scrims stay black-alpha' rule — verified live (Sheet's computed style under an open cart drawer: oklab ~0.97 lightness / 0.5 alpha, i.e. --store-surface at 50%, visually indistinguishable from the luxe page behind it) and via a live-DOM compositing test for the two sites unreachable by a live trigger in this environment (Dialog: gated behind a completed Stripe checkout that fails locally; AlertDialog: admin-only, no Clerk session)."
  - "The category hero overlay (app/category/[slug]/page.tsx, bg-surface/40) was inspected and accepted as-is rather than fixed for consistency with the other three — its job (contrast for overlaid heading text) differs from a modal-obscuring backdrop, it is the weakest of the three opacities, and a realistic synthetic reproduction (matching the real text-foreground heading/body markup) showed legible black text and a natural photo-lightening effect rather than an unintended light haze. Recorded as a deliberate, evidence-based 'accept', not an omission."
  - "The Phase 5 carry-over question about border-inverse serving both drawer edges and email dividers is unaffected by this phase: themes/luxe.css and themes/midnight.css each declare their own independent border-inverse value (luxe: #2b221a, a dark tone matched to luxe's own dark inverse panel), so there is no cross-theme leakage — the original question is scoped entirely to volt-dark's own single value serving two consumers, and remains open for a future token split if the email divider still reads badly."

requirements-completed: [THEME-04]

coverage:
  - id: D1
    description: "Every shipped preset (volt-dark, midnight, luxe) has a captured route grid across the harness's seven routes at both viewports and interactive states, taken while that preset was actually the served theme, extending rather than duplicating 06-02/06-03's earlier captures"
    requirement: THEME-04
    verification:
      - kind: integration
        ref: ".screenshots/phase-06-05-{volt-dark,midnight,luxe}/ (22 cells captured / 4 missing per run — the pre-existing Phase 5 order-status gap); each run's data-theme attribute confirmed via curl before capture"
        status: pass
      - kind: other
        ref: "mise exec -- npm run scan:tokens (0 violations, unchanged manual-review rows) — nothing in Task 1 changed source"
        status: pass
    human_judgment: false
  - id: D2
    description: "The light preset's four UI-SPEC-located scrim sites (Dialog, AlertDialog, Sheet, category hero) were each inspected deliberately against a real dark-preset baseline, with a written judgement (accepted or changed) and reason for every site"
    requirement: THEME-04
    verification:
      - kind: manual_procedural
        ref: "06-SCREENSHOTS.md Task 2 Findings table (F1-F4): live DOM computed-style check + before/after screenshots for the Sheet overlay; live-DOM compositing injection tests for Dialog/AlertDialog and the category hero, reproducing the exact Tailwind classes and (for the hero) the real component markup against the real compiled CSS"
        status: pass
    human_judgment: true
    rationale: "The plan's own Task 2 <verify> carries an explicit <human-check> (open a modal/alert-dialog/drawer/sheet/category hero under luxe vs. a dark preset and judge whether the backdrop recedes content). No Clerk session or seeded checkout exists in this environment to drive that literal walkthrough. Substituted the closest available equivalent evidence (live computed-style reads, before/after screenshots, and compositing-injection tests against the real compiled CSS and real component classes) rather than skip the judgement — but a human eye on the actual rendered UI has not confirmed it, so this is not auto-passable."
  - id: D3
    description: "Fixes are scoped case-by-case (three of four sites changed, one accepted), keep the 23-token contract frozen, introduce no shared overlay class, and use the token scanner's existing sentinel mechanism with a written reason for the literal dark values that were required"
    requirement: THEME-04
    verification:
      - kind: other
        ref: "for f in themes/*.css; token count == 23 (all three files); mise exec -- node scripts/build-themes.mjs --check; mise exec -- npm run scan:tokens (0 violations, sentinel-excluded); mise exec -- npm run lint / typecheck / test (248 files / 1932 tests) / build — all exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The phase-close record answers each of Phase 6's four ROADMAP success criteria with named evidence, lists every carried-forward item with why it is open and where to pick it up, and names the still-outstanding NEXT_PUBLIC_THEME_DEFAULT Workers Build variable as a human action"
    requirement: THEME-04
    verification:
      - kind: other
        ref: "06-SCREENSHOTS.md Task 3 section; grep -c 'build:worker' >=1, grep -c 'THEME-0' >=4; full gate suite re-run at close (build-themes --check, scan:tokens, lint, typecheck, npm test, npm run build) all green"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 6 Plan 5: Preset Screenshot Sweep and Light-Preset Acid Test Summary

**Every shipped preset now has a real route-grid capture, and the light preset's acid test found three token-driven modal/drawer scrims (Dialog, AlertDialog, Sheet) that silently failed under a light theme — a near-white-on-near-white overlay that composited to an invisible backdrop instead of a scrim — fixed to a literal dark-alpha value via the token scanner's existing sentinel, while the fourth flagged site (the category hero overlay) was inspected and deliberately left as-is.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-04T20:19:00Z (approx.)
- **Completed:** 2026-09-04T20:54:00Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Captured `phase-06-05-volt-dark`, `phase-06-05-midnight`, and `phase-06-05-luxe` — the full D-20 seven-route grid at both viewports and all interactive states, for all three shipped presets, in one session against a shared dark-preset baseline (so Task 2's light-preset comparison is apples-to-apples, not against an older plan's capture). Each run: 22 cells captured, 4 missing (the same pre-existing Phase 5 `order-status` gap — no seeded order in this environment). Theme switched via `POST /api/admin/settings` with the documented `x-dev-admin` dev-bypass header; served `data-theme` attribute confirmed via `curl` before every capture. Stored `appearance.theme` restored to the manifest default (`volt-dark`) at the end.
- Caught and corrected a manifest-path mistake before committing: the screenshot harness's `--manifest` flag defaults to `05-SCREENSHOTS.md`, but this plan's own file target is a new `06-SCREENSHOTS.md`. Moved the three label sections (not re-captured — the images on disk were already correct) into the right file and restored `05-SCREENSHOTS.md` to its exact pre-06-05 byte state.
- Ran the light-preset acid test against all four UI-SPEC-located scrim sites (`dialog.tsx:106`, `alert-dialog.tsx:39`, `sheet.tsx:128`, `app/category/[slug]/page.tsx:133`), all sharing the token-driven `bg-surface/NN` class. Verified live wherever a trigger exists in this environment (the cart drawer's `SheetOverlay` computed style under `luxe`: `oklab(~0.97 lightness / 0.5 alpha)` — i.e. `--store-surface` at 50%, confirmed visually indistinguishable from the page behind it via before/after screenshots) and via a live-DOM compositing injection test (navigate a real page, inject the exact Tailwind class over a photographic gradient, screenshot) for the two sites this environment cannot reach live (`Dialog`'s checkout-confirmation modal; `AlertDialog`, admin-only, no Clerk session).
- Fixed three of the four sites (`Dialog`, `AlertDialog`, `Sheet`) to a literal `bg-black/NN`, each wrapped in the token scanner's existing `gsd:scan-ignore-start`/`-end` sentinel with a written reason in the surrounding comment — no new token, no shared overlay class, `scan:tokens` stays at 0 violations. Accepted the fourth (category hero, `bg-surface/40`) as-is after a realistic reproduction (real `text-foreground` markup, real classes) showed legible text and a natural lightening effect rather than an unintended haze — recorded with its own written reason, since a QA pass that only records changes never actually considered leaving anything alone.
- Re-checked the Phase 5 carry-over about `border-inverse` serving both drawer edges and email dividers: confirmed `luxe.css`/`midnight.css` each declare their own independent value (not shared across themes), so the question is unaffected by this phase and remains scoped to `volt-dark` alone — carried forward, not resolved here.
- Re-captured the light preset post-fix (`phase-06-05-luxe-postfix`) so the record holds both the before and after grid, per the plan's own instruction.
- Wrote the phase-close roll-up: quoted all four ROADMAP Phase 6 success criteria with named evidence from this plan and 06-01 through 06-04, re-ran the full gate suite fresh at close (`build-themes --check`, `scan:tokens`, `lint`, `typecheck`, `npm test` — 248 files / 1932 tests, `npm run build` — all green), and listed every carried-forward item (Phase 5 screenshot gaps, the border-inverse question, the dropped-properties backlog, the env-default telemetry decision, WINDOWS #1-3, and the still-outstanding `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable as a named human action).

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture every preset across the route grid** - `3686c30` (feat)
2. **Task 2: The light-preset acid test — inspect, judge, fix only what reads wrong** - `c91c80e` (fix)
3. **Task 3: Phase-close evidence roll-up** - `73dc85e` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` - per-preset captures, light-preset findings/change register, phase-close roll-up
- `components/ui/dialog.tsx` - `DialogOverlay` scrim: `bg-surface/80` → `bg-black/80` (sentinel-wrapped)
- `components/ui/alert-dialog.tsx` - `AlertDialogOverlay` scrim: `bg-surface/50` → `bg-black/50` (sentinel-wrapped)
- `components/ui/sheet.tsx` - `SheetOverlay` scrim: `bg-surface/50` → `bg-black/50` (sentinel-wrapped)

## Decisions Made

- **New phase-scoped screenshot file, not an append to Phase 5's.** This plan's frontmatter and verify commands both target `.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` specifically — a deliberate departure from 06-02/06-03's default-path captures, which live in `05-SCREENSHOTS.md`. Not revisited retroactively for those two plans; only this plan's own captures moved.
- **Case-by-case scrim disposition: three changed, one accepted.** Applying the identical fix to all four sites "for consistency" would have been the easier path but not the evidence-driven one — the category hero's different job (text contrast on a permanent background, not full-page modal obscuring), its weaker opacity, and its still-legible synthetic reproduction supported a genuinely different outcome. D-04 explicitly asks for case-by-case judgement, not a blanket rule.
- **Live-DOM compositing injection as the evidentiary substitute for an unreachable UI trigger.** Rather than skip judging Dialog/AlertDialog because no Clerk session or completed checkout exists in this environment, navigated a real page under the real compiled CSS and injected the exact class under test — this resolves the exact CSS custom properties production would, unlike a purely analytical/mathematical estimate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue, self-caught] Screenshot harness's default `--manifest` path did not match this plan's target file**
- **Found during:** Task 1, before committing
- **Issue:** `scripts/screenshot-routes.mjs --label ...` defaults `--manifest` to `05-SCREENSHOTS.md`. Running the three capture commands without an explicit `--manifest` flag (following the plan's literal `<verification>` command text, which omits the flag) appended all three label sections to Phase 5's file instead of this plan's own `06-SCREENSHOTS.md`.
- **Fix:** Moved the three label sections (raw capture tables — the underlying `.screenshots/` image files on disk were already correct and did not need re-capturing) from `05-SCREENSHOTS.md` into a newly created `06-SCREENSHOTS.md`, and restored `05-SCREENSHOTS.md` to its exact byte-for-byte pre-06-05 state (verified via `git diff` showing no residual diff on that file).
- **Files modified:** `.planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md` (created); `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` (touched, then restored, net no diff)
- **Verification:** `git status --short` shows no change to `05-SCREENSHOTS.md`; the new file's acceptance criteria (`grep -c 'phase-06-05-' >= 3`, `.screenshots` label count `>= 3`) both pass.
- **Committed in:** `3686c30`

---

**Total deviations:** 1 auto-fixed (Rule 3 — a self-caught tooling default-path mismatch, corrected before any commit landed with content in the wrong file). **Impact:** No re-capture was needed (images on disk were already correct); the fix was purely a matter of which manifest file recorded them. No scope creep.

## Issues Encountered

- **Two of the four scrim sites had no live trigger reachable in this environment.** `Dialog`'s only storefront consumer (`OrderConfirmationModal`) requires a completed Stripe checkout, which fails locally (known Phase 5 gap, `payment-intent` 400); `AlertDialog` is used only inside the admin tree, which requires a Clerk session unavailable here (the same limitation WINDOWS #2 already records for plan 06-04). Substituted a live-DOM compositing injection test — navigating a real page and injecting the exact Tailwind class under the real compiled CSS — as the closest available evidence, and cross-confirmed the mechanism (not just the visual guess) via `SheetOverlay`'s live computed-style read under the cart drawer, which shares the identical `--store-surface`-based class family. Recorded as coverage D2's `human_judgment: true` rather than claiming a full pass.
- **The local D1 fixture's one category has no configured image URL**, so the category hero overlay's real in-app rendering shows a broken-image icon rather than a photo — the F4 "accepted as-is" judgement rests on a realistic synthetic reproduction (the component's actual markup and classes, a photographic gradient standing in for a real photo) rather than a live capture. Recorded as a carried-forward item in the phase-close roll-up, worth a real look once a category has a configured image.

## User Setup Required

None new. The `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable flagged in plan 06-02's user setup remains outstanding — restated as a named human action in this plan's phase-close roll-up (no evidence found in this session or `STATE.md` that it was completed).

## Next Phase Readiness

- Phase 6 is complete: all four requirements (THEME-01 through THEME-04) have named evidence in `06-SCREENSHOTS.md`'s phase-close section, and the full gate suite (`build-themes --check`, `scan:tokens`, `lint`, `typecheck`, `npm test`, `npm run build`) is green at close.
- The light-preset acid test's actual result: **it did expose dark-tuned leftovers** — three of the four inspected sites (`Dialog`, `Sheet`, `AlertDialog`) shared one `bg-surface/NN` overlay pattern whose polarity assumption broke under `luxe`, all three fixed the same way (a literal dark-alpha value, sentinel-wrapped); the fourth (category hero) was inspected and did not exhibit the same failure.
- Everything carried forward is listed with where to pick it up in `06-SCREENSHOTS.md`'s Task 3 section: Phase 5's four screenshot coverage gaps (still open, needs a seeded order and a Clerk session), the `border-inverse` dual-role question (re-checked, confirmed unaffected by this phase, still open within `volt-dark`), the dropped-properties backlog, the env-default telemetry decision, WINDOWS #1-3, and the `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable.
- Phase 7 (Layout Switches) and Phase 8 (Documentation & Visual QA Close-out) both inherit a stable three-preset theme mechanism with no open scrim-polarity defects on the four sites this phase located.

---
*Phase: 06-theme-file-mechanism-presets*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: .planning/phases/06-theme-file-mechanism-presets/06-SCREENSHOTS.md
- FOUND: components/ui/dialog.tsx
- FOUND: components/ui/alert-dialog.tsx
- FOUND: components/ui/sheet.tsx
- FOUND commit: 3686c30 (Task 1)
- FOUND commit: c91c80e (Task 2)
- FOUND commit: 73dc85e (Task 3)
- Re-ran plan-level verification: `for f in themes/*.css` token count == 23 for all three
  shipped themes; `mise exec -- node scripts/build-themes.mjs --check` (fresh); `mise exec --
  npm run scan:tokens` (0 violations, 2 unchanged manual-review rows); `mise exec -- npm run
  lint` (0 errors, 52 pre-existing warnings); `mise exec -- npm run typecheck` (clean); `mise
  exec -- npm test` (248 files / 1932 tests, all green); `mise exec -- npm run build` (exit 0);
  stored `appearance.theme` confirmed back at `volt-dark` in local D1; dev server stopped.
