# Phase 7: Layout Switches - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — four grey areas proposed in batch tables, all accepted by Russell

<domain>
## Phase Boundary

Admins can change a page template's structure — category density, home hero style, product gallery position — through enumerated, server-chosen variant components, independent of which theme is active. Three switches stored in D1 (`appearance.category_layout`, `appearance.home_hero`, `appearance.product_gallery`), resolved server-side per request, rendered by named variant components, chosen from a Layout section on the admin Appearance page, each variant with a render test and screenshot evidence.

In scope: LAYOUT-01..04. Out of scope: per-theme layout behaviours from the direction doc (masonry, steppers, chips), a generic `layout` prop, live preview, any change to the 23-token contract or the theme mechanism.

</domain>

<decisions>
## Implementation Decisions

### Resolution & storage
- **D-01:** Enumerations live in `lib/layout/variants.ts`: `CATEGORY_LAYOUTS = ['grid-3','grid-2','list'] as const`, `HOME_HEROES = ['full-bleed','split','minimal'] as const`, `PRODUCT_GALLERIES = ['left','top'] as const`, their union types, and a `DEFAULT_LAYOUTS` object. This is the single source for the server switch, the admin controls and the tests.
- **D-02:** `getLayoutSettings()` in `lib/layout/settings.ts` reads the `appearance` category once per request via the same `getSettings()` path `getActiveTheme()` uses (request-scoped cache), validates each stored value against its enum, and returns `{ categoryLayout, homeHero, productGallery }`. The category, home and product server pages call it; the root layout is not involved. No isolate-level cache, no Suspense.
- **D-03:** An unknown or malformed stored value falls back to that switch's default and emits `layout.unknown_selection` (severity `warning`, sampleRate 1) registered in `TELEMETRY_EVENTS` only, with the same parity test pattern as `theme.unknown_selection` (never in `TAIL_CRITICAL_EVENTS`). Absent/empty values are the normal first-load state: default, no telemetry.
- **D-04:** Defaults reproduce today's look exactly: `category_layout = grid-3`, `home_hero = minimal`, `product_gallery = left`. No env vars for layouts.

### Variant components
- **D-05:** Named components, one file each, under `components/layout/`: `category/CategoryGrid3.tsx`, `category/CategoryGrid2.tsx`, `category/CategoryList.tsx`; `home/HomeHeroFullBleed.tsx`, `home/HomeHeroSplit.tsx`, `home/HomeHeroMinimal.tsx`; `product/ProductGalleryLeft.tsx`, `product/ProductGalleryTop.tsx`. Each page resolves its component through a typed lookup map keyed by the enum (`Record<CategoryLayout, ComponentType<Props>>`) with an exhaustiveness check. No component takes a `layout` prop (LAYOUT-04).
- **D-06:** Category variants: `grid-3` is today's grid (extracted verbatim from `CategoryDisplay.tsx`'s products section); `grid-2` is two columns at `lg` with larger cards; `list` is one row per product with the image left and name/price/CTA right, reusing `ProductCard`'s data contract. Sort/toggle controls stay in `CategoryDisplay`; only the products section becomes the variant.
- **D-07:** Home hero variants: `minimal` is today's centered text hero (extracted verbatim); `split` is copy left and the first featured product image right on `lg`, stacked below `lg`; `full-bleed` is a full-width band with the first featured product image behind a polarity-neutral scrim (`bg-black/NN` under the scanner sentinel, per Phase 6 precedent) and the copy overlaid. Hero image source is the first featured product's primary image; no new store-config field.
- **D-08:** Product gallery variants: `left` is today's two-column layout (gallery left, info right on `lg`); `top` is the gallery full width above the info block with a horizontal thumbnail strip. Gallery variants stay client components because image selection is client state; they are still named components chosen server-side by `app/product/[slug]/page.tsx` passing the resolved variant name into `ProductDisplay`, which maps it to the named component — never a generic `layout` prop.
- **D-09:** All variant components are written in token classes only (`scan:tokens` stays 0) and the frozen 23-token contract is unchanged.

### Admin UI
- **D-10:** A "Layout" section is added to the existing `/admin/settings/appearance` page below the theme grid (Phase 6 D-13 anticipated it). Admin keeps its hardcoded palette.
- **D-11:** Three labelled segmented controls (radio groups: "Category layout", "Home hero", "Product gallery"), each option a small inline line-art icon plus a label; no live preview. Keyboard: arrow keys move, Space/Enter select (same radiogroup semantics as `ThemePresetGrid`).
- **D-12:** An independent `components/admin/LayoutSwitches.tsx` client island with its own pending state and a "Save Layout" button, saving the three keys through the existing `POST /api/admin/settings` (category `appearance`), toast on success, error toast with retry. `ThemePresetGrid` is not modified. Same load-failure banner behaviour as the theme grid.

### Tests & QA
- **D-13:** One `renderToStaticMarkup` render test per variant (8) plus a switch-map exhaustiveness test per switch, following `tests/unit/components/account/subscription-manager.test.ts` and `tests/unit/app/admin-appearance-source.test.ts` (LAYOUT-04). `getLayoutSettings()` gets unit tests mirroring `active-theme.test.ts` (absent, empty, unknown, valid).
- **D-14:** Screenshot each variant on its route under `volt-dark` and under `luxe` (16 captures minimum) with the Phase 5 harness, recorded in `07-SCREENSHOTS.md`; the default variants must be pixel-identical to the pre-phase baseline under volt-dark (extraction is a no-op), non-default variants are new intentional captures, not diffs.

### Claude's Discretion
- Exact spacing/typography of `grid-2`, `list`, `split`, `full-bleed`, `top` within the UI-SPEC's contracts; icon artwork; whether `getLayoutSettings()` and `getActiveTheme()` share a small internal `readAppearance()` helper (fine if it does not change `getActiveTheme()`'s behaviour or tests).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/category/[slug]/CategoryDisplay.tsx` (client; sort toggles + products grid at ~line 133), `app/category/[slug]/page.tsx` (server; passes `products`).
- `app/page.tsx` (server; hero section ~line 57, featured grid ~line 74; `featuredProducts` from `getProductsByCategory("cat_1")`).
- `app/product/[slug]/ProductDisplay.tsx` (client; gallery grid ~line 151, `allImages`, `selectedImage`), `app/product/[slug]/page.tsx` (server).
- `components/ProductCard.tsx` (card contract for grid/list), `lib/themes/active-theme.ts` (settings read + telemetry pattern to mirror), `lib/observability/telemetry.ts` `TELEMETRY_EVENTS`, `tests/unit/workers/observability-tail-core.test.ts` (parity precedent).
- `components/admin/ThemePresetGrid.tsx` (radiogroup semantics, pending/save/toast pattern), `app/admin/settings/appearance/page.tsx` (page to extend), `app/api/admin/settings/route.ts` (POST `{ updates: [...] }`).
- `scripts/screenshot-routes.mjs` (`--label`, `--manifest`, `--base-url`, `--include-content`), `06.1-SCREENSHOTS.md` (record format).

### Established Patterns
- Server-side per-request D1 read with request-scoped cache; no isolate cache; no Suspense around it.
- Named components + typed lookup map, no free composition (research rule from the milestone).
- Tests via `renderToStaticMarkup` of a pure props-driven view; source-contract tests for wiring.
- Node 24 via `mise exec --`; vitest one-shot; commit-message files via `mktemp` (shell has `noclobber`).

### Integration Points
- `app/category/[slug]/page.tsx`, `app/page.tsx`, `app/product/[slug]/page.tsx` → `getLayoutSettings()` → variant map → named component.
- `app/admin/settings/appearance/page.tsx` → `LayoutSwitches` → `POST /api/admin/settings`.
- `TELEMETRY_EVENTS` → `layout.unknown_selection`.

</code_context>

<specifics>
## Specific Ideas

- The direction doc's per-theme layout ideas (Atelier masonry, Market steppers/chips, Retro perspective hero) stay out; the three enumerated switches are theme-independent by design.
- Phase 6 carry-overs still relevant: no Clerk session locally (admin walkthrough is a human check), the settings GET default re-insert bug on an empty category (pre-existing; the `appearance` category is no longer empty once a theme is saved, but a fresh install still hits it — note, don't fix here unless trivial).

</specifics>

<deferred>
## Deferred Ideas

- Live preview of layout variants in the admin; per-category layout overrides; theme-specific layouts — rejected/deferred per PROJECT.md decisions.

</deferred>
