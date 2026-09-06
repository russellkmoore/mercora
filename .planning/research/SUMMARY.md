# Project Research Summary

**Project:** Mercora / Voltique — v2 "Themeable Storefront" milestone
**Domain:** CSS-file-based storefront theming (design tokens + enumerated layout variants) retrofitted onto an existing Next.js 16 / Tailwind v4 / Cloudflare Workers commerce storefront
**Researched:** 2026-09-02
**Confidence:** HIGH

## Executive Summary

This is a brownfield theming retrofit, not a greenfield build. Experts solve "swap the look without touching component code" the way Shopify and WordPress block themes both do: a fixed token contract, a curated set of preset files, and enumerated (not free-composed) layout variants. Voltique's plan is stricter than either reference system — no per-theme markup, no free CSS injection, no open color picker — which is a deliberate scope reduction that keeps the combinatorial testing surface small. Every piece needed to build this already exists in the repo at current versions (Tailwind 4.3.3, PostCSS 8.5.26, Node built-ins); zero new dependencies are required.

The recommended approach is the milestone seed's own phase order, and research confirms the sequencing logic: freeze the ~18-token contract first, prove the CSS-cascade mechanism against the current look with zero visual change, *then* sweep 85+ files of hardcoded colors to token classes, *then* build the prebuild-validated theme-file mechanism and a light preset (which doubles as the sweep's acid test), *then* layout switches, which are architecturally independent of theming and can parallelize with it once the sweep lands.

The key risk is not the token mechanism — that part is small and low-risk. It's the sweep: 85 files including checkout, cart, and header (the owner's named regression-sensitive surfaces), plus dead-CSS shadcn/ui classes (`bg-popover`) that look tokenized but resolve to nothing, plus shadow/overlay treatments tuned only for the current dark look. A second real risk is operational: this repo's actual deploy path is `build:worker`, not `build` — an npm `prebuild` hook silently never fires on deploy, so theme validation must be wired explicitly into `build:worker` and `predev`, verified by deliberately breaking a theme file and running the real deploy script.

## Key Findings

### Recommended Stack

No new dependencies. Tailwind CSS 4.3.3 bundles `@import` natively (no `postcss-import` needed) and already resolves theme colors through the existing `runtimeColor()` CSS-relative-color-syntax helper — extend it to the full token set rather than replacing it. `postcss@8.5.26` (already a devDependency) is used purely as a parser (`postcss.parse()`, no plugin pipeline) inside a new `scripts/build-themes.mjs`, following this repo's existing plain-`.mjs`, zero-dependency script convention (`db-local-ensure.mjs`, `check-deploy-config.mjs`). Theme resolution stays entirely server-side (`getActiveTheme()` in `app/layout.tsx`, a per-request D1 read) — do not add `next-themes` (solves client-detected/localStorage theming, a different problem) or a CSS-in-JS library (contradicts the "no per-theme markup" rule and adds Workers-runtime risk for no benefit).

**Core technologies:**
- Tailwind CSS 4.3.3 (pinned, current) — utility classes resolve `bg-store-*` etc. through `var(--store-*)`; v4 bundles `@import` for the theme-file barrel with no extra plugin
- `postcss` 8.5.26 (existing devDependency, parse-only) — AST validator for the prebuild theme-file scanner; throws `CssSyntaxError` on malformed CSS for free
- Node built-ins (`node:fs`, `node:path`) — directory scan + codegen for `manifest.generated.ts`, matching every existing `scripts/*.mjs`
- Next.js App Router Server Components — `getActiveTheme()` D1 read + `data-theme` stamp on `<html>` in `app/layout.tsx`, before render, no client JS

### Expected Features

Reference systems (Shopify Online Store 2.0, WordPress block themes) both use swatch-preview pickers over curated presets and never hard-fail a bad theme at deploy time — Voltique's prebuild validation is strictly safer than either and is a genuine differentiator worth documenting. Confidence here is MEDIUM (web-search-sourced vendor behavior, not directly fetched docs), but the directional pattern is corroborated across independent sources.

**Must have (table stakes):**
- Theme picker with visual swatch previews, not a name dropdown
- Instant apply for shipped themes (no redeploy) via the existing D1-backed settings pattern
- Clear "currently active" indication in the picker
- Server-side theme resolution before first paint (no FOUC) — already the chosen architecture
- Fallback chain for an invalid/unknown stored theme value, with telemetry
- Both light and dark options present (at least one of each)
- Layout switches as mutually-exclusive segmented controls/radio groups, not checkboxes
- Settings persist through the existing `admin_settings` save pattern (reuse verbatim)

**Should have (differentiators):**
- Build-time validated theme contract that fails the build on a bad theme file — Shopify/WP never do this
- One canonical token contract shared by every theme, no per-theme additions (explicit governance note)
- Telemetry on unknown/invalid theme selection — neither reference system does this

**Defer (v2.x / explicitly rejected):**
- Live theme preview before saving — P3, not this milestone
- Free-form CSS/custom code injection per theme — rejected on principle
- Open color picker per token — rejected, explodes testing surface
- Per-category (vs per-template) layout overrides — rejected, no demonstrated need
- Customer-selectable (per-shopper) themes — separate milestone if ever pursued
- Admin dashboard theming — never in this milestone

### Architecture Approach

This is a brownfield integration with no external unknowns (HIGH confidence, verified directly against the codebase). A prebuild script becomes the single source of truth for the theme registry, generating a typed manifest and CSS barrel from `themes/*.css` files — no wrangler var, no hand-maintained list. Theme resolution is a blocking, per-request D1 read in the already-`force-dynamic` root layout, stamping `data-theme` on `<html>`; all visual variation after that is pure CSS cascade, no React branching on theme name. Layout switches follow a distinct but parallel pattern: named enumerated variant components (`CategoryGrid3`, `CategoryGrid2`, `CategoryList`) chosen by a server-side switch, never a generic component with a `layout` prop — this is what keeps the "no free composition" rule structurally enforced rather than just a convention.

**Major components:**
1. `scripts/build-themes.mjs` (new) — prebuild scanner/validator/codegen, sibling to existing `scripts/build-with-public-env.mjs`
2. `lib/themes/active-theme.ts` (`getActiveTheme()`, new) — D1 → env → manifest-default fallback chain with telemetry on unknown values
3. `themes/*.css` (new) — one `[data-theme="name"]` block per theme, ~18 tokens, nothing else
4. Storefront component sweep (modified, widest blast radius) — 85+ files moved from hardcoded palette classes to token classes; admin explicitly excluded
5. `app/admin/settings/page.tsx` Appearance section (modified) — swatch cards + layout selects, reusing the existing settings API unchanged

### Critical Pitfalls

1. **A script named `prebuild` never runs on the real deploy path** — `deploy`/`deploy:ci` call `build:worker`, not `build`; npm's `pre*` convention only fires for the exact matching script name. Wire `build-themes.mjs` explicitly into `build:worker` and `predev`; verify by breaking a theme file and running `build:worker`, not `npm run build`.
2. **D1 theme read becomes either a latency tax or gets wrongly cached** — a module-level cache is unsafe on Cloudflare (isolates are reused unpredictably) and will serve a stale theme after an admin save. Accept the per-request D1 read as designed; if latency is ever a measured problem, use an edge cache with explicit purge-on-write, never an in-isolate variable.
3. **Wrapping the theme read in Suspense reintroduces the FOUC it was meant to eliminate** — `data-theme` must be present on the initial HTML for CSS to apply before first paint. Keep `getActiveTheme()` blocking, above any Suspense boundary, exactly where `getStoreConfig()` sits today.
4. **The sweep misses hardcodes outside `className` strings** — two literal hex values in `tailwind.config.ts` itself, dead shadcn/ui classes (`bg-popover`) that reference an undefined `--popover` variable and look tokenized but aren't, inline `style={}` props, and SVG fill/stroke. Grep the whole tree for raw hex/rgb literals and non-token palette names, not just `.tsx` classNames.
5. **The light preset exposes dark-tuned shadows/overlays even when every color token resolves correctly** — `shadow-lg`, `backdrop-blur`, and opacity overlays were tuned for one lighting direction and aren't caught by color-token verification. Treat every shadow/overlay class as a sweep target requiring visual QA under the light preset specifically.

## Implications for Roadmap

The milestone seed's Phase A–D structure is validated by research; the architecture research's "Build Order" section adds a sharper sequencing rationale within Phase A/B (token contract → no-op relocation → sweep, strictly sequential) that the roadmap should preserve as sub-steps rather than flattening. Suggested phase structure below maps directly onto the seed with pitfall/feature grounding added.

### Phase 1 (seed Phase A): Token contract and component/template sweep
**Rationale:** Everything else depends on the token names being frozen before any component is touched; re-touching swept files after a token rename is the single highest regression-risk mistake research identified. Must be internally sequential: (1) freeze ~18 tokens + wire through `runtimeColor()` in `tailwind.config.ts`, deleting hardcoded `border`/`ring` hex, (2) move current look verbatim into `themes/volt-dark.css` with `data-theme` stamped on `<html>` as a visual no-op checkpoint, (3) sweep components route by route with before/after screenshots.
**Delivers:** Full token contract wired through Tailwind; zero-regression relocation of current theme to a CSS file; all storefront components (excluding admin) on token classes.
**Addresses:** Table-stakes token contract + sweep; the "no per-theme markup" architectural constraint.
**Avoids:** Pitfall 4 (missed hardcodes in config/inline-styles/shadcn dead classes) and Pitfall 6 (undefined `bg-popover`-style classes mistaken for already-tokenized) — both require whole-tree grep and CSS-variable existence verification, not className pattern-matching, as the actual completion check.

### Phase 2 (seed Phase B): Theme file mechanism
**Rationale:** Only meaningful once the sweep exists to validate against — a second (light) theme is the sweep's own acid test, surfacing missed hardcodes that another dark theme never would.
**Delivers:** `scripts/build-themes.mjs` prebuild validator + generated manifest/CSS barrel; `getActiveTheme()` server resolution with fallback chain and telemetry (both taxonomy parity files updated); 2-3 shipped presets including one light theme; Admin Appearance section with swatch picker.
**Uses:** `postcss.parse()` for validation, existing `admin_settings`/`getSettings()` typed-getter pattern, existing telemetry taxonomy.
**Implements:** Generated-manifest-as-registry pattern; `data-theme`-on-`<html>` + CSS-cascade-only resolution pattern.
**Avoids:** Pitfall 1 (prebuild script wired into `build:worker`/`predev` explicitly, verified against the real deploy path, not `npm run build`), Pitfall 2 (no caching layer added preemptively), Pitfall 3 (theme read stays blocking, never wrapped in Suspense), Pitfall 5 (light preset gets explicit visual QA of shadow/overlay components, not just token-resolution checks).

### Phase 3 (seed Phase C): Layout switches
**Rationale:** Architecturally independent of the theme mechanism (different settings category, no shared code path) but depends on the sweep (Phase 1) being complete, since new variant components must themselves be written in token classes. Can be planned/built in parallel with Phase 2 but should land after Phase 1.
**Delivers:** Three enumerated layout switches (`category_layout`, `home_hero`, `product_gallery`) as named, server-chosen variant components; joined into the Appearance admin section.
**Addresses:** Table-stakes layout-switch feature; matches the "enumerated variants, never free composition" rule.
**Avoids:** Anti-pattern of a generic `layout` prop instead of separate named components (reopens the free-composition door the milestone rejects).

### Phase 4 (seed Phase D): Close-out
**Rationale:** Documentation and QA close-out after the mechanism and both feature surfaces are stable.
**Delivers:** `docs/theming.md`, visual QA matrix (2-3 presets × 3 layout variants), targeted `.planning/codebase/` doc refresh.
**Addresses:** Nothing new functionally — closes the loop on the milestone's own screenshot-diff mitigation commitment (capture per theme, not just per route; capture interactive states, not just resting pages; diff against the pre-sweep baseline, not PR-to-PR).

### Phase Ordering Rationale

- Token contract must be frozen before the sweep starts, and the sweep must be complete before the theme mechanism can be meaningfully tested (a light preset needs swept components to expose gaps) — this is a hard dependency chain, not a preference.
- Layout switches share only the settings-storage pattern and the Appearance admin UI home with theming; they have no code-path dependency on the theme mechanism itself, only on the sweep being done first (variant components must be written in token classes).
- This ordering directly avoids the two highest-severity pitfalls: re-touching swept files after a token rename (sequencing token contract before sweep), and shipping a light theme that looks broken due to untested shadow/overlay treatments (sequencing sweep before the light-preset acid test).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (sweep):** not for external unknowns — everything is codebase-internal — but the *scope* of the grep (whole-tree hex/rgb/non-token-palette search across `.ts`/`.tsx`/`.css`, not just `className` strings) should be spelled out explicitly in the phase plan, since this is exactly where a shallow first pass looks complete and isn't.
- **Phase 2 (theme mechanism):** the telemetry taxonomy byte-parity requirement (`lib/observability/telemetry.ts` + `workers/observability-tail/src/core.ts`) is a locked v1 rule worth flagging explicitly in the plan so it isn't discovered late.

Phases with standard patterns (skip research-phase):
- **Phase 2 (mechanism), Phase 3 (layout switches):** both follow existing, well-established precedent in this exact codebase (`getRefundPolicy()`-style typed getters, `build-with-public-env.mjs`-style prebuild scripts, existing `admin_settings` save flow) — no new pattern needs discovery, only application.
- **Phase 4 (close-out):** documentation and QA, no technical research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against `npm view` current registry versions and Context7 official Tailwind/PostCSS docs; zero new dependencies, all claims tied to what's already pinned in `package.json` |
| Features | MEDIUM | Shopify/WordPress vendor behavior sourced via web search, not directly fetched/cross-verified official docs in this pass; directional patterns (swatch pickers, no deploy-time validation, FOUC mechanics) corroborated across 2+ independent sources per claim |
| Architecture | HIGH | Every claim verified directly against current mercora source files (`app/layout.tsx`, `tailwind.config.ts`, `lib/db/schema/settings.ts`, etc.) — brownfield integration, no external ecosystem unknowns |
| Pitfalls | HIGH (codebase facts) / MEDIUM (general platform behavior) | Codebase-specific findings (85 files with hardcodes, dead `bg-popover` classes, `build:worker` vs `build` divergence) are directly verified; general Next.js/Cloudflare/browser-support claims are MEDIUM, standard web-platform knowledge |

**Overall confidence:** HIGH

### Gaps to Address

- Feature research confidence is MEDIUM because Shopify/WordPress vendor docs were web-searched, not directly fetched — acceptable since Voltique's approach is explicitly stricter/simpler than either reference system, so exact reference-system mechanics matter less than the directional pattern (swatch preview, curated presets, no free composition). No action needed unless a specific competitive claim becomes load-bearing for a UX decision.
- The exact shadow/overlay token strategy (a dedicated `shadow` token vs. a relative-color-syntax convention) is flagged as a real design decision in Pitfalls research but not resolved there — Phase 2 planning should pick one explicitly before the light preset is built, not discover it ad hoc during QA.
- Whether to gitignore or commit `lib/themes/manifest.generated.ts` is called out as an open choice in Architecture research (recommendation: gitignore + regenerate, matching `cloudflare-env.d.ts` precedent) — should be a one-line decision in the Phase 2 plan, not left implicit.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/tailwindcss` — `@import` bundling, `@theme` vs plain CSS-variable semantics, v4 compatibility
- Context7 `/postcss/postcss` — `postcss.parse()` AST usage, `CssSyntaxError` handling
- Direct repo inspection — `app/layout.tsx`, `tailwind.config.ts`, `lib/db/schema/settings.ts`, `lib/utils/settings.ts`, `app/api/admin/settings/route.ts`, `lib/observability/telemetry.ts`, `workers/observability-tail/src/core.ts`, `app/category/[slug]/page.tsx`, `app/admin/layout.tsx`, `app/globals.css`, `package.json`, `components/ui/*`, `components/checkout/OrderConfirmationModal.tsx`
- `npm view` registry checks (2026-09-02) confirming `tailwindcss`/`@tailwindcss/postcss`/`postcss` already at current latest
- `.planning/PROJECT.md`, `MILESTONE-SEED.md` — locked milestone decisions and phase sketch

### Secondary (MEDIUM confidence)
- Shopify.dev `settings_schema.json`/`settings_data.json`/input-settings docs (web-search snippets) — swatch-picker and preset-cap behavior
- WordPress `theme.json`/block-theme style-variation sources — palette/style-variation mechanics
- OpenNext Cloudflare caching docs — confirms `force-dynamic` routes bypass incremental/tag cache
- Independent technical writeups on FOUC/dark-mode-flash root cause (Aleksandr Hovhannisyan, Maxime Heckel) — corroborate the same mechanism from separate sources
- MDN CSS Relative Color Syntax browser support baseline — general web-platform knowledge, not independently re-verified this session

### Tertiary (LOW confidence)
- SaaS dark-mode/design-token blog posts (Merveilleux Design, Orbix Studio) — opinion/marketing synthesis, used only for general color-system framing, not load-bearing for any specific claim

---
*Research completed: 2026-09-02*
*Ready for roadmap: yes*
