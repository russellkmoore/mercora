# Phase 8: Documentation & Visual QA Close-out - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — three grey areas proposed in batch tables, all accepted by Russell

<domain>
## Phase Boundary

Document the theming system well enough for a developer to add a theme without re-deriving the mechanism, verify the seven presets and eight layout variants together, refresh the codebase docs that the sweep and mechanism made stale, and close the milestone's small carry-overs. In scope: DOCS-01, DOCS-02, DOCS-03, plus one bug fix (settings GET on an empty category) and the close-out record. Out of scope: new themes, new variants, contract changes, a full codebase remap.

</domain>

<decisions>
## Implementation Decisions

### docs/theming.md and docs/CLAUDE.md (DOCS-01)
- **D-01:** `docs/theming.md` is a how-to for a developer adding a theme, in this order: (1) the 23-token contract table (token, role, example value, which surfaces read it — including the inverse set and the non-cascade consumers: Stripe, Clerk, emails, global-error); (2) theme-file anatomy with the `@theme` header (`label | industry | synopsis`), the single `[data-theme]` block, hex-only colours, the four radius tokens and the two font tokens, and how display fonts are loaded via `next/font` in `app/layout.tsx`; (3) "Duplicate a theme in five steps"; (4) what the validator rejects, with the exact error text produced by `scripts/build-themes.mjs` for each check, and how `predev`, `build:worker` and the CI `--check` fail; (5) resolution: `getActiveTheme()` D1 → `NEXT_PUBLIC_THEME_DEFAULT` → manifest default, no cache, telemetry on an unknown stored name; (6) the admin Appearance page (theme cards + layout switches); (7) the layout switches (`lib/layout/variants.ts`, the three settings keys, the named variants); (8) the two gates (`npm run scan:tokens`, `node scripts/build-themes.mjs --check`) and the screenshot harness; (9) known limits and backlog (deferred direction-doc properties, the Workers Build variable, the admin walkthrough).
- **D-02:** `docs/CLAUDE.md` gets targeted edits, not a rewrite: replace the "Tailwind CSS with dark theme (`background: #000000`)" line with the token/theme model; add `themes/`, `lib/themes/`, `lib/layout/`, `components/layout/`, `components/admin/ThemePresetGrid.tsx`, `components/admin/LayoutSwitches.tsx`, `scripts/build-themes.mjs`, `scripts/scan-hardcoded-colors.mjs`, `scripts/screenshot-routes.mjs` to the structure tree; note the `scan:tokens` and `build-themes --check` gates in the commands/gates section; link `docs/theming.md`. Every factual claim must match the code (a doc-verifier pass checks this).

### Visual QA matrix (DOCS-02)
- **D-03:** Scope: every preset (7: volt-dark, luxe, midnight, clinical, retro, atelier, market) × the three packed layout combinations Phase 7 used (each run flips all three switches, so three runs cover all eight variants) = 21 harness runs across the full route grid (plus `--include-content` cells), captured with `scripts/screenshot-routes.mjs`. Combination A = defaults (grid-3 / minimal / left), B = grid-2 / split / top, C = list / full-bleed / left (reuse Phase 7's exact definitions).
- **D-04:** Per-cell pass criteria: renders without error; no overflow/clipping; text legible on its surface (contrast by inspection, ring/border visible); scrims dark; display face present on headings; layout matches its variant's anatomy. Findings table with fix / leave-it judgements in the Phase 6.1 format; fixes only for real defects, each its own commit with a written reason; `scan:tokens` stays 0; no contract change.
- **D-05:** The record lives in `08-QA-MATRIX.md` in the phase directory (coverage grid, findings, judgements, evidence paths), with a summary table (preset × combination → pass/notes) copied into `docs/theming.md`.

### Codebase docs refresh and carry-overs (DOCS-03)
- **D-06:** Targeted edits to `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`: theme mechanism, layout switches, the new directories and scripts, the token-class convention (no hardcoded palette in storefront; admin excluded; sentinel for polarity-neutral scrims), the two gates and the screenshot harness. `STACK.md`, `INTEGRATIONS.md`, `CONCERNS.md` are only touched if a claim in them is now false. No full remap.
- **D-07:** Fix the settings-GET empty-category bug in `app/api/admin/settings/route.ts`: the category-filtered GET must not re-insert the entire `defaultSettings` array when the filtered result is empty; default seeding runs only when the whole table is empty (or is limited to defaults of the requested category). Add a regression test. Expand-only, no schema change.
- **D-08:** Close-out record in `docs/theming.md` §Known limits and in STATE.md: `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable pending; real-browser admin walkthrough of Appearance (theme grid + layout switches) still un-run; direction-doc non-contract properties deferred (`.planning/todos/pending/theme-direction-doc-backlog-06.1.md`); the two image-URL resolvers to consolidate; parity-test self-writing snapshots.

### Claude's Discretion
- Prose style and section wording within D-01; exact table layouts; which existing codebase-doc paragraphs to rewrite vs append; whether `08-QA-MATRIX.md` embeds thumbnails or links paths.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-themes.mjs` (validator error strings to quote verbatim), `scripts/scan-hardcoded-colors.mjs`, `scripts/screenshot-routes.mjs` (`--label`, `--manifest`, `--allow-missing`, `--include-content`).
- `themes/*.css` (seven files; `luxe.css` and `retro.css` are good light/dark examples with header conventions), `lib/themes/manifest.generated.ts`, `lib/themes/tokens.ts`, `lib/themes/active-theme.ts`, `lib/layout/variants.ts`, `lib/layout/settings.ts`.
- `components/admin/ThemePresetGrid.tsx`, `components/admin/LayoutSwitches.tsx`, `app/admin/settings/appearance/page.tsx`.
- Phase records to mine: `05-TOKEN-MAP.md`, `06-CONTEXT.md`, `06.1-SCREENSHOTS.md`, `07-SCREENSHOTS.md` (packed-combination definitions and capture method), `.planning/WINDOWS.md`, `.planning/todos/pending/theme-direction-doc-backlog-06.1.md`.
- `docs/runtime-configuration.md` (existing doc that mentions theme env vars — keep consistent), `docs/CLAUDE.md` (626 lines), `README.md` docs index (line ~127 links docs/CLAUDE.md).
- `app/api/admin/settings/route.ts` lines ~37–49 (the GET default re-insert), `lib/admin/settings-parse.ts`, `tests/unit/app/api/**` (API test precedent).

### Established Patterns
- Docs in this repo are markdown with a status line under the H1 where relevant; factual claims are verified against code (Phase 4 precedent).
- Screenshot QA records follow `06.1-SCREENSHOTS.md`'s coverage grid + findings table + judgements.
- Node 24 via `mise exec --`; vitest one-shot; commit-message files via `mktemp` (shell has `noclobber`); dev server started in the background for captures and stopped after; theme and layout settings restored to defaults after each run.

### Integration Points
- `docs/theming.md` ← contract, scripts, resolver, admin, layouts; `docs/CLAUDE.md` and `README.md` docs index link it.
- `08-QA-MATRIX.md` ← 21 capture runs; summary → `docs/theming.md`.
- `.planning/codebase/*.md` ← targeted edits.
- `app/api/admin/settings/route.ts` ← D-07 fix + test.

</code_context>

<specifics>
## Specific Ideas

- Russell wants to "try them all out": `docs/theming.md` should open with a short "switching themes and layouts in the admin" section before the developer material, so the admin path is the first thing a reader sees.
- Quote the validator's real error messages rather than paraphrasing; a reader should be able to grep for them.

</specifics>

<deferred>
## Deferred Ideas

- Full `/gsd-map-codebase` remap; new presets; contract extensions; live preview — all outside this milestone.

</deferred>
