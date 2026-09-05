# Phase 8: Documentation & Visual QA Close-out - Research

**Researched:** 2026-09-05
**Domain:** Internal documentation authoring + visual regression QA + one D1-backed API bug fix. No new runtime capability, no new dependency.
**Confidence:** HIGH — every fact below was verified by reading the actual source file this session (line ranges and verbatim quotes given); the two areas without a live measurement (per-run capture wall-clock, and whether a "gsd-doc-verifier" agent literally exists in this install) are called out and tagged `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**docs/theming.md and docs/CLAUDE.md (DOCS-01)**
- **D-01:** `docs/theming.md` is a how-to for a developer adding a theme, in this order: (1) the 23-token contract table (token, role, example value, which surfaces read it — including the inverse set and the non-cascade consumers: Stripe, Clerk, emails, global-error); (2) theme-file anatomy with the `@theme` header (`label | industry | synopsis`), the single `[data-theme]` block, hex-only colours, the four radius tokens and the two font tokens, and how display fonts are loaded via `next/font` in `app/layout.tsx`; (3) "Duplicate a theme in five steps"; (4) what the validator rejects, with the exact error text produced by `scripts/build-themes.mjs` for each check, and how `predev`, `build:worker` and the CI `--check` fail; (5) resolution: `getActiveTheme()` D1 → `NEXT_PUBLIC_THEME_DEFAULT` → manifest default, no cache, telemetry on an unknown stored name; (6) the admin Appearance page (theme cards + layout switches); (7) the layout switches (`lib/layout/variants.ts`, the three settings keys, the named variants); (8) the two gates (`npm run scan:tokens`, `node scripts/build-themes.mjs --check`) and the screenshot harness; (9) known limits and backlog (deferred direction-doc properties, the Workers Build variable, the admin walkthrough).
- **D-02:** `docs/CLAUDE.md` gets targeted edits, not a rewrite: replace the "Tailwind CSS with dark theme (`background: #000000`)" line with the token/theme model; add `themes/`, `lib/themes/`, `lib/layout/`, `components/layout/`, `components/admin/ThemePresetGrid.tsx`, `components/admin/LayoutSwitches.tsx`, `scripts/build-themes.mjs`, `scripts/scan-hardcoded-colors.mjs`, `scripts/screenshot-routes.mjs` to the structure tree; note the `scan:tokens` and `build-themes --check` gates in the commands/gates section; link `docs/theming.md`. Every factual claim must match the code (a doc-verifier pass checks this).

**Visual QA matrix (DOCS-02)**
- **D-03:** Scope: every preset (7: volt-dark, luxe, midnight, clinical, retro, atelier, market) × the three packed layout combinations Phase 7 used (each run flips all three switches, so three runs cover all eight variants) = 21 harness runs across the full route grid (plus `--include-content` cells), captured with `scripts/screenshot-routes.mjs`. Combination A = defaults (grid-3 / minimal / left), B = grid-2 / split / top, C = list / full-bleed / left (reuse Phase 7's exact definitions).
- **D-04:** Per-cell pass criteria: renders without error; no overflow/clipping; text legible on its surface (contrast by inspection, ring/border visible); scrims dark; display face present on headings; layout matches its variant's anatomy. Findings table with fix / leave-it judgements in the Phase 6.1 format; fixes only for real defects, each its own commit with a written reason; `scan:tokens` stays 0; no contract change.
- **D-05:** The record lives in `08-QA-MATRIX.md` in the phase directory (coverage grid, findings, judgements, evidence paths), with a summary table (preset × combination → pass/notes) copied into `docs/theming.md`.

**Codebase docs refresh and carry-overs (DOCS-03)**
- **D-06:** Targeted edits to `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`: theme mechanism, layout switches, the new directories and scripts, the token-class convention (no hardcoded palette in storefront; admin excluded; sentinel for polarity-neutral scrims), the two gates and the screenshot harness. `STACK.md`, `INTEGRATIONS.md`, `CONCERNS.md` are only touched if a claim in them is now false. No full remap.
- **D-07:** Fix the settings-GET empty-category bug in `app/api/admin/settings/route.ts`: the category-filtered GET must not re-insert the entire `defaultSettings` array when the filtered result is empty; default seeding runs only when the whole table is empty (or is limited to defaults of the requested category). Add a regression test. Expand-only, no schema change.
- **D-08:** Close-out record in `docs/theming.md` §Known limits and in STATE.md: `NEXT_PUBLIC_THEME_DEFAULT` Workers Build variable pending; real-browser admin walkthrough of Appearance (theme grid + layout switches) still un-run; direction-doc non-contract properties deferred (`.planning/todos/pending/theme-direction-doc-backlog-06.1.md`); the two image-URL resolvers to consolidate; parity-test self-writing snapshots.

### Claude's Discretion
- Prose style and section wording within D-01; exact table layouts; which existing codebase-doc paragraphs to rewrite vs append; whether `08-QA-MATRIX.md` embeds thumbnails or links paths.

### Deferred Ideas (OUT OF SCOPE)
- Full `/gsd-map-codebase` remap; new presets; contract extensions; live preview — all outside this milestone.

### Specific ideas from Russell
- `docs/theming.md` should open with a short "switching themes and layouts in the admin" section before the developer material — the admin path is the first thing a reader sees.
- Quote the validator's real error messages rather than paraphrasing; a reader should be able to grep for them.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | `docs/theming.md` documents the token contract, how to duplicate a theme file, and how build validation fails; `docs/CLAUDE.md` is updated | §"Fact inventory for docs/theming.md" gives every table/section value verbatim, sourced from `05-TOKEN-MAP.md`, `scripts/build-themes.mjs`, `lib/themes/*`, `lib/layout/*`, and the seven `themes/*.css` headers. §"docs/CLAUDE.md stale claims" gives exact line numbers and replacement text. |
| DOCS-02 | A visual QA pass of presets × layout variants is recorded | §"QA matrix mechanics" gives the exact `screenshot-routes.mjs` flags, the settings POST body shape, the cell-count math (28 cells/run, 21 runs), and the precedent findings-table format from `06-SCREENSHOTS.md` / `06.1-SCREENSHOTS.md` / `07-SCREENSHOTS.md`. |
| DOCS-03 | `.planning/codebase/` structure/architecture docs get a targeted refresh reflecting the sweep (full remap not needed) | §"Codebase docs refresh inventory" gives the exact insertion points (section names, line numbers) in each of the four required files, and confirms `STACK.md`/`INTEGRATIONS.md`/`CONCERNS.md` have no now-false claim to fix. |
</phase_requirements>

## Summary

This phase has three independent workstreams and one small, self-contained bug fix, all against
code that already exists and is fully tested — nothing here requires new research into an external
library or framework. The work is: (1) author `docs/theming.md` from scratch and make five
targeted edits to `docs/CLAUDE.md`, both fully checkable against source because every fact this
phase needs to state was read from a real file this session; (2) run a 21-run screenshot matrix
(7 shipped presets × 3 packed layout combinations from Phase 7) using the existing
`scripts/screenshot-routes.mjs` harness, driven by the same `x-dev-admin` dev-bypass POST pattern
every prior Phase 6/6.1/7 plan used, and record judgements in a new `08-QA-MATRIX.md`; (3) make
targeted, line-referenced edits to four `.planning/codebase/*.md` files that currently contain
**zero** mentions of the theme/layout system (verified by grep — this is a real gap, not a stale
claim); and (4) fix a real, previously-logged bug (WINDOWS #3) in
`app/api/admin/settings/route.ts`'s category-filtered `GET`, which unconditionally re-inserts the
entire `defaultSettings` array whenever the filtered result set is empty — a primary-key collision
waiting to happen on any fresh install that seeds a non-`appearance` category first.

**Primary recommendation:** Treat `docs/theming.md` as a "quote, don't paraphrase" document — every
validator error string, every token name, every settings key, and every enum member listed below
was read verbatim from source this session, so the planner should have tasks copy them character-
for-character rather than re-deriving them from memory. Run the QA matrix as a scripted loop
(4-key settings POST → curl verify → `screenshot-routes.mjs` with an explicit `--manifest`) since
every prior phase that omitted an explicit `--manifest` flag wrote its captures into the wrong file
(06-05's own documented deviation).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme/layout resolution (documented, not modified) | Frontend Server (SSR) | Database/Storage | `getActiveTheme()` and `getLayoutSettings()` run server-side, blocking, in `app/layout.tsx` and page components; each issues its own D1 read against the `appearance` `admin_settings` category [VERIFIED: lib/themes/active-theme.ts, lib/layout/settings.ts — read this session]. |
| Admin settings `GET` empty-category bug fix (D-07) | API/Backend | Database/Storage | `app/api/admin/settings/route.ts` is a Next.js Route Handler backed by D1 via Drizzle; the fix is a guard change inside the existing handler, no new endpoint [VERIFIED: app/api/admin/settings/route.ts:36-52]. |
| Visual QA capture harness | Browser/Client (via headless Chromium) | — | `scripts/screenshot-routes.mjs` drives Playwright's `chromium` against the rendered storefront and reads real browser-computed state; it is a QA/build tool, not a shipped runtime tier [VERIFIED: scripts/screenshot-routes.mjs:1-15]. |
| Documentation authoring (`docs/theming.md`, `docs/CLAUDE.md`, `.planning/codebase/*.md`) | N/A (non-runtime) | — | Pure prose; no runtime tier owns documentation accuracy. |

## Standard Stack

### Core

No new libraries. This phase authors documentation, runs an existing screenshot harness, and fixes
a guard condition in an existing route handler. Zero new dependencies are introduced — confirmed
against CONTEXT.md's phase boundary and against every code file read this session (no new
`import` targets are needed for any of DOCS-01/02/03 or the D-07 fix). `postcss` (already a
devDependency, used read-only by `scripts/build-themes.mjs`) and `playwright` (already a
devDependency, used by `scripts/screenshot-routes.mjs`) are the only third-party packages this
phase's tooling touches, and both are pre-existing. [VERIFIED: package.json, scripts/build-themes.mjs, scripts/screenshot-routes.mjs]

### Supporting

Not applicable — no new packages.

### Alternatives Considered

Not applicable — no new packages.

**Installation:** none.

## Package Legitimacy Audit

**Not applicable this phase.** Zero external packages are installed, upgraded, or newly imported.
The Package Legitimacy Gate protocol is a no-op here; nothing to run `npm view` or
`package-legitimacy check` against.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram — theme + layout resolution (what `docs/theming.md` must explain)

```
Admin saves a card/switch                    Storefront request
(ThemePresetGrid.tsx / LayoutSwitches.tsx)    (any page)
         │                                            │
         ▼                                            ▼
POST /api/admin/settings                    app/layout.tsx (RootLayout, async)
  { updates: [                                        │
     { key:"appearance.theme", ... },        ┌─────────┴─────────┐
     { key:"appearance.category_layout",...}, │  getActiveTheme() │  (blocking, no Suspense)
     { key:"appearance.home_hero", ... },     └─────────┬─────────┘
     { key:"appearance.product_gallery",...}  │          │
  ], category:"appearance" }                  │  D1: admin_settings          │
         │                                    │  WHERE category='appearance'│
         ▼                                    │  key='appearance.theme'     │
   admin_settings table (D1, Drizzle)         │          │
   key = PRIMARY KEY, upsert by key            │  found & valid? ──yes──► use it
                                               │      │no
                                               │      ▼
                                               │  NEXT_PUBLIC_THEME_DEFAULT (wrangler.jsonc)
                                               │  valid manifest name? ──yes──► use it
                                               │      │no
                                               │      ▼
                                               │  DEFAULT_THEME_NAME ("volt-dark", manifest.generated.ts)
                                               ▼
                                     data-theme="<resolved>" stamped on <html>
                                     getThemeTokens(resolved) → Stripe/Clerk/email/global-error
                                               │
                          (separately, per page) getLayoutSettings()
                          same D1 category, 3 more keys, same 3-tier fallback per key
                          → CATEGORY_LAYOUTS / HOME_HEROES / PRODUCT_GALLERIES enum member
                          → named layout component renders
```

A stored value that is present but not a manifest/enum member emits exactly one telemetry event
(`theme.unknown_selection` or `layout.unknown_selection`, both `{ outcome: "invalid" }` only — the
untrusted value itself is never logged) and falls through the same chain. [VERIFIED:
lib/themes/active-theme.ts, lib/layout/settings.ts — both read in full this session]

### Recommended Project Structure — what `docs/CLAUDE.md`'s tree is currently missing

`docs/CLAUDE.md`'s `## Project Structure` tree (lines 74-140) has **zero** entries for the theme
mechanism. It must gain, at minimum:

```
mercora/
├── themes/                   # One CSS file per preset — the theme source of truth
│   ├── volt-dark.css         # ...luxe.css, midnight.css, clinical.css, retro.css, atelier.css, market.css
│   └── index.generated.css   # GENERATED — do not edit; produced by scripts/build-themes.mjs
├── lib/
│   ├── themes/
│   │   ├── manifest.generated.ts  # GENERATED — typed THEME_MANIFEST array
│   │   ├── tokens.ts              # getThemeTokens(name?) — sync manifest lookup
│   │   └── active-theme.ts        # getActiveTheme() — D1 → env → manifest default
│   └── layout/
│       ├── variants.ts       # CATEGORY_LAYOUTS/HOME_HEROES/PRODUCT_GALLERIES enums + DEFAULT_LAYOUTS
│       └── settings.ts       # getLayoutSettings() — same 3-tier fallback per switch
├── components/
│   ├── layout/                       # 8 named variant components (category/home/product)
│   └── admin/
│       ├── ThemePresetGrid.tsx       # Appearance page: swatch cards, Save
│       └── LayoutSwitches.tsx        # Appearance page: 3 radiogroups, Save
└── scripts/
    ├── build-themes.mjs          # Validator + manifest/barrel codegen (predev, build:worker, CI --check)
    ├── scan-hardcoded-colors.mjs # Whole-tree hardcoded-palette scanner (npm run scan:tokens)
    └── screenshot-routes.mjs     # Multi-viewport/state screenshot harness (npm run screenshot:routes)
```
[VERIFIED: themes/ directory listing, lib/themes/*.ts, lib/layout/*.ts, components/admin/*.tsx line counts, scripts/*.mjs — all read/listed this session]

### Pattern 1: Theme file anatomy (for "Duplicate a theme in five steps")

```css
/**
 * <name> theme — the frozen 23-token contract (05-TOKEN-MAP.md §1).
 * <free-form design description>
 */
/* @theme label: <Display Name> | industry: <comma-separated> | synopsis: <one sentence> */
[data-theme="<name>"] {
  --store-primary: #rrggbb;
  /* ...all 23 required tokens, hex only for the 17 colour tokens... */
}
```
[VERIFIED: themes/volt-dark.css:1-12, themes/luxe.css:1-13 — headers read verbatim this session]

The five-step duplication recipe, grounded in what the validator actually enforces
(`scripts/build-themes.mjs`, read in full):
1. Copy an existing `themes/*.css` file to `themes/<new-name>.css` (lowercase alphanumerics and
   hyphens only — the validator's `NAME_RE` is `/^[a-z0-9]+(-[a-z0-9]+)*$/`).
2. Change the `@theme label: ... | industry: ... | synopsis: ...` header (label is required;
   industry/synopsis are optional and feed the admin card).
3. Change the selector to `[data-theme="<new-name>"]` — must equal the filename stem exactly.
4. Set all 23 `--store-*` tokens to new hex values (17 colour tokens must be 6-digit hex; the four
   radius tokens and two font tokens are not hex-checked, but a font token must reference a
   `next/font` CSS variable already loaded in `app/layout.tsx`, or the referenced face never
   resolves).
5. Run `npm run build:themes` (regenerates `lib/themes/manifest.generated.ts` and
   `themes/index.generated.css`) and `npm run scan:tokens` (must stay 0). The new theme now appears
   in Appearance's card grid automatically — no other file needs editing.

### Anti-Patterns to Avoid

- **Adding an `@import`, `@font-face`, or a second CSS rule to a theme file:** the validator's
  `root.walkAtRules()` rejects every at-rule unconditionally, and `rules.length > 1` rejects any
  second selector. A theme file is data, not a stylesheet fragment.
- **Loading a non-Geist display font any way other than `next/font` in `app/layout.tsx`:** the
  validator has no way to check this (it only reads CSS), but it is the documented, load-bearing
  pattern for how `--store-font-display` resolves — see the CSS-scoping pitfall below.
- **Writing a doc claim about a token/enum/error-string from memory instead of quoting the file:**
  this phase's own instructions require verbatim quotes; see the Assumptions Log for where this
  research could not verify something directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying a documentation claim is still true | A new "doc linter" | Grep-able assertions against the exact source line (see Validation Architecture) | The codebase already has zero tooling for this; a heavyweight linter is out of scope for a docs phase — a targeted grep per claim is cheaper and just as authoritative. |
| Capturing per-preset/per-layout screenshots | A new capture script | `scripts/screenshot-routes.mjs` (existing, used by every prior Phase 5/6/6.1/7 plan) | Already handles slug resolution from `/sitemap.xml`, dedup, viewport/state matrices, and manifest-table generation. |
| Detecting a hardcoded colour introduced during any fix in this phase | A new scanner | `npm run scan:tokens` (`scripts/scan-hardcoded-colors.mjs`) | Already the phase-closing gate for every prior sweep/theme/layout phase; re-run it, don't reinvent it. |

**Key insight:** this phase produces almost no new code (one bug-fix guard + one test file); every
other Don't-Hand-Roll risk is "don't re-derive a fact this research already quoted from source."

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data, live service
config, OS-registered state, secret/env-var name, or build artifact is being renamed or moved.

## Fact inventory for docs/theming.md (D-01)

Everything below was read from source this session; quote it verbatim rather than paraphrasing,
per Russell's own explicit request in CONTEXT.md.

### The 23-token contract

`05-TOKEN-MAP.md` §1 is the frozen source of truth (23 tokens: 12 colour tokens for the main set,
5 colour tokens for the inverse set, 4 radius tokens, 2 font tokens — 17 colour + 4 radius + 2
font = 23). [VERIFIED: .planning/phases/05-token-contract-component-sweep/05-TOKEN-MAP.md §1, read
this session — full table already reproduced verbatim in that file; do not re-derive, copy the
table]. The non-cascade consumers (cannot read a `[data-theme]` CSS custom property) are named in
`lib/themes/tokens.ts`'s own header comment:

> "the four consumers that cannot read a `[data-theme]` CSS custom property: Stripe Elements'
> `appearance` config, Clerk's `appearance.variables`, the standalone `app/global-error.tsx` page
> (which renders without `globals.css`), and the transactional email builders (mail clients cannot
> read CSS variables)."
[VERIFIED: lib/themes/tokens.ts:1-10]

### Theme file header format

`/* @theme label: <value> | industry: <value> | synopsis: <value> */` — parsed by
`parseThemeHeader()`. Field order is not enforced; `label` is the only required field.
[VERIFIED: scripts/build-themes.mjs, `parseThemeHeader` function body, read in full this session]

### Validator checks and their exact error strings

Every one of these is a literal JS template string read from `scripts/build-themes.mjs` this
session — quote character-for-character (the `${...}` placeholders are the script's own
interpolation points, not something to fill in by hand in the doc):

| Check | Exact message |
|---|---|
| Empty file | `theme file is empty` |
| Unparseable CSS | `` unparseable CSS: ${error.reason ?? error.message} `` |
| Any at-rule present | `` disallowed at-rule "@${atRule.name}" — a theme file may not use at-rules `` |
| Zero rules found | `` no rule found; expected exactly one [data-theme="${stem}"] block `` |
| More than one rule | `` unexpected extra rule "${extra.selector}" — a theme file may contain exactly one rule `` |
| Bad filename stem | `` filename stem "${stem}" must be lowercase alphanumerics and hyphens only `` |
| Selector ≠ filename stem | `` selector "${primaryRule.selector}" must equal "${expectedSelector}" (the filename stem) `` |
| Declaration without `--store-` prefix | `` non-token declaration "${decl.prop}" `` |
| Colour token not 6-digit hex | `` token "${decl.prop}" must be a 6-digit hex colour, got "${decl.value.trim()}" `` |
| Missing a required token | `` missing required token "${token}" `` |
| Unknown `--store-*` token | `` unknown token "${token}" is not part of the frozen 23-token contract `` |
| Missing `@theme` header/label | `missing required @theme header label (e.g. /* @theme label: My Theme */)` |
| Empty theme directory | `` no theme files found in "${themeDir}" `` |
| Unreadable directory | `` cannot read theme directory: ${error.message} `` |
| Unreadable file | `` cannot read file: ${error.message} `` |
| `--check`: stale generated output | `` stale generated file(s): ${stale.join(", ")}. Run \`node scripts/build-themes.mjs\` to regenerate and commit the result. `` |
| `--check` on a non-default dir | `` --check requires the default themes directory, got "${scanDir}" `` |

All errors are collected (not fail-fast) and printed as `[build-themes] <file>:<line>: <message>`,
followed by `[build-themes] ABORT: <N> error(s).`, exit code 1. [VERIFIED: scripts/build-themes.mjs
— `validateThemeFile`, `buildManifest`, and `report` functions, read in full this session]

### How predev / build:worker / CI --check actually fail

Exact `package.json` script bodies [VERIFIED: package.json:9-30, read this session]:

| Script | Body |
|---|---|
| `predev` | `node scripts/build-themes.mjs && node scripts/db-local-ensure.mjs` |
| `build:worker` | `node scripts/build-themes.mjs && node scripts/build-with-public-env.mjs ./node_modules/.bin/opennextjs-cloudflare build` |
| `build:themes` | `node scripts/build-themes.mjs` |
| `build:themes:check` | `node scripts/build-themes.mjs --check` |
| `scan:tokens` | `node scripts/scan-hardcoded-colors.mjs` |
| `screenshot:routes` | `node scripts/screenshot-routes.mjs` |

CI (`.github/workflows/ci.yml`) runs `npm run build:themes:check` as a named step, "Check theme
manifest freshness", immediately after "Check migration safety" and before "Lint".
[VERIFIED: .github/workflows/ci.yml:37-40]

**Important correction to document accurately:** `scan:tokens` is **not** wired into CI at all —
grep of `.github/workflows/ci.yml` for `scan:tokens` or `scan-hardcoded` returns zero matches.
Only `build:themes:check` runs in CI. `docs/theming.md`'s "two gates" section (D-01 point 8) must
say so explicitly — `scan:tokens` is a local/manual gate every phase has run by convention, not an
automated CI check. Do not claim otherwise. [VERIFIED: .github/workflows/ci.yml, full file grepped
this session, zero matches for scan:tokens]

### Resolution chain (theme)

`getActiveTheme()` in `lib/themes/active-theme.ts`:
1. Read D1 `admin_settings` category `appearance`, key `appearance.theme` (via `getSettings()`).
2. Absent/null/empty-string → silently fall through, **no telemetry** (documented as "the normal
   first-load state").
3. Present string matching a manifest name → use it.
4. Present but **not** a manifest name → emit `theme.unknown_selection` with payload
   `{ outcome: "invalid" }` (never the raw stored string — a deliberate anti-disclosure choice),
   then fall through.
5. Present non-string value (number/object/boolean) → same telemetry, fall through.
6. Fallback tier: `NEXT_PUBLIC_THEME_DEFAULT` if it is itself a manifest name, else
   `DEFAULT_THEME_NAME` (`"volt-dark"`, from `manifest.generated.ts`).
7. A D1 read failure (catch block) degrades straight to step 6 — "a database hiccup must degrade
   to the default theme, not take down every route."

**No caching anywhere in this path** — the file's own header comment states this explicitly as a
deliberate choice, "a Cloudflare Workers isolate can be reused across requests, so any additional
caching here would risk serving a stale theme after an admin save." [VERIFIED: lib/themes/active-theme.ts, read in full this session]

### Resolution chain (layout) — same shape, independent D1 read

`getLayoutSettings()` in `lib/layout/settings.ts` reads the **same** `appearance` D1 category
(a second, independent query — not shared/memoised with `getActiveTheme()`'s read, by deliberate
design, per the file's own header: "accepted cost... keeps this module fully independent of
`getActiveTheme()`'s internals"). For each of the three switches it resolves against its own enum
array (`CATEGORY_LAYOUTS`, `HOME_HEROES`, `PRODUCT_GALLERIES`), never by object-key indexing (a
guard against prototype-chain lookups). An unmatched present value emits
`layout.unknown_selection` with `{ outcome: "invalid" }`. [VERIFIED: lib/layout/settings.ts, read
in full this session]

### Settings keys and enums (verbatim)

```
APPEARANCE_SETTINGS_CATEGORY = "appearance"
APPEARANCE_THEME_SETTING_KEY = "appearance.theme"

LAYOUT_SETTING_KEYS = {
  categoryLayout: "appearance.category_layout",
  homeHero:       "appearance.home_hero",
  productGallery: "appearance.product_gallery",
}

CATEGORY_LAYOUTS  = ["grid-3", "grid-2", "list"]
HOME_HEROES       = ["full-bleed", "split", "minimal"]
PRODUCT_GALLERIES = ["left", "top"]

DEFAULT_LAYOUTS = { categoryLayout: "grid-3", homeHero: "minimal", productGallery: "left" }
```
[VERIFIED: lib/themes/active-theme.ts:24-25, lib/layout/settings.ts:35-40, lib/layout/variants.ts:19-28 — all read in full this session]

### Admin surface

`/admin/settings/appearance/page.tsx` (36 lines) renders `ThemePresetGrid.tsx` (311 lines: swatch
cards with five colour chips, an inline mock, label/industry/synopsis from the manifest, an
"Active" badge, an explicit Save button) and `LayoutSwitches.tsx` (420 lines: three radiogroups,
one Save button), both saving via the existing `POST /api/admin/settings` `{ updates: [...] }`
pattern. [VERIFIED: file line counts confirmed via `wc -l` this session; card/switch content per
06-CONTEXT.md D-14/D-15 and 07-CONTEXT D-13, cross-checked against the files' presence]

### The seven shipped presets (`@theme` header, verbatim synopsis lines)

| Theme | Industry (header) | Synopsis (header, verbatim) |
|---|---|---|
| `volt-dark` | outdoor & technical gear | "The store's original look — high-contrast black, electric-orange accent, built for gear that gets used hard." |
| `luxe` | (light preset, warm ivory/champagne-gold/serif) | see `themes/luxe.css` header — acid-test theme for the sweep |
| `midnight` | (second dark preset, indigo-black/violet) | proves the mechanism is not volt-dark recoloured |
| `clinical` | skincare, wellness, supplements, pharmacy, dental | "pure-white surfaces, cool graphite text, and a single sea-teal accent — a trustworthy, regulated look" |
| `retro` | (only dark preset among the four 6.1 additions) | "deep purple surfaces, a magenta accent and cream text, loud on purpose but legible" |
| `atelier` | (light, maker's-studio feel) | "warm linen surfaces, a clay accent, a sage secondary, and soft serif headlines" |
| `market` | (light, grocer feel) | "off-white surfaces, forest-green text, a produce-green accent, and big radius rounded sans" |

[VERIFIED: `sed -n '1,14p'` on each of the seven `themes/*.css` files this session — the volt-dark
synopsis is quoted verbatim from its `@theme` header line; the other six headers' descriptive prose
(not their formal `@theme` line, which this research did not extract for all seven in one pass) is
paraphrased from the file's opening comment block — the planner/writer should re-open each
`themes/*.css` file and copy its own `@theme label: ... | industry: ... | synopsis: ...` line
verbatim rather than trust the paraphrase above for the six non-volt-dark themes.]

Each of `luxe`, `midnight`, `clinical`, `atelier`, and `market` documents a **deliberate contrast
correction** in its own header comment (a direct oklch→hex transcription of
`docs/voltique-theme-direction.md` would have failed a WCAG threshold), e.g. luxe's `ring` token is
darkened from the direction doc's literal value because the literal accent measured only ~2.3:1
against the ivory surface (below the 3:1 non-text-UI threshold). `retro` is the one preset where
every value is a direct transcription with no correction needed. Worth a callout box in
`docs/theming.md`'s "duplicate a theme" section: **a converted preset should re-check contrast, not
assume the source design doc's values pass.** [VERIFIED: themes/luxe.css, themes/midnight.css,
themes/clinical.css, themes/retro.css, themes/atelier.css, themes/market.css — headers read this
session]

### Display fonts wired in `app/layout.tsx`

Five `next/font/google` loads beyond the base Geist/Geist Mono pair, all `preload: false`:
`Cormorant_Garamond` (luxe, weights 400/500/600/700), `Orbitron` (retro, 600/700/800), `Fraunces`
(atelier, 500/600/700/800), `Nunito` (market, 600/700/800). Each is exposed as a CSS variable
(`--font-cormorant-garamond`, etc.) applied to **both** `<html>` and `<body>`'s `className` — a
load-bearing detail, not stylistic: a nested `var()` reference inside a custom property resolves at
the element that **declares** the property (`[data-theme]` on `<html>`), not the element that later
consumes it in `font-family` (`<body>`). If a theme's font variable class is only on `<body>`, the
custom property is invalid at the point it's declared and that invalidity is what inherits down.
[VERIFIED: app/layout.tsx font-loading block and the `className` line's own inline comment, read in
full this session — this was a real bug found and fixed at 06.1-03, recorded in that plan's
key-decisions]

## QA matrix mechanics (DOCS-02)

### The exact settings POST to switch one combination

Both the theme and all three layout keys live in the same `appearance` D1 category, so **one** POST
sets a full preset+combination pair:

```json
POST /api/admin/settings
Headers: { "x-dev-admin": "mercora-dev-bypass", "content-type": "application/json" }
Body: {
  "updates": [
    { "key": "appearance.theme",            "value": "midnight",  "category": "appearance" },
    { "key": "appearance.category_layout",   "value": "grid-2",    "category": "appearance" },
    { "key": "appearance.home_hero",         "value": "split",     "category": "appearance" },
    { "key": "appearance.product_gallery",   "value": "top",       "category": "appearance" }
  ]
}
```

The dev-bypass header value `mercora-dev-bypass` and its gate (`NODE_ENV === "development"` only)
are read directly from the auth middleware. [VERIFIED: lib/auth/admin-middleware.ts:26-28]. This
exact mechanism is the one every prior Phase 6/6.1/7 plan used to switch presets/layouts in this
environment (no Clerk session available), per each phase's own SUMMARY.md. Verify the switch took
effect with `curl http://localhost:3000/ | grep data-theme` before every capture run — the same
precedent every prior phase followed. [VERIFIED: 06.1-SCREENSHOTS.md header block, read this
session]

### The screenshot-routes.mjs flags this phase needs

```bash
mise exec -- npm run screenshot:routes -- \
  --label phase-08-<combo>-<theme> \
  --manifest .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md \
  --allow-missing \
  --include-content
```

- `--label`: required; no default. Precedent naming: `phase-06-05-<theme>`,
  `phase-06.1-04-<theme>`, `phase-07-<combo>-<theme>`. For this phase's 21 runs, something like
  `phase-08-a-volt-dark` .. `phase-08-c-market` (combo A/B/C × 7 themes) keeps every label unique
  and greppable.
- `--manifest`: **defaults to `.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md`**
  — this default has already caused one real, documented mistake (06-05's Task 1: captures landed
  in the wrong file, had to be moved, and `05-SCREENSHOTS.md` had to be restored byte-for-byte).
  Every plan in this phase must pass `--manifest` explicitly, pointed at `08-QA-MATRIX.md` (D-05's
  chosen location), on **every** one of the 21 invocations. [VERIFIED: scripts/screenshot-routes.mjs
  line defining `MANIFEST_PATH` default; 06-05-SUMMARY.md key-decisions and Deviations section, both
  read this session]
- `--allow-missing`: required every run — the local D1 fixture has no seeded order, so
  `order-status` is always a `MISSING` row (not a real defect; every prior phase's manifest carries
  the identical, carried-forward gap). Without this flag the script exits non-zero.
  [VERIFIED: scripts/screenshot-routes.mjs's `orderId` handling in `buildCoverageGrid`]
- `--include-content`: opt-in (off by default); adds `blog-index`, `blog-post`, `cms-page` cells
  (3 routes × 1 state × 2 viewports = 6 cells). CONTEXT.md's D-03 explicitly wants these included
  ("the full route grid (plus `--include-content` cells)"), matching the precedent 06.1's own
  capture command already used this flag on every run. [VERIFIED: scripts/screenshot-routes.mjs
  `INCLUDE_CONTENT` handling; 06.1-SCREENSHOTS.md capture-command line, both read this session]
- `--order-id <id>`, `--base-url <url>`, `--allow-remote`: not needed for this phase (no seeded
  order available; capturing is always against `localhost:3000`).

### Cell-count math (derived, not guessed)

Reading `buildCoverageGrid()` in `scripts/screenshot-routes.mjs` directly: the base seven-route
grid produces 22 cells per run (home 4 + category 4 + product 4 + cart 2 + checkout 4 + account 4 +
order-status 4-but-MISSING). `--include-content` adds 6 more (blog-index 2 + blog-post 2 + cms-page
2, one state each). **28 total cells attempted per run, 24 captured, 4 always MISSING
(order-status).** This reconciles exactly with 06.1-04-SUMMARY.md's own reported count ("28 cells
each, 4 missing order-status") for a run that used the identical flag set. [VERIFIED:
scripts/screenshot-routes.mjs `buildCoverageGrid` function body + `06.1-04-SUMMARY.md`'s D1
coverage row, cross-checked this session]

**At 21 runs (7 presets × 3 combinations): 588 total cell-attempts, ~504 captured, ~84 MISSING
(order-status) rows across the whole matrix.** This is the true scale the plan needs to budget for
— not a small QA pass.

### Per-run wall-clock time — no direct measurement found; treat as an estimate

`[ASSUMED]` No SUMMARY.md or screenshot manifest in this repo records a literal per-run wall-clock
duration for `screenshot-routes.mjs` (checked 06.1-SCREENSHOTS.md and 07-SCREENSHOTS.md for
"Duration"/timestamps — none present at the per-run grain). The closest indirect evidence: Phase
6.1 Plan 4's whole 45-minute plan captured 4 preset runs (28 cells each) *and* ran a 22-row
acid-test pass *and* wrote the phase-close section; Phase 7 Plan 5's 40-minute plan captured 6 runs
(22 cells each, no `--include-content`) *and* wrote a 49-test contract test *and* did the parity
pixel-diff investigation *and* phase-closed. Neither isolates pure capture time. A reasonable
estimate, extrapolating from those two data points, is **roughly 2-4 minutes of wall-clock capture
per 28-cell run** (headless Chromium navigating + waiting 350ms per interactive-state click +
screenshotting ~28 times). At 21 runs that is **~45-85 minutes of pure capture time**, before any
per-cell judgement/write-up. Flag this range to the planner as a scheduling input, not a hard
number — worth a `checkpoint:human-verify` or a time-box decision if the plan wants to bound it.

### Known screenshot-coverage gaps carried into this phase (from STATE.md)

Recorded verbatim from `STATE.md`'s "Research flags for v2 execution" (carried out of Phase 5):

> "Screenshot coverage gaps for Phase 8's visual QA: order-status (no seeded order), Stripe payment
> step (payment-intent 400 locally), authenticated account dashboard, review-form error state. Seed
> an order and a Clerk session before the cross-preset QA pass"

This phase's own CONTEXT.md does not mention seeding an order or a Clerk session as in-scope — the
21-run matrix as specified will still hit the same four gaps every prior phase hit (order-status
MISSING, no way to reach checkout's post-payment confirmation modal, `/account` renders whatever
its no-session fallback is, review-form error state untested). The planner should decide explicitly
whether to accept these as carried-forward (same posture as Phase 5/6/6.1/7) or attempt to close
any of them — CONTEXT.md's scope statement ("visual QA of presets × layout variants") does not
obviously require it, and D-08's close-out record already expects to re-list open items rather than
resolve them all.

### Per-cell pass criteria and findings-table precedent format

D-04's six criteria (renders without error; no overflow/clipping; text legible; scrims dark;
display face present on headings; layout matches its variant's anatomy) map directly onto the
existing findings-table shape from `06-SCREENSHOTS.md` and `06.1-SCREENSHOTS.md`: **site/class,
observed behaviour under the preset, judgement (fix/accept), reason** — each judgement gets its own
commit if it's a fix, with a written reason, exactly as 06-05 and 06.1-04 both did (three of four
scrim sites fixed, one accepted at 06-05; the Select dropdown highlight fixed, several sites
accepted at 06.1-04). [VERIFIED: 06-05-SUMMARY.md, 06.1-04-SUMMARY.md key-decisions, both read in
full this session]

### Can the harness be scripted in a loop?

Yes — nothing about the settings-POST-then-capture pattern requires a human in the loop per run.
A shell loop over the 21 (preset, combination) pairs, each iteration doing (a) `curl -X POST
/api/admin/settings` with the 4-key body and dev-bypass header, (b) `curl / | grep data-theme` to
confirm the switch took, (c) `screenshot-routes.mjs` with the explicit `--label`/`--manifest`/
`--allow-missing`/`--include-content` flags, is a direct extension of what every prior phase did by
hand, run-by-run. Restore all four keys to their defaults
(`volt-dark`/`grid-3`/`minimal`/`left`) and stop the dev server at the end — the same close-out step
every prior phase's plan performed. [VERIFIED: pattern extracted from 06-05-SUMMARY.md and
07-05-SUMMARY.md's own "Next Phase Readiness"/"restored to defaults" language]

## The settings-GET bug (D-07)

### Exact current behaviour

`app/api/admin/settings/route.ts`'s `GET` handler:

```
36  const url = new URL(request.url);
37  const category = url.searchParams.get('category');
38
39  const db = await getDbAsync();
40
41  // Load settings from database
42  const settings = category
43    ? await db.select().from(admin_settings).where(eq(admin_settings.category, category))
44    : await db.select().from(admin_settings);
45
46  // If no settings exist, initialize with defaults
47  if (settings.length === 0) {
48    console.log('Initializing default settings...');
49    await db.insert(admin_settings).values(defaultSettings);
50    const newSettings = await db.select().from(admin_settings);
51    return NextResponse.json({ settings: newSettings });
52  }
```
[VERIFIED: app/api/admin/settings/route.ts:36-52, read in full this session]

The bug: `settings.length === 0` at line 47 is checked against the **category-filtered** result
(line 42-44), but the insert at line 49 unconditionally writes the **entire, unfiltered**
`defaultSettings` array (every category). `defaultSettings` in `lib/db/schema/settings.ts` has rows
for exactly six categories — confirmed by reading the table's own comment and scanning every
`category:` literal in the array: `system`, `store`, `shipping`, `refund`, `promotions`,
`recommendations`. **There is no `appearance` category in `defaultSettings` at all.**
[VERIFIED: lib/db/schema/settings.ts:1-40 + full-file category-literal scan this session]

So: `GET /api/admin/settings?category=appearance` on a table where `appearance` has zero rows
(true on a fresh install, and true for `appearance` specifically even after other categories are
seeded, since `appearance` never gets seeded by this array) always evaluates `settings.length === 0`
→ true → attempts to insert the full `defaultSettings` array. If **any** other category's defaults
already exist (e.g. `system.maintenance_mode` was already seeded by an earlier unfiltered `GET`),
the insert collides on the `key` primary key (`admin_settings.key` is declared
`text("key").primaryKey()` — [VERIFIED: lib/db/schema/settings.ts:10-18]) and throws, caught by the
outer `catch`, surfacing as a 500 `{ error: 'Failed to load settings' }`. This is exactly WINDOWS
ledger item #3's documented finding, not observed in the current local fixture only because plan
06-03 happened to leave one `appearance.theme` row present already.

### Minimal expand-only fix (either option satisfies D-07's own wording)

D-07's text explicitly names two acceptable shapes: "default seeding runs only when the whole table
is empty (**or** is limited to defaults of the requested category)". Concretely:

- **Option A (whole-table check):** query total row count (unfiltered) once; only run the
  seed-insert when *that* count is zero, regardless of what the category filter itself returned.
  A category-filtered `GET` on an already-partially-seeded table then just returns its (possibly
  empty) filtered result with no insert — `appearance` legitimately has no defaults, so this
  returns `{ settings: [] }` for a fresh Appearance page load, which the frontend must already
  handle (or gets handled trivially by `ThemePresetGrid`/`LayoutSwitches` falling back to their own
  default state).
- **Option B (category-scoped insert):** when `category` is set and the filtered result is empty,
  insert only `defaultSettings.filter(s => s.category === category)` instead of the whole array.
  For `category=appearance` this filters to an **empty array** (no rows have that category) — an
  empty-array insert is a no-op, so the handler falls through to the re-select at line 50-51
  (returning `{ settings: [] }`), never touching any other category's rows and never colliding on a
  key.

Both are expand-only (no schema change, per D-07); Option B is the smaller diff (one filter added
at the insert call site); Option A requires one additional total-count query. Either satisfies
"`ThemePresetGrid`/`LayoutSwitches` behave on a fresh install today" without a 500: with either fix,
a fresh install's first `category=appearance` `GET` returns `{ settings: [] }`, and the admin UI's
existing "no saved value yet, show the code default" fallback path (already exercised in every
prior phase's dev-bypass testing) takes over — no change needed to `ThemePresetGrid.tsx` or
`LayoutSwitches.tsx` themselves.

### Regression-test shape (precedent: `tests/unit/app/api/admin-settings-custom-js.test.ts`)

The existing test file for this exact route mocks two module boundaries with `vi.hoisted` +
`vi.mock`: `checkAdminPermissions`/`isSuperAdminActor` from `lib/auth/admin-middleware`, and
`getDbAsync` from `lib/db`, then imports the real route handler (`POST` in that file's case) and
drives it with a constructed `NextRequest`. [VERIFIED: tests/unit/app/api/admin-settings-custom-js.test.ts:1-42, read in full this session]

A new test (e.g. `tests/unit/app/api/admin-settings-empty-category.test.ts`) should follow the same
mocking shape but import `GET`, and mock `getDbAsync()`'s returned `db` object's chainable
`select().from().where()` to return `[]` for `category='appearance'` while a plain
`select().from()` (no `.where()`) returns rows already present for other categories (simulating a
partially-seeded table) — then assert either (a) `db.insert` is never called with the full
`defaultSettings` array, or (b) it is called only with an empty/category-scoped array, and the
response is `200` with `{ settings: [] }`, never `500`. A second case (whole table genuinely empty)
should assert the existing full-seed behavior still fires for an unfiltered `GET`.
[No such test exists yet — `tests/unit/app/api` currently has exactly one file, confirmed by
directory listing this session.]

## Codebase docs refresh inventory (DOCS-03)

### ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md — currently zero mentions

Grepped this session for `theme|Theme|token|Token|color|Color|palette|Palette|hardcod|layout|Layout`
across all four required files:

- **ARCHITECTURE.md** (413 lines): zero relevant hits (the handful of matches are false positives —
  "lease token" in an unrelated queue-processing context, "Clerk via middleware" auth text). The
  file's `## Layers`, `## Key Abstractions`, and `## Component Responsibilities` sections
  (line 104, 136, 273) are the natural insertion points for the theme-resolution and
  layout-resolution flow described in this research's Architecture Patterns diagram above.
- **STRUCTURE.md** (509 lines): the `## Directory Layout` tree (line 5) has generic placeholder
  entries (`[other admin UI]/`, `tailwind.config.ts # Tailwind CSS configuration (if used)`) and
  **no** `themes/` top-level directory, no `lib/themes/`, no `lib/layout/`, no
  `components/layout/`, no mention of `scripts/build-themes.mjs` /
  `scripts/scan-hardcoded-colors.mjs` / `scripts/screenshot-routes.mjs` under its `scripts/` entry
  (line 250-256, currently only names `shopify-migration/`). `## Directory Purposes` (line 310),
  `## Key File Locations` (line 367), and `## Where to Add New Code` (line 420) are the natural
  insertion points.
- **CONVENTIONS.md** (317 lines): zero mentions of Tailwind, tokens, colour, or CSS conventions at
  all. `## Constants and Configuration` (line 304) is the natural place for "token classes only in
  the storefront tree; admin is excluded; a polarity-neutral scrim gets the scanner's
  `gsd:scan-ignore-start`/`-end` sentinel with a written reason, never a blanket exception."
  [VERIFIED: grep of all four files this session, zero real hits in ARCHITECTURE/STRUCTURE/CONVENTIONS]

### TESTING.md — one stale factual claim (test count)

`TESTING.md` states `tests/unit/**/*.test.ts` is "233 files / 1701 tests" (line ~27). The most
recent phase close (07-05-SUMMARY.md) reports the suite at **2126/2126 tests** after that phase's
own 49 new tests were added (up from 2077 before that plan). [VERIFIED: 07-05-SUMMARY.md
Accomplishments section, "npm test (2126/2126, up from 2077 before this plan..." — read this
session]. This is a stale claim, not a gap — DOCS-03's D-06 doesn't explicitly ask for a test-count
refresh, but since the planner is already editing this file for the screenshot-harness gate
mention, updating the stale count in the same pass is low-cost and prevents the doc from being
wrong the moment it's touched. Re-run `mise exec -- npm test` at the time of editing to get the
then-current true count rather than hardcoding 2126 (which will itself be stale by the time this
phase's own tests are added).

### STACK.md, INTEGRATIONS.md, CONCERNS.md — no now-false claim found

Grepped all three this session for `Tailwind|theme|dark|color|palette`. `STACK.md` line 118
("`tailwind.config.ts` - Tailwind CSS configuration with custom color system and typography
plugin") is vague but not false — `runtimeColor("--store-*")` mappings are exactly a "custom color
system." `INTEGRATIONS.md`'s one hit (`@clerk/themes` version) is an accurate dependency listing,
unrelated to the storefront theme mechanism. `CONCERNS.md` has zero hits. **Per D-06, none of these
three files need editing** — the phase boundary explicitly says "only touched if a claim in them is
now false," and none is. [VERIFIED: grep of STACK.md/INTEGRATIONS.md/CONCERNS.md this session]

## docs/CLAUDE.md stale claims (D-02)

| Line | Current text (verbatim) | Why stale | Replacement fact |
|---|---|---|---|
| 24 | `` - **Styling**: Tailwind CSS with dark theme (`background: #000000`) `` | The dark-only, hardcoded-background model was replaced by the 23-token contract and the theme-file mechanism in Phases 5-6; `#000000` is now `volt-dark`'s own `--store-surface` value, one of seven presets, not a fixed background. | "Styling: Tailwind CSS driven by a 23-token CSS-custom-property contract (`--store-*`); the active look is one of seven `themes/*.css` files selected via `data-theme` on `<html>`, resolved by `getActiveTheme()` (D1 → env → manifest default). See `docs/theming.md`." |
| 390 | `` - **Styling**: Tailwind classes, dark theme by default `` | Same root cause — "dark theme by default" is only true of `volt-dark`, the manifest default; three of seven shipped presets are light. | "Styling: Tailwind classes resolved through the 23-token contract; `volt-dark` (dark) is the manifest default, four of seven shipped presets are light. See `docs/theming.md`." |
| 74-140 (`## Project Structure` tree) | No entry for `themes/`, `lib/themes/`, `lib/layout/`, `components/layout/`, `components/admin/ThemePresetGrid.tsx`/`LayoutSwitches.tsx`, or the three `scripts/*.mjs` theme/QA tools | Every one of these was added across Phases 5-7 | See "Recommended Project Structure" above for the exact tree fragment to splice in |
| (Build Commands / gates section, near line 49-64) | No mention of `scan:tokens` or `build:themes:check` | Both gates exist and are load-bearing (one is CI-wired, one is not — see the correction above) | Add a line naming both, explicit about which one runs in CI |
| (no existing line) | No link to `docs/theming.md` | The file doesn't exist yet — created by this phase | Add under "Important Files to Reference" (existing section, ~line 570 per the doc's own list of `docs/*.md` references) |

[VERIFIED: docs/CLAUDE.md lines 24 and 390 read verbatim via grep with line numbers this session;
full file read 60-626 this session for the Project Structure tree and Important Files section]

## docs/runtime-configuration.md — accurate but incomplete, not false

This file already correctly states (lines 29-31): "Storefront colours no longer come from an
environment variable. The active look is selected by the `data-theme` attribute on `<html>` and
resolves through the matching `themes/*.css` file in the CSS cascade." — **this is accurate and
needs no correction.** [VERIFIED: docs/runtime-configuration.md:29-31, read in full this session]

What it's missing (a gap, not a stale claim): its "Theme" table row (line 15) lists only
`NEXT_PUBLIC_STORE_LOGO_PATH`, omitting `NEXT_PUBLIC_THEME_DEFAULT` — which does exist, is declared
in `wrangler.jsonc`, and is directly relevant to this file's own subject matter (public env vars).
[VERIFIED: wrangler.jsonc:114-117 — `"NEXT_PUBLIC_THEME_DEFAULT": "volt-dark"`, with the file's own
comment: "Deploy-time fallback for getActiveTheme() (D-10). Must also be added as a Workers Build
variable in the Cloudflare Dashboard per the project rule for NEXT_PUBLIC_* vars"]. CONTEXT.md's
D-08 already tracks the Workers Build variable itself as an outstanding human action (not a docs
task) — but the env var's *existence* belongs in this table regardless of whether the Workers Build
variable has been added yet. Not explicitly required by D-01/D-02 (which only names `docs/theming.md`
and `docs/CLAUDE.md`), but worth a one-line addition here since the planner is already touching
theme documentation and this file is the authoritative `NEXT_PUBLIC_*` reference.

## README.md docs index

Line 127 already links `docs/CLAUDE.md`. `docs/theming.md` is a new file created by this phase and
has no entry yet. Not named in CONTEXT.md's decisions, but a one-line addition
(`- **[🎨 Theming System](docs/theming.md)** - Token contract, presets, and layout switches`)
alongside the existing docs-index bullets (lines 120-135) is a natural, low-risk inclusion — the
planner should decide whether this is in scope given D-02 only names `docs/CLAUDE.md`.
[VERIFIED: README.md:120-135, grepped this session]

## Common Pitfalls

### Pitfall 1: `--manifest` default silently writes into the wrong file
**What goes wrong:** every `screenshot-routes.mjs` invocation that omits `--manifest` writes into
`.planning/phases/05-token-contract-component-sweep/05-SCREENSHOTS.md` by default.
**Why it happens:** the flag's fallback value is hardcoded to Phase 5's own file path; nothing warns
when a different phase is running the same command.
**How to avoid:** always pass `--manifest .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md` explicitly, on every one of the 21 runs — never rely on the default.
**Warning signs:** a fresh capture's label sections appear in `05-SCREENSHOTS.md` instead of the
phase's own file; `git status` shows an unexpected diff on a prior phase's screenshot manifest.
[VERIFIED: this is exactly what happened at 06-05, documented in that plan's own Deviations
section]

### Pitfall 2: The settings-GET bug can be masked by residual local state
**What goes wrong:** the local dev D1 fixture already has an `appearance.theme` row saved from an
earlier phase's testing, so the empty-category re-seed bug (D-07) never actually fires in this
environment even before it's fixed — a "fresh install" repro requires deliberately clearing the
`appearance` category (or the whole table) first.
**Why it happens:** plan 06-03 left exactly one `appearance.theme` row in the fixture; nothing in
this environment resets D1 between phases.
**How to avoid:** the regression test (unit-level, mocked DB) does not depend on live D1 state and
is the right place to actually exercise the empty-table and partially-seeded-table cases; don't
rely on the dev server's current state to prove the fix works.
**Warning signs:** the fix "looks" correct but the dev server never actually 500s during manual
testing — that's the masking, not evidence of correctness.

### Pitfall 3: Font weight checks must query the heading's own rendered weight
**What goes wrong:** `document.fonts.check()` at the default 400 weight false-negatives every one
of the four new display faces (Orbitron/Fraunces/Nunito load no 400 cut at all; Cormorant Garamond
does, but headings never render at 400).
**Why it happens:** the storefront's actual heading classes use `font-semibold`/`font-bold`/
`font-extrabold`, not the default weight.
**How to avoid:** if this phase's QA pass inspects display-face rendering, query
`document.fonts.check()` at the heading's own live computed `font-weight`, not 400.
**Warning signs:** a display face "looks like" it's not loading in a screenshot even though the
`next/font` variable is correctly wired — check the query weight before concluding it's a bug.
[VERIFIED: 06.1-03-SUMMARY.md key-decisions, read this session — this was a real finding in that
plan]

### Pitfall 4: The category hero image has no configured URL in the local fixture
**What goes wrong:** the local D1 fixture's one category has no image URL, so the category hero
renders a broken-image icon rather than a photo in every screenshot capture, which affects any
overlay/scrim legibility judgement made against it.
**Why it happens:** pre-existing fixture limitation, not something this phase introduces.
**How to avoid:** prior phases used a realistic synthetic reproduction (real markup/classes, a
photographic gradient standing in for the missing photo) rather than judging the broken-image
capture directly — the same substitution is available here if the category hero needs judging
across all 7×3 combinations.
**Warning signs:** a "findings" row that judges hero-overlay legibility purely from the raw
broken-image capture, without noting the substitution, overstates its own evidence quality.
[VERIFIED: 06-05-SUMMARY.md Issues Encountered section, read this session]

## Code Examples

### The full theme-resolution fallback chain, condensed for a reader

```typescript
// Source: lib/themes/active-theme.ts (read in full this session)
export async function getActiveTheme(): Promise<string> {
  // 1. D1 admin_settings, category "appearance", key "appearance.theme"
  // 2. absent/null/empty -> silent fallback, no telemetry
  // 3. present, matches a THEME_MANIFEST name -> use it
  // 4. present, does NOT match -> emit theme.unknown_selection { outcome: "invalid" }, fall back
  // 5. NEXT_PUBLIC_THEME_DEFAULT if it is itself a manifest name, else DEFAULT_THEME_NAME
  // Never throws. Never caches. Always returns a manifest key.
}
```

### The QA-matrix curl loop skeleton

```bash
# Source: pattern extracted from 06-05/06.1-04/07-05 SUMMARY.md precedent, this session
for combo in a b c; do
  for theme in volt-dark luxe midnight clinical retro atelier market; do
    curl -sX POST http://localhost:3000/api/admin/settings \
      -H "x-dev-admin: mercora-dev-bypass" -H "content-type: application/json" \
      -d "{\"updates\":[{\"key\":\"appearance.theme\",\"value\":\"$theme\",\"category\":\"appearance\"}, ...]}"
    curl -s http://localhost:3000/ | grep -o 'data-theme="[a-z-]*"'   # confirm the switch
    mise exec -- npm run screenshot:routes -- \
      --label "phase-08-$combo-$theme" \
      --manifest .planning/phases/08-documentation-visual-qa-close-out/08-QA-MATRIX.md \
      --allow-missing --include-content
  done
done
```
This is illustrative of the pattern, not a committed script — the actual plan should write it as a
real, reviewed shell block or a small `.mjs` runner if the executor prefers, following the same
flags and body shape documented above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-run screenshot-capture wall-clock time (~2-4 min for a 28-cell run, ~45-85 min total for all 21 runs) | QA matrix mechanics § "Per-run wall-clock time" | If the real time is much higher, the plan may need to split the 21 runs across more waves/plans than budgeted; if much lower, no harm — just a looser schedule. Low risk either way since it doesn't affect correctness. |
| A2 | The six non-volt-dark themes' `@theme` header industry/synopsis text in the "seven shipped presets" table is paraphrased from the opening comment block, not extracted from each file's literal `@theme label: ... \| industry: ... \| synopsis: ...` line for all seven in one pass | Fact inventory § "The seven shipped presets" | If the doc author copies the paraphrase instead of re-opening each file, `docs/theming.md`'s admin-card description table could contain text that doesn't byte-match the manifest's actual `label`/`meta.industry`/`meta.synopsis` values a reader could grep for. Low risk (the header block IS correct source, just not literally copy-pasted for six of seven) but should be re-verified per-file when writing the doc. |
| A3 | The best insertion sections named for ARCHITECTURE.md/STRUCTURE.md/CONVENTIONS.md are reasonable choices, not the only valid ones | Codebase docs refresh inventory | Low risk — Claude's Discretion in CONTEXT.md explicitly covers "which existing codebase-doc paragraphs to rewrite vs append." |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should the settings-GET fix use Option A (whole-table check) or Option B (category-scoped insert)?**
   - What we know: both satisfy D-07's own wording; both are expand-only, no schema change.
   - What's unclear: which is more consistent with the rest of the route's existing style, and
     whether Option B's "insert an empty array" edge case needs its own explicit early-return
     rather than calling `db.insert(admin_settings).values([])` (Drizzle's behavior on an empty
     values array wasn't checked this session).
   - Recommendation: the planner should pick Option B (smaller diff, category-scoped, matches D-07's
     parenthetical preference order) but verify Drizzle's `insert().values([])` doesn't itself throw
     before committing to it — add an explicit `if (filtered.length > 0)` guard if there's any doubt.

2. **Does the 21-run QA matrix need to attempt closing any of the four carried-forward screenshot
   gaps (order-status, Stripe payment step, authenticated account, review-form error state)?**
   - What we know: CONTEXT.md's D-03/D-04 scope the matrix to "every preset × the three packed
     layout combinations" across "the full route grid" — it does not explicitly ask to seed an
     order or a Clerk session.
   - What's unclear: whether "the full route grid" implicitly means closing these gaps, or whether
     they're accepted as carried-forward exactly as every prior phase left them.
   - Recommendation: treat as carried-forward (same posture as Phase 5/6/6.1/7) unless the planner
     or Russell decides otherwise — re-litigating this is explicitly what D-08's close-out record is
     for, not a silent scope expansion mid-phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (via mise) | All commands | ✓ | 24.18.1 (per `package.json` engines: `>=24.18.1 <25`) | — |
| Playwright (`chromium`) | `scripts/screenshot-routes.mjs` | ✓ (existing devDependency, used by every prior phase's capture) | — | — |
| `postcss` | `scripts/build-themes.mjs` | ✓ (existing devDependency) | 8.5 | — |
| Local dev server (`npm run dev`) | QA matrix capture | ✓ (standard local workflow) | — | — |
| Local D1 fixture with a seeded order | Closing the order-status screenshot gap | ✗ | — | Accept as carried-forward `MISSING` row, per every prior phase |
| Clerk session in this environment | Authenticated `/account` capture, admin real-browser walkthrough | ✗ | — | dev-bypass header (`x-dev-admin`) for settings writes; accept unauthenticated `/account` fallback for capture |

**Missing dependencies with no fallback:** none — every gap above has an accepted fallback already
used by every prior phase in this milestone.

**Missing dependencies with fallback:** seeded order (fallback: `--allow-missing`); Clerk session
(fallback: dev-bypass header for settings writes, unauthenticated capture for `/account`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.mts` (unit), `vitest.workers.config.mts` (integration), `vitest.observability.config.mts` |
| Quick run command | `mise exec -- npx vitest run tests/unit/app/api/admin-settings-empty-category.test.ts` (new file, once written) |
| Full suite command | `mise exec -- npm test` |

[VERIFIED: package.json:16-19, vitest.config.mts read in full this session]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | `docs/theming.md` states facts that match source (token names, validator error strings, settings keys, enum members) | manual/grep-able assertions | `grep -F '"missing required token' docs/theming.md scripts/build-themes.mjs` (repeat per quoted string) — no automated prose-correctness test exists or is proposed; verification is per-claim grep cross-check against the exact source line at doc-writing time and again at phase-close | N/A — no test file, a grep-assertion checklist instead |
| DOCS-01 | `docs/CLAUDE.md` no longer states the stale styling claims | grep (negative assertion) | `! grep -q "background: #000000" docs/CLAUDE.md` | N/A |
| DOCS-02 | Every one of the 21 (preset, combination) pairs is captured with a non-empty coverage row and a recorded pass/fix/accept judgement | integration (screenshot harness) + manual judgment | `mise exec -- npm run screenshot:routes -- --label ... --manifest 08-QA-MATRIX.md --allow-missing --include-content` (×21) | ✅ (harness exists) |
| DOCS-02 | No regression introduced by any QA-driven fix | unit | `mise exec -- npm run scan:tokens` (must stay 0 violations) + `mise exec -- npm test` | ✅ |
| DOCS-03 | Each of the four required codebase docs mentions the theme/layout system by name | grep (positive assertion) | `grep -q "getActiveTheme\|themes/\*.css" .planning/codebase/ARCHITECTURE.md .planning/codebase/STRUCTURE.md .planning/codebase/CONVENTIONS.md .planning/codebase/TESTING.md` | N/A — grep-assertion checklist |
| D-07 (bug fix) | `GET /api/admin/settings?category=appearance` never 500s regardless of other categories' seed state | unit | `mise exec -- npx vitest run tests/unit/app/api/admin-settings-empty-category.test.ts` | ❌ Wave 0 — new file |

### Sampling Rate

- **Per task commit:** `mise exec -- npx vitest run tests/unit/app/api/admin-settings-empty-category.test.ts` (once it exists), plus the relevant grep-assertion checklist for whichever doc file that task touched.
- **Per wave merge:** `mise exec -- npm test` (full suite) + `mise exec -- npm run scan:tokens` + `mise exec -- npm run build:themes:check`.
- **Phase gate:** Full suite green, `scan:tokens` 0 violations, `build:themes:check` fresh, and every grep-assertion checklist item passing, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/unit/app/api/admin-settings-empty-category.test.ts` — new file, covers the D-07 fix (currently `tests/unit/app/api` has exactly one file, `admin-settings-custom-js.test.ts`, confirmed by directory listing this session).
- [ ] No new fixtures/conftest needed — the existing `vi.hoisted`/`vi.mock` pattern in the sibling test file covers the mocking shape needed.
- [ ] No framework install needed — Vitest is already configured and used by 2126+ existing tests.

*(No gaps for DOCS-01/02/03 — these are documentation/QA-record tasks with grep-assertion and
screenshot-harness verification, not unit-test-shaped work.)*

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` (absent = enabled),
but this phase's only code change (D-07) is a guard-condition fix inside an **already-authenticated**
route handler — `checkAdminPermissions(request)` at line 28 of
`app/api/admin/settings/route.ts` is untouched by the fix and gates both `GET` and `POST` before any
database access. [VERIFIED: app/api/admin/settings/route.ts:25-34]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes (unchanged) | `checkAdminPermissions` / `isSuperAdminActor` in `lib/auth/admin-middleware.ts` — this phase does not modify the auth gate, only the post-auth default-seeding guard |
| V5 Input Validation | yes (unchanged) | `category` query param is read via `URLSearchParams.get()` and used only as a Drizzle `eq()` filter value — no injection surface; unchanged by this fix |
| V2/V3/V6 | no | No authentication, session, or cryptography surface touched by any task in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A category-filtered read accidentally triggering a full-table write (this phase's own bug) | Tampering (unintended data mutation) | Scope the seed-insert to either a genuine whole-table-empty check or a category-filtered slice of `defaultSettings` — never let a filtered read's emptiness drive an unfiltered write |
| Reflecting an untrusted stored value into logs/telemetry | Information Disclosure | Already mitigated in the theme/layout resolvers — `theme.unknown_selection` and `layout.unknown_selection` both carry only `{ outcome: "invalid" }`, never the raw stored string [VERIFIED: lib/themes/active-theme.ts, lib/layout/settings.ts] |

## Sources

### Primary (HIGH confidence — read in full or via targeted grep with line numbers this session)
- `scripts/build-themes.mjs` — full file
- `scripts/scan-hardcoded-colors.mjs` — first ~120 lines (exclusion rules, manual-review registry, regex construction)
- `scripts/screenshot-routes.mjs` — first ~200 lines (flags, coverage-grid construction, route/state/viewport logic)
- `lib/themes/tokens.ts`, `lib/themes/active-theme.ts` — full files
- `lib/layout/variants.ts`, `lib/layout/settings.ts` — full files
- `app/api/admin/settings/route.ts` — full file, line-numbered
- `lib/admin/settings-parse.ts` — full file
- `lib/db/schema/settings.ts` — table definition + full `defaultSettings` category scan
- `app/layout.tsx` — font-loading block and `RootLayout` body, targeted reads
- `themes/*.css` (all seven) — header comment blocks, `themes/index.generated.css`
- `wrangler.jsonc` — `NEXT_PUBLIC_THEME_DEFAULT` declaration and its comment
- `docs/CLAUDE.md`, `docs/runtime-configuration.md`, `README.md` — full/targeted reads
- `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,STACK,INTEGRATIONS,CONCERNS}.md` — grepped for relevant terms, targeted section reads
- `tests/unit/app/api/admin-settings-custom-js.test.ts` — full file (test-mocking precedent)
- `.github/workflows/ci.yml` — full file (confirmed `build:themes:check` is CI-wired, `scan:tokens` is not)
- `package.json` — scripts section
- `05-TOKEN-MAP.md`, `06-CONTEXT.md`, `06-05-SUMMARY.md`, `06.1-SCREENSHOTS.md`, `06.1-04-SUMMARY.md`, `07-SCREENSHOTS.md`, `07-05-SUMMARY.md`, `STATE.md`, `WINDOWS.md`, `theme-direction-doc-backlog-06.1.md` — read in full this session

### Secondary (MEDIUM confidence)
- None — every claim in this document traces to a primary source read this session.

### Tertiary (LOW confidence)
- Per-run screenshot capture wall-clock estimate (A1 in Assumptions Log) — extrapolated from two indirect data points, not a direct measurement.
- Six of seven themes' paraphrased industry/synopsis text (A2 in Assumptions Log) — sourced from the header comment block but not literally copy-pasted from each file's own `@theme` line for all seven.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new packages this phase.
- Architecture (theme/layout resolution chains, admin surface, settings-GET bug): HIGH — every claim read from source this session with line numbers.
- Pitfalls: HIGH — all four are documented, real findings from prior phases' own SUMMARY.md files, not speculative.
- QA-matrix scale/timing: MEDIUM — cell-count math is derived and verified against a real precedent count; wall-clock timing is an estimate (A1).

**Research date:** 2026-09-05
**Valid until:** No external dependency risk (no new packages); the underlying source files could
change if a concurrent phase touches them, but nothing else in the roadmap targets these files.
Treat as valid through this phase's completion.

## RESEARCH COMPLETE
