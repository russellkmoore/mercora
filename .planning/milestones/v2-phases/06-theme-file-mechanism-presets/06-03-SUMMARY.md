---
phase: 06-theme-file-mechanism-presets
plan: 03
subsystem: theming
tags: [theme-presets, css-tokens, d1-settings, accessibility-contrast]

# Dependency graph
requires:
  - phase: 06-01
    provides: "scripts/build-themes.mjs validator/codegen, THEME_MANIFEST, DEFAULT_THEME_NAME"
  - phase: 06-02
    provides: "getActiveTheme() (D1 -> env -> manifest default), APPEARANCE_SETTINGS_CATEGORY, APPEARANCE_THEME_SETTING_KEY, the Cormorant Garamond CSS variable exposed by app/layout.tsx"
provides:
  - "themes/midnight.css — second dark preset, 23-token contract, manifest name 'midnight'"
  - "themes/luxe.css — light preset, 23-token contract, manifest name 'luxe'"
  - "Regenerated themes/index.generated.css (3 imports) and lib/themes/manifest.generated.ts (3 entries), committed and check-clean"
  - ".planning/todos/pending/theme-contract-dropped-properties.md — backlog record of D-03's dropped direction-doc properties"
affects: [06-04, 06-05]

# Actuals (#2632)
actuals:
  tokens: 6300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preset authoring mirrors themes/volt-dark.css's exact structure (head comment, @theme label header, single attribute-selector block, four grouped comment sections) rather than inventing a new layout per file"
    - "Deliberate accessibility corrections (contrast-failing doc values replaced with corrected hex) are called out in both the theme file's own head comment and the SUMMARY, so a later QA pass knows which values were chosen rather than derived"

key-files:
  created:
    - themes/midnight.css
    - themes/luxe.css
    - .planning/todos/pending/theme-contract-dropped-properties.md
  modified:
    - themes/index.generated.css
    - lib/themes/manifest.generated.ts
    - .planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md

key-decisions:
  - "Both presets took every value from 06-UI-SPEC.md's pre-computed conversion table verbatim, including its two flagged accessibility corrections (Midnight's on-primary swapped to its own dark surface; Luxe's ring darkened off the literal accent hue) — no oklch value was re-derived by hand."
  - "The direction document's second-accent/sunken-surface properties were folded into existing tokens rather than dropped outright where the role overlapped: Midnight's info token carries the dropped accent-2's cyan hue; Luxe's border token carries the dropped surface-sunken's hairline-divider tone. Recorded in the new backlog note per D-03."
  - "Task 3's D1 write proof used a direct 'wrangler d1 execute --local' UPSERT against the local dev database rather than going through an admin API route (THEME-03's admin UI does not exist yet, per this phase's plan order) — matches the plan's own instruction to prove the mechanism, not the eventual admin surface."

patterns-established:
  - "A preset's theme header comment is copied verbatim from the UI-SPEC's pre-written label/industry/synopsis line — no paraphrasing — so the metadata that later feeds admin cards (06-04) is authored once, in the design doc, not reworded during implementation."

requirements-completed: [THEME-04]

coverage:
  - id: D1
    description: "themes/midnight.css ships as a pure 23-token data file (one attribute-selector block, 17 hex colours, required header), passing the build-themes validator and the token-contract parity test unmodified"
    requirement: THEME-04
    verification:
      - kind: unit
        ref: "tests/unit/lib/themes/token-contract.test.ts (loop now covers midnight.css)"
        status: pass
      - kind: other
        ref: "mise exec -- node scripts/build-themes.mjs --json (0 errors, 3 entries incl. midnight)"
        status: pass
    human_judgment: false
  - id: D2
    description: "themes/luxe.css ships as a pure 23-token data file with inverted inverse surfaces, flat square-corner radii, a contrast-corrected focus ring, and a display token referencing the layout's Cormorant Garamond CSS variable with no font-loading at-rule in the file itself"
    requirement: THEME-04
    verification:
      - kind: unit
        ref: "tests/unit/lib/themes/token-contract.test.ts (loop now covers luxe.css)"
        status: pass
      - kind: other
        ref: "mise exec -- node scripts/build-themes.mjs --json (0 errors, 3 entries incl. luxe); grep -q font-cormorant-garamond themes/luxe.css"
        status: pass
    human_judgment: false
  - id: D3
    description: "Manifest and barrel regenerate to three entries and stay check-clean; writing appearance.theme in local D1 to each of the three names in turn serves that name in the html theme attribute and that theme's declaration block in the compiled stylesheet, with only a page reload; the dropped-properties backlog note is written"
    requirement: THEME-04
    verification:
      - kind: integration
        ref: "wrangler d1 execute mercora-db --local UPSERT + curl http://localhost:3000/ per theme name (volt-dark / luxe / midnight), each confirmed against both the served <html data-theme=...> attribute and the compiled CSS's [data-theme=...] block"
        status: pass
      - kind: other
        ref: "mise exec -- node scripts/build-themes.mjs --check (exit 0, git status clean for both generated paths); npm run lint / typecheck / scan:tokens / test (all exit 0, 247 files / 1924 tests)"
        status: pass
      - kind: manual_procedural
        ref: "human-check: visual look change + reload-only + luxe serif headings, per the plan's own <human-check>"
        status: unknown
    human_judgment: true
    rationale: "The plan's <verify> block carries an explicit <human-check> for the visual claim (page look changes per theme, no restart needed, luxe headings render serif). I confirmed the reload-only and visual-look portions directly via screenshot captures and curl reload probes during execution — see Accomplishments. The serif-heading portion could not be confirmed as written: no component in app/ or components/ currently applies the font-display Tailwind class to any element, so no page anywhere renders text in the display face regardless of active theme. This is a pre-existing gap outside this data-only plan's scope (see Issues Encountered); flagged in .planning/WINDOWS.md for 06-05's QA pass."

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 6 Plan 3: Theme Presets — Midnight and Luxe Summary

**Two new 23-token preset theme files (`midnight`, a second dark theme; `luxe`, the milestone's light-theme acid test) now ship alongside `volt-dark`, both passing the build-themes validator unmodified, with a live proof that switching the stored D1 setting reaches the storefront's rendered `<html>` attribute and stylesheet with nothing more than a page reload.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T20:00:00Z
- **Completed:** 2026-09-04T20:11:31Z
- **Tasks:** 3 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Authored `themes/midnight.css`: indigo-black surfaces, a violet accent, 23 tokens in the same structure and group order as `volt-dark.css`. Both UI-SPEC-flagged accessibility corrections applied verbatim: `on-primary` uses Midnight's own dark surface (`#0c111f`) instead of the direction doc's near-white, which measured only ~2.9:1 on the violet primary; `info` carries the dropped `accent-2` cyan hue (`#00c9d3`) rather than inventing a new token. Sans/display fonts both stay the existing Geist stack, byte-identical to `volt-dark.css`.
- Authored `themes/luxe.css`: warm-ivory surfaces, a champagne-gold accent, serif display face. The UI-SPEC's flagged correction applied verbatim: `ring` darkened off the literal accent hue (`#8b6100`) because the accent-on-ivory pairing measured only ~2.3:1, below the 3:1 non-text contrast threshold. All five inverse tokens flip dark (the opposite polarity from every other shipped theme, since luxe's main surfaces are light). All four radius tokens flat at `0rem`, expressing the direction's square-corner intent. `--store-font-display` references `var(--font-cormorant-garamond)` (the CSS variable `app/layout.tsx` already exposes from plan 06-02) followed by the named family and serif fallbacks; the file itself declares no `@font-face` or `@import`.
- Regenerated `themes/index.generated.css` (3 `@import` lines, filename order: luxe, midnight, volt-dark) and `lib/themes/manifest.generated.ts` (3 `THEME_MANIFEST` entries) from all three committed theme files. `build-themes.mjs --check` passes against the committed output; a second run leaves the working tree clean.
- Proved the preset switch end to end against a real `npm run dev` server and the local D1 database (`wrangler d1 execute mercora-db --local`): with no stored row, the home page served `data-theme="volt-dark"` (manifest default). Writing `appearance.theme` to `"luxe"`, then `"midnight"`, then back to `"volt-dark"` each produced the matching `<html data-theme="...">` attribute on the next request — no restart, no redeploy — and the compiled stylesheet carried all three `[data-theme="..."]` declaration blocks simultaneously (confirmed each preset's block content matches its source file, e.g. `luxe`'s `--store-primary: #c49f4d`). The setting was left at the manifest default (`volt-dark`) when done.
- Captured `phase-06-03-midnight` and `phase-06-03-luxe` screenshot runs (22/26 cells each — the 4 gaps are the same pre-existing Phase 5 coverage gaps carried since 06-02: order-status, Stripe payment step, authenticated account dashboard, review-form error state) as input for plan 06-05's QA pass.
- Wrote `.planning/todos/pending/theme-contract-dropped-properties.md`, recording the six `docs/voltique-theme-direction.md` properties D-03 forbids adding as tokens (`shadow`, `border-width`, `image-aspect`, `accent-2`, `font-mono`, `letter-spacing`), the two that were folded into existing tokens instead of lost outright (Midnight's `accent-2` cyan into `info`; Luxe's `surface-sunken` into `border`), and what extending the contract would touch. This also resolves the existing `theme-metadata-industry-synopsis-admin.md` todo's header-format request — both new files carry the `@theme label:` header this phase's mechanism reads.
- Verified the full gate suite after all three tasks: `npm run lint` (0 errors, pre-existing unrelated warnings only), `npm run typecheck` (exit 0), `npm run scan:tokens` (0 violations, same 2 manual-review rows Phase 5 closed with), `npm test` (247 files / 1924 tests, all green).

## Task Commits

Each task was committed atomically:

1. **Task 1: themes/midnight.css - the second dark preset** - `8b7cfbb` (feat)
2. **Task 2: themes/luxe.css - the light preset and the sweep's acid test** - `338762c` (feat)
3. **Task 3: Regenerate to three entries and prove a preset switch takes effect with no redeploy** - `d3371cf` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `themes/midnight.css` - second dark preset, 23-token contract, manifest name `midnight`
- `themes/luxe.css` - light preset, 23-token contract, manifest name `luxe`
- `themes/index.generated.css` - regenerated to 3 `@import` lines
- `lib/themes/manifest.generated.ts` - regenerated to 3 `THEME_MANIFEST` entries
- `.planning/todos/pending/theme-contract-dropped-properties.md` - backlog note for D-03's dropped direction-doc properties
- `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` - appended `phase-06-03-midnight` and `phase-06-03-luxe` capture manifests

## Decisions Made

- **Every token value copied verbatim from the UI-SPEC's pre-computed table, including both deliberate corrections** — no oklch value was re-derived from `docs/voltique-theme-direction.md` by hand, per the plan's explicit instruction. Re-deriving would have silently reintroduced the contrast failures the UI-SPEC already caught and fixed.
- **Dropped direction-doc properties folded into existing tokens where the role overlapped, otherwise recorded as backlog** — Midnight's `info` and Luxe's `border` each absorb a dropped property's hue/tone rather than the contract growing a 24th token, per D-03's one-way-frozen rule.
- **Task 3's switch proof wrote D1 directly via `wrangler d1 execute --local`** rather than through an admin API route, since the admin Appearance UI (THEME-03, plan 06-04) does not exist yet in this phase's execution order — this matches the plan's own framing of proving the mechanism, not the admin surface.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' code and file changes match the plan's `<action>` text with no auto-fixes required (Rules 1–3 did not trigger; no architectural questions arose).

## Issues Encountered

- **Task 3's literal `grep -c 'name:'` acceptance criterion counts an extra match.** The plan's acceptance criterion asserts `grep -c 'name:' lib/themes/manifest.generated.ts` equals 3. The generated file (established in plan 06-01, unchanged by this plan) also declares the `ThemeManifestEntry` TypeScript type with a `name: string;` field, so the literal count is 4, not 3. I verified the underlying claim — exactly 3 manifest entries — two other ways: the generator's own `--json` output lists exactly 3 entries (`luxe`, `midnight`, `volt-dark`), and the quote-anchored `grep -c 'name: "'` (which only matches object-literal fields, not the type declaration) returns 3. Recorded in `06-VALIDATION.md`'s new Task 3 row rather than silently substituting a different check with no note.
- **The plan's `<human-check>` for Task 3 cannot be fully confirmed as written: no component renders text in the display face.** `--store-font-display` is correctly wired end to end — declared in every theme file, mapped to a Tailwind `font-display` class in `tailwind.config.ts`, and Luxe's value correctly references the Cormorant Garamond variable `app/layout.tsx` loads. But grepping `app/` and `components/` for any use of the `font-display` class or `--store-font-display` custom property found none: no heading, no product title, no page anywhere in the current tree applies it. Consequently the browser never fetches the Cormorant Garamond font file today, on any theme — which trivially satisfies half the human-check ("the two dark themes do not fetch that font file"), but the other half ("luxe renders headings in the serif face") cannot be true yet. This is a pre-existing gap from Phase 5's component sweep (which token-mapped `font-display` but never wired it into markup), not something introduced by this plan, and out of scope for a plan whose `<interfaces>` explicitly says "this plan authors data, not code." Flagged in `.planning/WINDOWS.md` (kind: deviation, phase 06) for plan 06-05's QA pass and any future component-wiring work to pick up.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Three presets (`volt-dark`, `midnight`, `luxe`) are committed, validated, and manifest-registered — plan 06-04's admin Appearance card grid has all three to render, including the `label`/`industry`/`synopsis` metadata each file's header carries.
- Plan 06-05's QA pass has `phase-06-03-midnight` and `phase-06-03-luxe` screenshot baselines to compare against, plus this SUMMARY's explicit list of every deliberate-deviation token value (Midnight's `on-primary`/`info`; Luxe's `ring`) to check first.
- The `font-display` wiring gap (see Issues Encountered) is worth a deliberate look during 06-05: today, switching to `luxe` changes every colour and radius correctly but does not change any typeface, since nothing in the tree consumes the token. Whether that's in-scope for 06-05 to fix (wire a heading component) or stays backlog is a call for whoever plans that work.
- `.planning/todos/pending/theme-contract-dropped-properties.md` is ready for a future milestone's backlog review; `.planning/todos/pending/theme-metadata-industry-synopsis-admin.md` is resolved by this phase's header mechanism and can be closed.

---
*Phase: 06-theme-file-mechanism-presets*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: themes/midnight.css
- FOUND: themes/luxe.css
- FOUND: .planning/todos/pending/theme-contract-dropped-properties.md
- FOUND: themes/index.generated.css
- FOUND: lib/themes/manifest.generated.ts
- FOUND commit: 8b7cfbb
- FOUND commit: 338762c
- FOUND commit: d3371cf
- Re-ran plan-level verification: `node scripts/build-themes.mjs --check` (exit 0, 3 theme(s) fresh), `npx vitest run tests/unit/lib/themes/token-contract.test.ts` (14/14 pass), `npm run scan:tokens` (0 violations, 2 manual-review rows), `npm run lint` (exit 0), `npm run typecheck` (exit 0), `npm test` (247 files / 1924 tests, all pass), `git status --porcelain themes/index.generated.css lib/themes/manifest.generated.ts` (empty)
