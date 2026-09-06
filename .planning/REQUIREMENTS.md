# Requirements: Mercora — Milestone v2 Themeable Storefront

**Defined:** 2026-09-02
**Core Value:** A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.
**Milestone goal:** The storefront is skinnable without touching component code — a theme is a CSS file in `themes/`, selectable from admin with swatch previews; page templates expose enumerated layout switches. Tokens + enumerated variants, never free composition, never per-theme markup.

## v2 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Token Contract & Sweep

- [x] **TOKEN-01**: A ~18-token contract (colors `primary`, `on-primary`, `surface`, `surface-elevated`, `foreground`, `muted-foreground`, `border`, `ring`, `success`, `warning`, `danger`; shape `radius-sm/md/lg`; type `font-sans`, `font-display`) is defined and mapped through `runtimeColor()` in `tailwind.config.ts`, with the hardcoded `border`/`ring` hex values deleted
- [x] **TOKEN-02**: The current look lives verbatim in `themes/volt-dark.css` as a `[data-theme="volt-dark"]` block; `app/layout.tsx` stamps `data-theme` on `<html>` server-side — a visual no-op relocation of the inline body vars
- [x] **TOKEN-03**: All storefront components and page templates use token classes; a whole-tree scan (tailwind config, inline `style={}`, SVG fill/stroke, dead shadcn-pattern classes like `bg-popover` — not just `.tsx` classNames) finds no hardcoded palette values; admin is explicitly excluded and keeps its hardcoded palette
- [x] **TOKEN-04**: `NEXT_PUBLIC_THEME_PRIMARY` is deprecated; `logoPath` stays in store-config
- [x] **TOKEN-05**: Before/after screenshots per route (home, category, product, cart, checkout, account, order-status) accompany each sweep PR

### Theme Mechanism

- [x] **THEME-01**: A prebuild script (`scripts/build-themes.mjs`) scans `themes/*.css`, generates a CSS import barrel + `lib/themes/manifest.generated.ts` (`{ name, label, tokens }`), and fails the build if a theme misses a required token or contains any selector other than its own `[data-theme]` block — wired into `build:worker` AND `predev` (the real deploy path calls `build:worker`, not `build`; verified by breaking a theme file and running the deploy build)
- [x] **THEME-02**: `getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` env → manifest default, server-side in the root layout (blocking, never Suspense-wrapped, never isolate-cached); an unknown stored theme name falls back and emits a telemetry event registered in both `commerce.telemetry.v1` parity files
- [x] **THEME-03**: Admin has an "Appearance" section with manifest-driven swatch-preview theme cards, the active theme indicated, saving via the existing `admin_settings` API pattern
- [x] **THEME-04**: 2–3 preset themes ship, at least one light; the light preset gets explicit visual QA of shadows/overlays (dark-tuned treatments), serving as the sweep-completeness acid test
- [x] **THEME-05**: The four remaining presets from the theme direction doc (`clinical`, `retro`, `atelier`, `market`) ship as validated 23-token theme files with header metadata, their display fonts load via `next/font`, each is screenshot-captured across the route grid, and the light ones pass scrim/shadow QA; admin Appearance lists all seven themes

### Layout Switches

- [x] **LAYOUT-01**: Admin can set `appearance.category_layout` (`grid-3 | grid-2 | list`); the category page renders the chosen named variant component server-side
- [x] **LAYOUT-02**: Admin can set `appearance.home_hero` (`full-bleed | split | minimal`); the home page renders the chosen named variant component server-side
- [x] **LAYOUT-03**: Admin can set `appearance.product_gallery` (`left | top`); the product page renders the chosen named variant component server-side
- [x] **LAYOUT-04**: Every layout variant has one render test; variants are enumerated union types and named components, never a generic `layout` prop

### Close-out

- [x] **DOCS-01**: `docs/theming.md` documents the token contract, how to duplicate a theme file, and how build validation fails; `docs/CLAUDE.md` is updated
- [x] **DOCS-02**: A visual QA pass of presets × layout variants is recorded
- [x] **DOCS-03**: `.planning/codebase/` structure/architecture docs get a targeted refresh reflecting the sweep (full remap not needed)

## Future Requirements

Deferred. Tracked but not in this milestone's roadmap.

### Appearance

- **APPR-01**: Live theme preview before saving (P3 per research)
- **APPR-02**: Per-category layout overrides (per-template only for now)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Per-theme component/markup overrides | Rejected on principle — tokens + enumerated variants is the line |
| Free-form CSS/custom code injection per theme | Rejected on principle; explodes testing surface |
| Open color picker per token | Rejected; curated preset files only |
| Admin dashboard theming | Never in this milestone; admin keeps its hardcoded palette |
| Customer-selectable (per-shopper) themes | Separate milestone if ever pursued |
| Theme registry as wrangler var or hand-maintained list | Decided: build-time generated from `themes/*.css` only |
| Runtime theme upload (no-deploy new themes) | Decided: a new theme requires a deploy; switching shipped themes is instant via D1 |
| Caching layer for `getActiveTheme()` | Decided: accept the per-request D1 read; revisit only if traces show it |

## Tech-Debt Closure (v2)

- [x] **DEBT-01**: The v2 audit's code-closable tech debt is closed: emails and the crash page follow the admin-selected theme; `scan:tokens` runs in CI; one request-scoped appearance read; one image resolver; loud parity snapshots; logged seed fallback; review Info items; order-status screenshot coverage via a seeded local order
- [x] **DOCS-04**: `README.md` rewritten product-neutral with a quick start, preset/layout showcase and living docs index; every `docs/` file classified keep/merge/retire in a recorded inventory, merges and retirements executed, remaining docs pass a claim check against the code and follow one direct-language style contract
- [x] **DOCS-05**: `AGENTS.md` at the repo root gives a coding assistant an ordered, command-exact setup path (prerequisites, accounts, secrets, local run, gates, deploy) with do-not-edit boundaries and links into the docs; `CLAUDE.md` points to it

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKEN-01 | Phase 5 | Complete |
| TOKEN-02 | Phase 5 | Complete |
| TOKEN-03 | Phase 5 | Complete |
| TOKEN-04 | Phase 5 | Complete |
| TOKEN-05 | Phase 5 | Complete |
| THEME-01 | Phase 6 | Complete |
| THEME-02 | Phase 6 | Complete |
| THEME-03 | Phase 6 | Complete |
| THEME-04 | Phase 6 | Complete |
| THEME-05 | Phase 6.1 | Complete |
| LAYOUT-01 | Phase 7 | Complete |
| LAYOUT-02 | Phase 7 | Complete |
| LAYOUT-03 | Phase 7 | Complete |
| LAYOUT-04 | Phase 7 | Complete |
| DOCS-01 | Phase 8 | Complete |
| DOCS-02 | Phase 8 | Complete |
| DOCS-03 | Phase 8 | Complete |
| DEBT-01 | Phase 8.1 | Complete |
| DOCS-04 | Phase 8.2 | Complete |
| DOCS-05 | Phase 8.2 | Complete |

**Coverage:**

- v2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-02*
*Last updated: 2026-09-02 after ROADMAP.md creation (4 phases, 16/16 requirements mapped)*
