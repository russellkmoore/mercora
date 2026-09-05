# Roadmap: Mercora

## Milestones

- ✅ **v1 Hardening** — Phases 1-4 (shipped 2026-09-02) — [archive](milestones/v1-ROADMAP.md)
- 🚧 **v2 Themeable Storefront** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1 Hardening (Phases 1-4) — SHIPPED 2026-09-02</summary>

Hardening pass on the live Voltique storefront: dead published credential, fail-closed admin guard, telemetry for silent failure modes, ADRs locked, runbooks and reference docs brought in line with the code.

- [x] Phase 1: Security and Admin-Auth Truth (4/4 plans) — completed 2026-09-02
- [x] Phase 2: Observability and Regression Guards (5/5 plans) — completed 2026-09-02
- [x] Phase 3: Decision Lock-In and Operator Runbooks (3/3 plans) — completed 2026-09-02
- [x] Phase 4: Reference Documentation Refresh (5/5 plans) — completed 2026-09-02

Full phase details, success criteria, and plan lists: `milestones/v1-ROADMAP.md`. Requirements and backlog: `milestones/v1-REQUIREMENTS.md`. Audit: `milestones/v1-MILESTONE-AUDIT.md`. Phase artifacts: `milestones/v1-phases/`.

</details>

### 🚧 v2 Themeable Storefront (In Progress)

**Milestone Goal:** The storefront is skinnable without touching component code — a theme is a CSS file in `themes/`, selectable from admin with swatch previews, and page templates expose enumerated layout switches configurable from admin. Tokens + enumerated variants, never free composition, never per-theme markup.

- [x] **Phase 5: Token Contract & Component Sweep** - Freeze the ~18-token contract, relocate the current look verbatim to `themes/volt-dark.css`, and sweep every storefront component/template to token classes (admin excluded) (completed 2026-09-04)
- [x] **Phase 6: Theme File Mechanism & Presets** - Build the prebuild theme scanner/validator, `getActiveTheme()` server resolution, the admin Appearance swatch picker, and ship 2-3 preset themes including one light (completed 2026-09-04)
- [ ] **Phase 7: Layout Switches** - Add three enumerated, server-chosen layout variants (category grid/list, home hero, product gallery) wired into the Appearance admin section
- [ ] **Phase 8: Documentation & Visual QA Close-out** - Document the theming system, record a visual QA pass across presets x layout variants, and refresh the affected `.planning/codebase/` docs

**Phase Numbering:** continues from v1 (which ended at Phase 4). Decimal phases (5.1, 5.2, ...) are urgent insertions.

## Phase Details

### Phase 5: Token Contract & Component Sweep

**Goal**: The storefront's visual design is fully token-driven — the ~18-token contract is frozen and wired through Tailwind, the current look is preserved as `themes/volt-dark.css` with zero visual regression, and no storefront component or template holds a hardcoded palette value (admin is explicitly excluded and keeps its hardcoded palette).
**Depends on**: Nothing (first phase of v2; v1 shipped 2026-09-02)
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05
**Success Criteria** (what must be TRUE):

  1. The site renders identically to before the sweep — verified with before/after screenshots per route (home, category, product, cart, checkout, account, order-status) — with `themes/volt-dark.css` live as the `[data-theme="volt-dark"]` block and `data-theme` stamped on `<html>` server-side in `app/layout.tsx`
  2. `tailwind.config.ts` maps all ~18 tokens through `runtimeColor()`, with the hardcoded `border`/`ring` hex values deleted
  3. A whole-tree scan (Tailwind config, inline `style={}`, SVG fill/stroke, dead shadcn-pattern classes like `bg-popover` — not just `.tsx` classNames) finds zero hardcoded palette values in storefront code
  4. `NEXT_PUBLIC_THEME_PRIMARY` no longer exists in the codebase; `logoPath` still resolves via store-config unchanged

**Plans**: 12/12 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Palette scan gate: whole-tree scanner, `scan:tokens` script, fail-first fixture proof

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Screenshot harness: Playwright install (human legitimacy gate), capture script, D-21 pre-sweep baseline

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — TRACER: 23-token contract wired theme-file → Tailwind → `data-theme` → pixel, plus `getThemeTokens()` and the env-var retirement

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-04-PLAN.md — Sweep chunk 2a: the 19 shadcn primitives, dead colour vocabulary rewritten in place

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-05-PLAN.md — Sweep chunk 2b: shared shell — header, footer, breadcrumbs, banner, Sonner toaster

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 05-06-PLAN.md — Sweep chunk 3a: home, category, product routes and the catalogue cards

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 05-07-PLAN.md — Sweep chunk 3b: reviews and subscription acquisition (the densest palette cluster outside email)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 05-08-PLAN.md — Sweep chunk 3c: CMS page blocks and blog surfaces

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 05-09-PLAN.md — Sweep chunk 4a: cart and agent drawers on the inverse token set

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 05-10-PLAN.md — Sweep chunk 4b: checkout UI plus the server-to-client token bridge for Stripe Elements

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 05-11-PLAN.md — Sweep chunk 5a: account, order-status, both error boundaries, Clerk appearance

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 05-12-PLAN.md — Sweep chunk 5b: the six transactional email builders, then the phase-close whole-tree scan

**UI hint**: yes
**Execution note**: waves are serial by construction — D-18 locks one branch and one PR per sweep chunk in a fixed order, and every plan appends to the shared `05-SCREENSHOTS.md` manifest.

### Phase 6: Theme File Mechanism & Presets

**Goal**: A theme is a self-contained CSS file that can be added or swapped without touching component code; admins choose among shipped presets with swatch previews, and an invalid theme file cannot reach production.
**Depends on**: Phase 5 — the sweep must exist for a second theme to meaningfully validate against; the light preset is the sweep's own acid test
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04
**Success Criteria** (what must be TRUE):

  1. Running the real deploy build (`build:worker`) against a deliberately broken theme file fails the build, and `predev` runs the same scan
  2. `getActiveTheme()` resolves `admin_settings` → `NEXT_PUBLIC_THEME_DEFAULT` env → manifest default, blocking server-side in the root layout (no FOUC, no Suspense, no isolate cache); an unknown stored theme name falls back and emits a telemetry event present in both `commerce.telemetry.v1` parity files
  3. Admin's Appearance section shows manifest-driven swatch-preview cards for every shipped theme, indicates the active one, and saves a selection through the existing `admin_settings` API pattern
  4. 2-3 preset themes ship, at least one light; the light preset's shadows and overlays read correctly rather than as dark-tuned leftovers

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — TRACER: theme file → validator → generated manifest + barrel → rendered `data-theme`, wired into `build:worker`/`predev`/CI

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — `getActiveTheme()` D1 → env → manifest default, async root layout, `theme.unknown_selection` telemetry, Cormorant Garamond load

**Wave 3** *(blocked on Wave 2 completion; 06-03 and 06-04 run in parallel)*

- [x] 06-03-PLAN.md — Two presets: `midnight` (dark) and `luxe` (light), regenerated three-entry manifest, dropped-properties backlog note
- [x] 06-04-PLAN.md — Admin Appearance route: manifest-driven swatch cards, pending selection vs Active badge, save through the existing settings endpoint

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-05-PLAN.md — Light-preset acid test: per-preset capture grids, overlay/shadow QA with case-by-case fixes, phase-close evidence roll-up

**UI hint**: yes

### Phase 06.1: Remaining Presets: Clinical, Retro, Atelier, Market (INSERTED)

**Goal**: The four remaining presets from `docs/voltique-theme-direction.md` — `clinical`, `retro`, `atelier`, `market` — ship as validated theme files on the frozen 23-token contract, each with header metadata and screenshot evidence, and the three light ones pass the same scrim/shadow QA Luxe did, so the admin Appearance page offers all six merchant looks plus volt-dark.
**Depends on**: Phase 6 — uses the validator, manifest, resolver, admin grid and screenshot harness exactly as shipped; no mechanism changes.
**Requirements**: THEME-05
**Success Criteria** (what must be TRUE):

  1. `themes/clinical.css`, `themes/retro.css`, `themes/atelier.css`, `themes/market.css` exist, each a single `[data-theme]` block with all 23 tokens as hex plus a `@theme` header (label, industry, synopsis); `build-themes.mjs --check` passes and the committed manifest lists seven themes
  2. Display fonts named by the direction doc (Orbitron/Righteous, Fraunces, Nunito) load via `next/font` with `preload: false` and reach `--store-font-display`; volt-dark pages pay no extra font bytes
  3. Each preset is captured across the seven-route grid; the three light presets (clinical, atelier, market) have their overlays and shadows inspected with every judgement recorded, fixes made only where something reads wrong
  4. The admin Appearance page shows all seven cards with industry and synopsis; selecting any of the four new presets switches the storefront on the next request; `scan:tokens` stays at 0 and the 23-token contract is unchanged

**Plans**: 4/4 plans executed

Plans:

**Wave 1**

- [x] 06.1-01-PLAN.md — Tracer: `clinical` end to end — theme file, validator, regenerated manifest, served `data-theme`, first capture grid; opens `06.1-SCREENSHOTS.md`

**Wave 2** *(blocked on Wave 1)*

- [x] 06.1-02-PLAN.md — `retro`/`atelier`/`market` theme files, three `next/font` display faces in the root layout, regenerate to seven entries, switch probe and full gate

**Wave 3** *(blocked on Wave 2)*

- [x] 06.1-03-PLAN.md — Wire both type tokens site-wide per D-10: `--store-font-sans` on the body, `font-display` on 23 storefront headings; register the `volt-dark` system-font→Geist shift as snap `S-TYPE-01` and prove every preset's display face renders

**Wave 4** *(blocked on Wave 3)*

- [x] 06.1-04-PLAN.md — Canonical capture grids for all four presets, light-preset acid tests with every judgement recorded, per-preset backlog, phase-close roll-up, THEME-05 marked complete

**UI hint**: yes

### Phase 7: Layout Switches

**Goal**: Admins can change a page template's structure — category density, home hero style, product gallery position — through enumerated, server-chosen variant components, independent of which theme is active.
**Depends on**: Phase 5 — variant components must themselves be written in token classes. Architecturally independent of Phase 6; can be planned or built in parallel with it, but lands after Phase 5.
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04
**Success Criteria** (what must be TRUE):

  1. Admin can set `appearance.category_layout` to `grid-3`, `grid-2`, or `list`, and the category page renders the matching named server component
  2. Admin can set `appearance.home_hero` to `full-bleed`, `split`, or `minimal`, and the home page renders the matching named server component
  3. Admin can set `appearance.product_gallery` to `left` or `top`, and the product page renders the matching named server component
  4. Every layout variant component has a passing render test, and none of the three switches is implemented as a generic `layout` prop

**Plans**: 3/5 plans executed

Plans:

**Wave 1**

- [x] 07-01-PLAN.md — TRACER: enums + `getLayoutSettings()` + `layout.unknown_selection` telemetry + the category switch end to end, today's grid extracted byte-identically and `list` proven live on a dev server; opens `07-SCREENSHOTS.md` with the pre-extraction baseline

**Wave 2** *(blocked on Wave 1; 07-02, 07-03 and 07-04 touch disjoint files)*

- [x] 07-02-PLAN.md — Home hero switch: `minimal` extracted verbatim, `split` and `full-bleed` added, scrim fenced by an inline scanner sentinel, home page rewired and probed live
- [x] 07-03-PLAN.md — Product gallery switch: `left` extracted verbatim, `top` added, media helper moved out, typed enum crossing the server→client boundary, product page rewired and probed live
- [ ] 07-04-PLAN.md — Admin Layout section: independent `LayoutSwitches` island with three radiogroups, one three-key save through the existing guarded settings endpoint, hosted below the theme grid

**Wave 3** *(blocked on Wave 2)*

- [ ] 07-05-PLAN.md — Repo-wide LAYOUT-04 contract test, all eight variants captured under both presets, defaults-parity hash diff against the pre-extraction baseline, requirement register and phase-close roll-up

**UI hint**: yes

### Phase 8: Documentation & Visual QA Close-out

**Goal**: The theming system is documented well enough for someone to add a new theme without re-deriving the mechanism, and the shipped presets and layout variants are verified together, not just individually.
**Depends on**: Phase 6, Phase 7 — documents and verifies both feature surfaces once stable
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):

  1. `docs/theming.md` documents the token contract, how to duplicate a theme file to create a new one, and how build validation fails on an invalid theme
  2. `docs/CLAUDE.md` reflects the theming system
  3. A visual QA pass covering every preset theme crossed with every layout variant is recorded with results
  4. `.planning/codebase/` structure/architecture docs carry a targeted refresh reflecting the token sweep and theme mechanism

**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 5 → 6 → 7 → 8 (7 may be built in parallel with 6 once 5 is done)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security and Admin-Auth Truth | v1 | 4/4 | Complete | 2026-09-02 |
| 2. Observability and Regression Guards | v1 | 5/5 | Complete | 2026-09-02 |
| 3. Decision Lock-In and Operator Runbooks | v1 | 3/3 | Complete | 2026-09-02 |
| 4. Reference Documentation Refresh | v1 | 5/5 | Complete | 2026-09-02 |
| 5. Token Contract & Component Sweep | v2 | 12/12 | Complete    | 2026-09-04 |
| 6. Theme File Mechanism & Presets | v2 | 5/5 | Complete    | 2026-09-04 |
| 7. Layout Switches | v2 | 3/5 | In Progress|  |
| 8. Documentation & Visual QA Close-out | v2 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-01 from doc ingest (26 docs) and codebase map (2026-08-31)*
*v1 archived: 2026-09-02*
*v2 roadmap added: 2026-09-02 — 4 phases (5-8), 16/16 requirements mapped*
