# Requirements: Mercora — Milestone v2 Themeable Storefront

**Defined:** 2026-09-02
**Core Value:** A customer or an external AI agent can find the right outdoor gear through Volt, pay for it exactly once, and have inventory, order state, and refunds end up correct, whether they arrive via the storefront or the MCP server.
**Milestone goal:** The storefront is skinnable without touching component code — a theme is a CSS file in `themes/`, selectable from admin with swatch previews; page templates expose enumerated layout switches. Tokens + enumerated variants, never free composition, never per-theme markup.

## v2 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Token Contract & Sweep

- [ ] **TOKEN-01**: A ~18-token contract (colors `primary`, `on-primary`, `surface`, `surface-elevated`, `foreground`, `muted-foreground`, `border`, `ring`, `success`, `warning`, `danger`; shape `radius-sm/md/lg`; type `font-sans`, `font-display`) is defined and mapped through `runtimeColor()` in `tailwind.config.ts`, with the hardcoded `border`/`ring` hex values deleted
- [ ] **TOKEN-02**: The current look lives verbatim in `themes/volt-dark.css` as a `[data-theme="volt-dark"]` block; `app/layout.tsx` stamps `data-theme` on `<html>` server-side — a visual no-op relocation of the inline body vars
- [ ] **TOKEN-03**: All storefront components and page templates use token classes; a whole-tree scan (tailwind config, inline `style={}`, SVG fill/stroke, dead shadcn-pattern classes like `bg-popover` — not just `.tsx` classNames) finds no hardcoded palette values; admin is explicitly excluded and keeps its hardcoded palette
- [ ] **TOKEN-04**: `NEXT_PUBLIC_THEME_PRIMARY` is deprecated; `logoPath` stays in store-config
- [ ] **TOKEN-05**: Before/after screenshots per route (home, category, product, cart, checkout, account, order-status) accompany each sweep PR

### Theme Mechanism

- [ ] **THEME-01**: A prebuild script (`scripts/build-themes.mjs`) scans `themes/*.css`, generates a CSS import barrel + `lib/themes/manifest.generated.ts` (`{ name, label, tokens }`), and fails the build if a theme misses a required token or contains any selector other than its own `[data-theme]` block — wired into `build:worker` AND `predev` (the real deploy path calls `build:worker`, not `build`; verified by breaking a theme file and running the deploy build)
- [ ] **THEME-02**: `getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` env → manifest default, server-side in the root layout (blocking, never Suspense-wrapped, never isolate-cached); an unknown stored theme name falls back and emits a telemetry event registered in both `commerce.telemetry.v1` parity files
- [ ] **THEME-03**: Admin has an "Appearance" section with manifest-driven swatch-preview theme cards, the active theme indicated, saving via the existing `admin_settings` API pattern
- [ ] **THEME-04**: 2–3 preset themes ship, at least one light; the light preset gets explicit visual QA of shadows/overlays (dark-tuned treatments), serving as the sweep-completeness acid test

### Layout Switches

- [ ] **LAYOUT-01**: Admin can set `appearance.category_layout` (`grid-3 | grid-2 | list`); the category page renders the chosen named variant component server-side
- [ ] **LAYOUT-02**: Admin can set `appearance.home_hero` (`full-bleed | split | minimal`); the home page renders the chosen named variant component server-side
- [ ] **LAYOUT-03**: Admin can set `appearance.product_gallery` (`left | top`); the product page renders the chosen named variant component server-side
- [ ] **LAYOUT-04**: Every layout variant has one render test; variants are enumerated union types and named components, never a generic `layout` prop

### Close-out

- [ ] **DOCS-01**: `docs/theming.md` documents the token contract, how to duplicate a theme file, and how build validation fails; `docs/CLAUDE.md` is updated
- [ ] **DOCS-02**: A visual QA pass of presets × layout variants is recorded
- [ ] **DOCS-03**: `.planning/codebase/` structure/architecture docs get a targeted refresh reflecting the sweep (full remap not needed)

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

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKEN-01 | Phase 5 | Pending |
| TOKEN-02 | Phase 5 | Pending |
| TOKEN-03 | Phase 5 | Pending |
| TOKEN-04 | Phase 5 | Pending |
| TOKEN-05 | Phase 5 | Pending |
| THEME-01 | Phase 6 | Pending |
| THEME-02 | Phase 6 | Pending |
| THEME-03 | Phase 6 | Pending |
| THEME-04 | Phase 6 | Pending |
| LAYOUT-01 | Phase 7 | Pending |
| LAYOUT-02 | Phase 7 | Pending |
| LAYOUT-03 | Phase 7 | Pending |
| LAYOUT-04 | Phase 7 | Pending |
| DOCS-01 | Phase 8 | Pending |
| DOCS-02 | Phase 8 | Pending |
| DOCS-03 | Phase 8 | Pending |

**Coverage:**
- v2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-02*
*Last updated: 2026-09-02 after ROADMAP.md creation (4 phases, 16/16 requirements mapped)*
