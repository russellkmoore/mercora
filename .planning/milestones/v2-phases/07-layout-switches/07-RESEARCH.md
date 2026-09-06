# Phase 7: Layout Switches - Research

**Researched:** 2026-09-05
**Domain:** Server-chosen enumerated layout variants (Next.js 16 App Router / Cloudflare Workers / D1), retrofitted onto the theme mechanism built in Phase 6
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Resolution & storage
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

### Deferred Ideas (OUT OF SCOPE)
- The direction doc's per-theme layout ideas (Atelier masonry, Market steppers/chips, Retro perspective hero) stay out; the three enumerated switches are theme-independent by design.
- Live preview of layout variants in the admin; per-category layout overrides; theme-specific layouts — rejected/deferred per PROJECT.md decisions.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-01 | Admin can set `appearance.category_layout` (`grid-3 \| grid-2 \| list`); the category page renders the chosen named variant component server-side | Pattern 1 (variant map), Pattern 2 (getLayoutSettings), Pitfall 1 (dedup), Code Example (CategoryGrid3 extraction) |
| LAYOUT-02 | Admin can set `appearance.home_hero` (`full-bleed \| split \| minimal`); the home page renders the chosen named variant component server-side | Pattern 1, Pitfall 3 (hero image fallback), Code Example (HomeHeroMinimal extraction) |
| LAYOUT-03 | Admin can set `appearance.product_gallery` (`left \| top`); the product page renders the chosen named variant component server-side | Pattern 4 (client-component variant boundary), Pitfall 4 |
| LAYOUT-04 | Every layout variant has one render test; variants are enumerated union types and named components, never a generic `layout` prop | Validation Architecture, Don't Hand-Roll, Pattern 1's exhaustiveness check |
</phase_requirements>

## Summary

This phase has no new external unknowns — every mechanism (typed enum + lookup map, a D1 settings read mirroring `getActiveTheme()`, a `renderToStaticMarkup` render test, the existing admin settings save flow) already has a proven, working precedent in this exact codebase from Phase 6. The work is a wiring, extraction, and boundary-placement problem: pull the *existing* products-grid/hero/gallery JSX out of three files verbatim into eight new named components, write one small resolver (`getLayoutSettings()`) that is structurally a sibling of `getActiveTheme()`, and wire a second admin island next to (not inside) `ThemePresetGrid`.

Three things verified this session materially sharpen the plan versus a literal reading of `07-CONTEXT.md`. First, **`getSettings()` itself is not memoized** — only the D1 *connection* (`getDbAsync()`, via `React.cache()`) is request-scoped; the settings *query* is not. D-02's parenthetical "(request-scoped cache)" is therefore not automatically true: calling `getLayoutSettings()` from a page after the root layout already called `getActiveTheme()` executes a **second** `SELECT ... WHERE category = 'appearance'` D1 query in the same request, not a cache hit. This is cheap (D1 reads are already accepted, per-request, for theme resolution) but should be an explicit, informed choice, not an assumption — see Pitfall 1 for the two viable resolutions. Second, **`app/page.tsx`'s `export const revalidate = 3600` has no effect**: the root layout's `export const dynamic = "force-dynamic"` wins, and a real `npm run build` in this session confirms `/` is emitted as `ƒ` (dynamic, server-rendered on demand), not static/ISR — so there is no risk of a stale `home_hero` value surviving inside an hour-old cached page; every page in this app renders fresh per request already. Third, **the admin settings GET/POST endpoint has a pre-existing empty-category bug** (carried in WINDOWS #3 from Phase 6): a `GET ?category=appearance` that finds zero rows re-inserts the *entire* `defaultSettings` array (which has no `appearance` entries at all) and then returns **every** category's rows, not just `appearance`'s — this only matters for a install that has never saved a theme *or* a layout switch; once Phase 6 shipped, `appearance.theme` is normally already present, closing the gap for most real deployments, but a genuinely fresh D1 still hits it.

**Primary recommendation:** Extract the three pages' existing JSX verbatim into eight new `components/layout/**` files with zero visual change, write `getLayoutSettings()` as a structural sibling of `getActiveTheme()` (same fallback chain, same telemetry-only-on-unknown rule, same "never isolate-cached" posture), wire it directly into the three server pages (never the root layout), and build `LayoutSwitches.tsx` as an independent client island beside `ThemePresetGrid`, not inside it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout settings resolution (`getLayoutSettings()`) | API/Backend (Server Component, RSC) | Database/Storage (D1 read via `getSettings()`) | Per-request, blocking, server-only; called from three page components, never the root layout (D-02) |
| Variant selection (typed lookup map + exhaustiveness check) | API/Backend (server-only TS module, called at render time) | — | The map lives beside each page/display component; selection happens server-side (category, home) or is passed server→client as a resolved name (product gallery), never inferred client-side |
| Category/home variant rendering | Browser/Client (CSS) + Frontend Server (RSC) | — | Category/home variants are plain server-rendered JSX (no client state of their own); `CategoryDisplay`'s sort toggles stay client, wrapping the server-chosen variant as `children`-equivalent |
| Product gallery variant rendering | Browser/Client (`"use client"` component) | API/Backend (server picks the name) | Gallery variants stay client components because image-thumbnail selection is client state (D-08); the server page resolves *which* named component, the client component never infers the variant itself |
| Admin Layout switches UI | Frontend Server (RSC route, existing) + Browser/Client (new island) | API/Backend (`POST /api/admin/settings`) | `LayoutSwitches.tsx` is a new client island beside the existing `ThemePresetGrid`, on the same existing Appearance route; persistence reuses the existing settings API verbatim |
| Telemetry (`layout.unknown_selection`) | API/Backend (`lib/observability/telemetry.ts`) | — | Registered in `TELEMETRY_EVENTS` only, following the exact `theme.unknown_selection` precedent; the tail Worker's critical-only list is untouched |

## Standard Stack

### Core

No new runtime or dev dependencies. Everything below is already pinned in `package.json` and already exercised by Phase 6.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router Server Components | `next@16.3.1` (pinned, confirmed via `package.json`) [VERIFIED: package.json, read this session] | Server-side variant selection in the three page files | Already the architecture for `getActiveTheme()`; no new pattern to introduce |
| Drizzle ORM / D1 (`getSettings()`) | already used | Reads `appearance` category rows for the three layout keys | Reuses `lib/utils/settings.ts` verbatim, the exact helper `getActiveTheme()` calls |
| `react-dom/server` (`renderToStaticMarkup`) | bundled with React (already a test dependency, used by `subscription-manager.test.ts` and `admin-appearance-source.test.ts`) | Per-variant render tests (LAYOUT-04) | Established, working precedent in this exact repo; no jsdom/`@testing-library/react` present or needed |

### Supporting

No supporting libraries — this phase adds zero npm packages. All new code (`lib/layout/variants.ts`, `lib/layout/settings.ts`, eight variant components, `LayoutSwitches.tsx`) is hand-written, following existing repo conventions.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A typed lookup map + exhaustiveness check per switch | A single generic `<Layout variant={name}>` wrapper component | Rejected — this is exactly the anti-pattern LAYOUT-04 and the milestone's "never a generic `layout` prop" rule forbid; a wrapper re-opens the free-composition door the milestone closes |
| A second, small `getLayoutSettings()` reading the `appearance` category itself | Widening `getActiveTheme()` to also return layout keys | Rejected by D-02 (`getActiveTheme()`'s own tests and contract are frozen from Phase 6; the root layout is explicitly not involved in layout-switch resolution) |
| Accepting a second per-request D1 read for `getLayoutSettings()` | Wrapping `getSettings()` itself in `React.cache()` so the root layout's read and the page's read collapse into one | Viable minor optimization (see Pitfall 1) but out of scope unless the planner explicitly opts in — changing `getSettings()`'s memoization semantics is a shared-helper change that also affects every other caller (`getRefundPolicy()`, `getStoreSettings()`, etc.), not scoped to this phase by CONTEXT.md |

**Installation:** none — no `npm install` step for this phase.

**Version verification:** `next@16.3.1` is the version already installed and pinned in `package.json` [VERIFIED: package.json, read this session]. No registry lookup needed since nothing new is being added.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** Every mechanism (variant maps, D1 settings read, render tests) reuses dependencies already vetted in Phase 6. No `npm view` / `package-legitimacy check` run was required.

## Architecture Patterns

### System Architecture Diagram

```
REQUEST TIME — three independent page renders, each reading the SAME D1 category

app/category/[slug]/page.tsx          app/page.tsx                   app/product/[slug]/page.tsx
        │                                   │                                    │
        ▼                                   ▼                                    ▼
  getLayoutSettings()               getLayoutSettings()                 getLayoutSettings()
  lib/layout/settings.ts            (same function)                     (same function)
    1. getSettings('appearance')      — reads appearance.category_layout,
       appearance.home_hero, appearance.product_gallery in ONE category-scoped read
    2. validate each value against its own enum (lib/layout/variants.ts)
    3. unknown/malformed → that switch's DEFAULT_LAYOUTS value +
       layout.unknown_selection telemetry (once per switch, not per page)
    4. absent/empty → that switch's default, no telemetry
        │                                   │                                    │
        ▼                                   ▼                                    ▼
  CATEGORY_LAYOUT_MAP[value]        HOME_HERO_MAP[value]                (resolved name passed
  Record<CategoryLayout,            Record<HomeHero,                     as a prop into
  ComponentType>                    ComponentType>                       ProductDisplay, which
        │                                   │                            holds its OWN
        ▼                                   ▼                            PRODUCT_GALLERY_MAP —
  CategoryGrid3 |                   HomeHeroMinimal |                    D-08, client component)
  CategoryGrid2 |                   HomeHeroSplit |                            │
  CategoryList                      HomeHeroFullBleed                          ▼
  (server-rendered,                 (server-rendered;                   ProductGalleryLeft |
  wrapped by CategoryDisplay's      split/full-bleed need the           ProductGalleryTop
  existing client sort controls)    first featured product's            ("use client" — image
                                     image via resolveProductImageSrc)   selection is client state)

                              │
                              ▼
        No React branching on layout NAME past the resolved component choice —
        each variant is plain token-class JSX, exactly like a theme's CSS cascade
        is the only thing that varies after `data-theme` is resolved (Phase 6 precedent).

ADMIN — a new, independent island beside the existing theme grid
app/admin/settings/appearance/page.tsx
    ├── ThemePresetGrid.tsx          (existing, UNMODIFIED — Phase 6)
    └── LayoutSwitches.tsx           (NEW — D-12): own pending/save state,
                                      three radiogroups, POSTs the three
                                      appearance.* keys through the SAME
                                      existing /api/admin/settings endpoint
```

### Recommended Project Structure

```
lib/layout/
├── variants.ts                    # NEW — CATEGORY_LAYOUTS/HOME_HEROES/PRODUCT_GALLERIES,
│                                  #   their union types, DEFAULT_LAYOUTS (D-01)
└── settings.ts                    # NEW — getLayoutSettings() (D-02)
components/layout/
├── category/
│   ├── CategoryGrid3.tsx          # NEW — verbatim extraction (D-06)
│   ├── CategoryGrid2.tsx          # NEW
│   └── CategoryList.tsx           # NEW
├── home/
│   ├── HomeHeroMinimal.tsx        # NEW — verbatim extraction (D-07)
│   ├── HomeHeroSplit.tsx         # NEW
│   └── HomeHeroFullBleed.tsx     # NEW
└── product/
    ├── ProductGalleryLeft.tsx     # NEW — verbatim extraction, "use client" (D-08)
    └── ProductGalleryTop.tsx      # NEW — "use client"
app/category/[slug]/
├── page.tsx                       # MODIFIED — calls getLayoutSettings(), resolves
│                                  #   CATEGORY_LAYOUT_MAP, passes variant to CategoryDisplay
└── CategoryDisplay.tsx            # MODIFIED — sort controls stay; products section
                                   #   becomes `<Variant products={sortedProducts} />`
app/
└── page.tsx                       # MODIFIED — calls getLayoutSettings(), resolves
                                    #   HOME_HERO_MAP, renders the chosen hero component
app/product/[slug]/
├── page.tsx                       # MODIFIED — calls getLayoutSettings(), passes
│                                  #   resolved productGallery name into ProductDisplay
└── ProductDisplay.tsx             # MODIFIED — holds PRODUCT_GALLERY_MAP, renders the
                                   #   named gallery component, gallery-only JSX extracted out
components/admin/
└── LayoutSwitches.tsx             # NEW — independent island (D-12)
app/admin/settings/appearance/
└── page.tsx                       # MODIFIED — renders <ThemePresetGrid /> AND
                                   #   <LayoutSwitches /> (D-10)
lib/observability/telemetry.ts     # MODIFIED — layout.unknown_selection added
tests/unit/lib/layout/
├── variants.test.ts               # NEW — exhaustiveness per switch (D-13)
└── settings.test.ts               # NEW — getLayoutSettings(), mirrors active-theme.test.ts
tests/unit/components/layout/
└── *.test.ts                      # NEW — one renderToStaticMarkup test per variant (8)
```

### Pattern 1: Typed lookup map with exhaustiveness check (the LAYOUT-04 anti-genericity control)

**What:** A `Record<Enum, ComponentType<Props>>` plus a compile-time exhaustiveness assertion, so adding a new enum member without adding its component/map entry is a type error, not a runtime fallback.
**When to use:** All three switches — category layout, home hero, product gallery.
**Example (skeleton, illustrative):**
```ts
// lib/layout/variants.ts (D-01)
export const CATEGORY_LAYOUTS = ["grid-3", "grid-2", "list"] as const;
export type CategoryLayout = (typeof CATEGORY_LAYOUTS)[number];

export const HOME_HEROES = ["full-bleed", "split", "minimal"] as const;
export type HomeHero = (typeof HOME_HEROES)[number];

export const PRODUCT_GALLERIES = ["left", "top"] as const;
export type ProductGallery = (typeof PRODUCT_GALLERIES)[number];

export const DEFAULT_LAYOUTS = {
  categoryLayout: "grid-3" as CategoryLayout,   // D-04: reproduces today's look
  homeHero: "minimal" as HomeHero,
  productGallery: "left" as ProductGallery,
} as const;
```
```tsx
// app/category/[slug]/page.tsx — the map + exhaustiveness check
import CategoryGrid3 from "@/components/layout/category/CategoryGrid3";
import CategoryGrid2 from "@/components/layout/category/CategoryGrid2";
import CategoryList from "@/components/layout/category/CategoryList";
import type { CategoryLayout } from "@/lib/layout/variants";
import type { ComponentType } from "react";

const CATEGORY_LAYOUT_MAP: Record<CategoryLayout, ComponentType<{ products: Product[] }>> = {
  "grid-3": CategoryGrid3,
  "grid-2": CategoryGrid2,
  "list": CategoryList,
};
// If CategoryLayout ever gains a member without a matching map entry, this
// line fails to typecheck — the exhaustiveness check LAYOUT-04 requires.
```
This mirrors `06-04`'s own `THEME_MANIFEST.some((theme) => theme.name === pendingTheme)` allow-list discipline, applied at the type level instead of a runtime `.some()` check, since here the member set is a literal union, not build-time-generated data.

### Pattern 2: `getLayoutSettings()` — structural sibling of `getActiveTheme()`

**What:** A second, small resolver in `lib/layout/settings.ts` reusing `getSettings('appearance')`, following `getActiveTheme()`'s exact shape: try/catch around the D1 read, absent/empty/null → default silently, present-but-invalid → default + one telemetry call, present-and-valid → the value, trimmed.
**When to use:** Called directly (never Suspense-wrapped) from the three server pages — never the root layout (D-02 is explicit that the root layout is not involved).
**Example (skeleton, illustrative — follows `lib/themes/active-theme.ts:41-84`, read this session, verbatim in structure):**
```ts
// lib/layout/settings.ts
import { getSettings } from "@/lib/utils/settings";
import { recordTelemetry } from "@/lib/observability/telemetry";
import {
  CATEGORY_LAYOUTS, HOME_HEROES, PRODUCT_GALLERIES, DEFAULT_LAYOUTS,
  type CategoryLayout, type HomeHero, type ProductGallery,
} from "@/lib/layout/variants";

export const APPEARANCE_SETTINGS_CATEGORY = "appearance"; // same category as theme (D-09 in 06-CONTEXT)

function resolveEnum<T extends string>(
  stored: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (stored === undefined || stored === null) return fallback; // absent: normal, no telemetry
  if (typeof stored !== "string") {
    recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
    return fallback;
  }
  const trimmed = stored.trim();
  if (trimmed === "") return fallback; // empty: normal, no telemetry
  if ((allowed as readonly string[]).includes(trimmed)) return trimmed as T;
  recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
  return fallback;
}

export async function getLayoutSettings(): Promise<{
  categoryLayout: CategoryLayout;
  homeHero: HomeHero;
  productGallery: ProductGallery;
}> {
  let settings: Record<string, unknown> = {};
  try {
    settings = await getSettings(APPEARANCE_SETTINGS_CATEGORY);
  } catch {
    // A DB hiccup degrades to defaults, not a broken page — same posture as getActiveTheme().
  }
  return {
    categoryLayout: resolveEnum(settings["appearance.category_layout"], CATEGORY_LAYOUTS, DEFAULT_LAYOUTS.categoryLayout),
    homeHero: resolveEnum(settings["appearance.home_hero"], HOME_HEROES, DEFAULT_LAYOUTS.homeHero),
    productGallery: resolveEnum(settings["appearance.product_gallery"], PRODUCT_GALLERIES, DEFAULT_LAYOUTS.productGallery),
  };
}
```
This is illustrative, not literal production code — verify `recordTelemetry`'s exact call signature (it is exported and used identically by `lib/themes/active-theme.ts`, read this session) at implementation time.

### Pattern 3: Verbatim extraction preserves byte-identical default output

**What:** `grid-3`, `minimal`, and `left` must render pixel-identical to today's pre-phase baseline (D-14). The safe extraction technique already established in this codebase (Phase 5's `05-04` note: "sort-toggle active indicator... marked `!important` to restore the exact prior pixel") is: copy the JSX verbatim into the new file first, wire the import, and only then consider any refactor — never rewrite-while-extracting.
**When to use:** `CategoryGrid3.tsx` (from `CategoryDisplay.tsx`'s `<section className="grid ...">` block, verified at `app/category/[slug]/CategoryDisplay.tsx` lines 128-140 this session), `HomeHeroMinimal.tsx` (from `app/page.tsx`'s `<section className="max-w-6xl ... text-center ...">` hero block, lines 56-69), `ProductGalleryLeft.tsx` (from `app/product/[slug]/ProductDisplay.tsx`'s image-gallery `<div>` block, lines 149-179).
**Verified current code — `CategoryDisplay.tsx`'s products section (to extract as `CategoryGrid3`):**
```tsx
// Source: app/category/[slug]/CategoryDisplay.tsx:128-140 (read this session)
<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
  {sortedProducts.length > 0 ? (
    sortedProducts.map((product) => (
      <ProductCard key={product.id} product={product} />
    ))
  ) : (
    <div className="col-span-full text-center text-muted-foreground py-8">
      No products found in this category.
    </div>
  )}
</section>
```
Sort/toggle state (`sortBy`, the `ToggleGroup`) stays in `CategoryDisplay`; only this `<section>` becomes `<CategoryGrid3 products={sortedProducts} />` (D-06). `CategoryDisplay` remains `"use client"` and imports the resolved variant component as a prop or via its own copy of `CATEGORY_LAYOUT_MAP` — see Pitfall 2 for which is cleaner.

### Pattern 4: Client-component variant boundary for the product gallery (D-08)

**What:** The gallery variant choice happens server-side (`app/product/[slug]/page.tsx` calls `getLayoutSettings()`), but the rendering happens client-side (`ProductDisplay`, `"use client"`, owns `selectedImage` state). The server passes the **resolved enum value** (a string literal, e.g. `"left"`), never a generic `layout` prop with free-form meaning — `ProductDisplay` then does its own `PRODUCT_GALLERY_MAP` lookup and renders the named component, passing it the image state and setters it needs.
**When to use:** Exactly this one case — the only place in the phase where resolution (server) and rendering (client) are split across the server/client boundary.
**Example (illustrative):**
```tsx
// app/product/[slug]/page.tsx
const { productGallery } = await getLayoutSettings();
// ...
<ProductDisplay product={product} productGallery={productGallery} /* ...other props */ />
```
```tsx
// app/product/[slug]/ProductDisplay.tsx — adds one new prop, one new internal map
import ProductGalleryLeft from "@/components/layout/product/ProductGalleryLeft";
import ProductGalleryTop from "@/components/layout/product/ProductGalleryTop";
import type { ProductGallery } from "@/lib/layout/variants";

const PRODUCT_GALLERY_MAP: Record<ProductGallery, ComponentType<GalleryProps>> = {
  left: ProductGalleryLeft,
  top: ProductGalleryTop,
};

interface ProductDisplayProps {
  // ...existing props
  productGallery: ProductGallery; // NOT `layout` — the resolved enum value, typed
}
```
The prop name is `productGallery: ProductGallery` (a member of the frozen union), not `layout: string` — this is the literal difference LAYOUT-04 tests for. `GalleryProps` carries `allImages`, `selectedImage`, `setSelectedImage`, `getMediaUrl` (or an equivalent), exactly the state `ProductDisplay` already owns at lines 96-100 (read this session) — the gallery variant is a pure, controlled view over that existing state, not a second source of truth.

### Anti-Patterns to Avoid

- **A generic `layout` prop threaded through any component** (`<ProductDisplay layout="left" />`, `<CategoryDisplay layout="grid-3" />`): this is the exact anti-pattern LAYOUT-04 and the milestone's "never a generic `layout` prop" rule exist to prevent. Every prop/parameter carrying a resolved variant must be typed to the specific union (`CategoryLayout`, `HomeHero`, `ProductGallery`), never a bare `string` or a shared cross-switch name.
- **Widening `getActiveTheme()` to also resolve layout keys:** rejected by D-02; keep the two resolvers structurally parallel but functionally independent, matching the "different settings category, no shared code path" architecture research already established for this phase (`.planning/research/SUMMARY.md`).
- **Wrapping `getLayoutSettings()` in `<Suspense>`:** would let the page start streaming before the layout choice is known, producing a flash of the wrong variant on first paint — same reasoning as Phase 6 Pitfall 3 for theme resolution, reproduced here for a second D1-backed resolver.
- **Re-deriving hero/gallery image logic instead of reusing `resolveProductImageSrc`:** `ProductDisplay.tsx` has its own **local, non-shared** `getMediaUrl()` helper (lines 66-70, read this session) which duplicates — less robustly — what `lib/utils/product-image.ts`'s exported `resolveProductImageSrc()` already does (it also strips a leading-slash-less R2 key and falls back to a placeholder). The home hero's `split`/`full-bleed` variants should call `resolveProductImageSrc()` directly (the module ProductCard already uses), not reinvent a third image-resolution helper.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Layout-name-to-component resolution | A generic `<Layout name={x}>` switch component, or an `if/else`/`switch` chain re-derived per page | A `Record<Enum, ComponentType>` map + exhaustiveness check (Pattern 1) | The map IS the anti-genericity control LAYOUT-04 requires; a switch statement can silently fall through on a new enum member without a compiler error, a map with an exhaustiveness assertion cannot |
| Featured-product hero image resolution | A new hero-specific image URL builder | `resolveProductImageSrc()` from `lib/utils/product-image.ts` (already used by `ProductCard.tsx`) | Already handles both stored image shapes (flat and MACH), R2-key-without-leading-slash normalization, and a placeholder fallback — exactly what a hero image needs and exactly what `ProductDisplay.tsx`'s own local `getMediaUrl()` does *not* fully replicate (see Anti-Patterns) |
| D1-backed settings resolution with fallback + telemetry | A bespoke read/validate/fallback function for layouts | Mirror `getActiveTheme()`'s exact structure (Pattern 2) | The fallback chain, telemetry-only-on-unknown rule, and "never isolate-cached" posture are all proven, tested, and already reviewed in Phase 6; re-deriving them risks silently diverging (e.g., telemetry-ing the normal absent-row case, which Phase 6's own Pitfall 6 explicitly warned against) |
| Radiogroup keyboard semantics for the three new segmented controls | A new arrow-key/roving-tabindex implementation | `ThemePresetGrid.tsx`'s exported, unit-tested `nextRovingIndex()` helper (or a structurally identical copy) | `nextRovingIndex()` is already extracted as a pure, directly-testable function specifically because this repo has no jsdom/`@testing-library/react` to drive real keydown events — reuse the same pattern rather than inventing a second one |

**Key insight:** Every mechanism this phase needs was already built once, in Phase 6, for the *theme* switch — layout switches are a second application of the identical shape (enum + fallback resolver + telemetry + admin radiogroup + render test), never a new pattern. The research risk here is not "what's the right approach" but "did the extraction actually preserve the existing pixel output," which is a screenshot-diff problem, not a design problem.

## Common Pitfalls

### Pitfall 1: `getLayoutSettings()` and `getActiveTheme()` both read the `appearance` category — not deduped by any existing cache
**What goes wrong:** A plan or implementer assumes D-02's "(request-scoped cache)" parenthetical means calling `getLayoutSettings()` after the root layout's `getActiveTheme()` call is a cache hit. It is not: `getSettings()` (`lib/utils/settings.ts:33-53`, read this session) is a plain `async function`, not wrapped in `React.cache()`. Only `getDbAsync()` — the D1 *connection* — is memoized per request [VERIFIED: `lib/db.ts:72`, read this session, `cache = React.cache(async () => ...)`]. So within one request: root layout calls `getSettings('appearance')` once (inside `getActiveTheme()`), and the category/home/product page calls `getSettings('appearance')` again (inside `getLayoutSettings()`) — two separate `SELECT ... WHERE category = 'appearance'` D1 queries, sharing only the already-open connection object.
**Why it happens:** `React.cache()` memoizes by function identity + arguments; `getDbAsync` is wrapped, `getSettings` is not, so the query itself re-runs even though "the DB connection is cached" is true and easy to over-generalize into "the query is cached."
**How to avoid:** Two viable resolutions, either acceptable — pick one explicitly in the plan rather than leaving it implicit:
  1. **Accept two reads per request** (simplest, zero shared-code risk): D1 reads are already the accepted per-request cost for theme resolution (`REQUIREMENTS.md` Out of Scope: "Caching layer for `getActiveTheme()`... accept the per-request D1 read"); a second small read of the same tiny category table is negligible and keeps `getLayoutSettings()` fully independent of `getActiveTheme()`'s internals.
  2. **Wrap `getSettings` itself in `React.cache()`** (the "Claude's Discretion" `readAppearance()` helper CONTEXT.md explicitly permits): a shared, request-memoized `readAppearance()` that both `getActiveTheme()` and `getLayoutSettings()` call would collapse both reads into one. This is a legitimate use of the discretion CONTEXT.md grants ("whether `getLayoutSettings()` and `getActiveTheme()` share a small internal `readAppearance()` helper... fine if it does not change `getActiveTheme()`'s behaviour or tests") — but changing `getSettings()` itself (rather than adding a new wrapper) would affect every other caller (`getRefundPolicy()`, `getStoreSettings()`, `getSocialMediaSettings()`, `getRecommendationSettings()`), which is out of this phase's scope; if pursued, the new caching must be added as a *new*, appearance-scoped wrapper function, not a change to the shared `getSettings()` signature.
**Warning signs:** None functionally — this doesn't break anything, it's a design-clarity gap. Surfaces only if someone later profiles D1 read counts per request and is surprised to find two identical-shaped queries.

### Pitfall 2: `CategoryDisplay`'s variant boundary can silently reintroduce a `layout` prop if placed carelessly
**What goes wrong:** `CategoryDisplay.tsx` is `"use client"` and owns `sortBy` state; the natural-looking refactor is to pass a `layout: CategoryLayout` prop straight into `CategoryDisplay` and have it do `if (layout === 'grid-3') ... else if ...` inline — which is functionally a generic `layout` prop even if the type is narrow, and reintroduces conditional branching instead of a lookup-map dispatch.
**Why it happens:** `CategoryDisplay` already receives `products` from the server page; adding one more prop feels like the path of least resistance, and the enum-typed prop name doesn't visually scream "anti-pattern" the way a bare `string` would.
**How to avoid:** Resolve the variant component in `app/category/[slug]/page.tsx` (the server page, which already calls `getLayoutSettings()`) via `CATEGORY_LAYOUT_MAP`, and pass **the resolved component** — not the enum value — down through `CategoryDisplay` as a prop typed `ComponentType<{ products: Product[] }>` (or render it as `children`/a render-prop slot). `CategoryDisplay` then renders `<ResolvedVariant products={sortedProducts} />` without ever branching on the enum name itself. This keeps the exhaustiveness check where it's checkable (the map definition) and keeps `CategoryDisplay` variant-agnostic.
**Warning signs:** Any `if (categoryLayout === ...)` / `switch (categoryLayout)` string comparison appearing inside a component that also renders JSX conditionally on that comparison — that is the generic-layout-prop anti-pattern with different syntax.

### Pitfall 3: The home hero's `split`/`full-bleed` image source has an unhandled empty case
**What goes wrong:** D-07 specifies the hero image source as "the first featured product's primary image," but `app/page.tsx`'s existing `featuredProducts` array (`getProductsByCategory("cat_1")` filtered to `status === "active"`, sliced to 3) can legitimately be empty — a fresh install with no products in the featured category, or every featured product inactive. `split`/`full-bleed` rendered with `featuredProducts[0]` undefined would need an explicit fallback, or the `<Image>` component receives an `undefined`/empty `src` and either crashes or silently renders broken.
**Why it happens:** The verbatim-extraction default (`minimal`) never touches product images at all — this failure mode is entirely new surface area introduced by the two non-default hero variants, easy to miss since the default path never exercises it.
**How to avoid:** Explicitly branch on `featuredProducts.length === 0` inside `HomeHeroSplit`/`HomeHeroFullBleed`: either render a graceful no-image fallback (reuse the same placeholder path `ProductCard.tsx` already falls back to, `/products/placeholder.png`, via `resolveProductImageSrc`'s own fallback parameter) or degrade to the `minimal` layout's copy-only presentation when there is no image to show. This is not covered by any locked decision — flag as an explicit plan decision, not an implicit assumption (see Assumptions Log A1).
**Warning signs:** A fresh/empty-catalog local dev environment (this repo's own local D1 fixture, noted in STATE.md as not matching the documented `data/d1/seed.sql`) showing a broken image icon or a Next.js `Image` runtime error on `/` when `home_hero` is set to `split` or `full-bleed`.

### Pitfall 4: The pre-existing settings-GET empty-category bug affects a genuinely fresh install's Layout section too
**What goes wrong:** `app/api/admin/settings/route.ts`'s `GET` handler (lines 38-50, read this session) re-inserts the **entire** `defaultSettings` array whenever a category-filtered query returns zero rows, then returns **all** categories' rows (not just the requested one). `defaultSettings` (`lib/db/schema/settings.ts`, read this session) has **no `appearance` category entries at all** — so a genuinely fresh D1 (no theme ever saved, no layout switch ever saved) hitting `GET ?category=appearance` will insert every *other* category's defaults (system, store, shipping, refund, promotions, recommendations) and return all of them, none of which is `appearance.*` — `LayoutSwitches.tsx` would see an empty settings response for its own keys and correctly fall back to its load-failure-banner-adjacent "use defaults" path, not a crash, but not what a literal reading of the endpoint's contract promises either.
**Why it happens:** Already flagged in Phase 6 (WINDOWS #3) as a pre-existing, out-of-scope bug in shared code neither phase is permitted to touch per its own interface contract.
**How to avoid:** Do not fix this file (out of scope, same as Phase 6's decision). `getLayoutSettings()`'s own fallback-to-default behavior on an absent/empty row already covers the server-render path correctly (it never depends on the GET endpoint's re-insert branch — it reads `getSettings('appearance')` via a different code path, `lib/utils/settings.ts`, which does **not** have this insert-on-empty behavior). Only `LayoutSwitches.tsx`'s **admin-side GET** (used to populate the initial radiogroup state) is exposed to this bug, identically to how `ThemePresetGrid.tsx` already is. Note it in the phase's own carried-forward WINDOWS entry rather than re-discovering it as a surprise; in practice, once Phase 6 ships, `appearance.theme` is normally already a row, which means the category is non-empty and this bug's empty-category branch is not triggered for most real deployments — only a truly virgin D1 hits it.
**Warning signs:** A brand-new local D1 (no `appearance.theme` row ever written) showing `LayoutSwitches`'s error banner on first load of `/admin/settings/appearance`, or the settings GET response containing `system.*`/`store.*`/etc. keys when only `?category=appearance` was requested.

### Pitfall 5: `home_hero`'s non-default variants must not accidentally break `revalidate = 3600`'s (already-inert) intent for future maintainers
**What goes wrong:** Not a functional bug today (verified: `app/page.tsx`'s `export const revalidate = 3600` has zero effect because the root layout's `export const dynamic = "force-dynamic"` forces every route dynamic — confirmed via a real `npm run build` this session, `/` emits as `ƒ` not `●`/ISR) — but a future maintainer reading `app/page.tsx` in isolation could reasonably conclude the home page is ISR-cached for an hour and "optimize" `getLayoutSettings()` by hoisting it above the per-request boundary, which WOULD matter if the dead `revalidate` export were ever removed and dynamic rendering stopped being forced elsewhere.
**Why it happens:** `revalidate = 3600` reads as an active, meaningful directive; nothing in `app/page.tsx` itself signals that the root layout's `force-dynamic` supersedes it.
**How to avoid:** No code change required for this phase — `getLayoutSettings()` should simply be called the same way `getActiveTheme()` already is (a direct, blocking, per-request call), which is already correct given the *current*, verified dynamic-rendering behavior. Worth a one-line comment at the `getLayoutSettings()` call site in `app/page.tsx` (or leaving the existing pattern as self-evidently correct) — flagged here so the plan doesn't spend effort "fixing" a non-problem, and so a future `revalidate`-export cleanup doesn't silently reintroduce ISR staleness for `home_hero`.
**Warning signs:** None expected this phase; this is a documentation/awareness note, not a defect.

## Code Examples

### `home/HomeHeroMinimal.tsx` — verbatim extraction target

```tsx
// Source: app/page.tsx:56-69 (read this session) — the exact JSX to extract unchanged
<section className="max-w-6xl mx-auto text-center mb-16 sm:mb-20">
  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight uppercase mb-4 sm:mb-6 leading-tight font-display">
    This Gear Powers Your Next Escape
  </h1>
  <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
    High-performance electric gear, rugged and designed for the edge of
    the map. Modular. Adaptable. Voltique.
  </p>
  <Link href="/category/featured" className="inline-block">
    <button className="px-4 sm:px-6 py-2 sm:py-3 text-base sm:text-lg font-semibold border border-primary text-primary hover:bg-primary hover:text-on-primary transition rounded">
      Shop Featured Gear
    </button>
  </Link>
</section>
```
The copy strings ("This Gear Powers Your Next Escape", etc.) are hardcoded English literals in the current source, not sourced from store-config — extract them unchanged; introducing a copy-config layer is out of this phase's scope.

### `product/ProductGalleryLeft.tsx` — verbatim extraction target

```tsx
// Source: app/product/[slug]/ProductDisplay.tsx:149-179 (read this session)
<div>
  <div className="relative aspect-3/4 w-full overflow-hidden rounded bg-surface-elevated">
    <Image
      src={getMediaUrl(selectedImage)}
      alt={typeof product.name === "string" ? product.name : ""}
      fill
      sizes="(min-width: 1024px) 50vw, 100vw"
      style={{ objectFit: "cover" }}
      className="object-cover"
    />
  </div>
  <div className="mt-3 flex gap-2 overflow-x-auto pb-2 sm:mt-4 sm:gap-3">
    {allImages.map((imageUrl, index) => (
      <button
        type="button"
        key={`thumb-${index}`}
        onClick={() => setSelectedImage(imageUrl)}
        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border sm:h-20 sm:w-20 ${
          selectedImage === imageUrl ? "border-primary" : "border-border"
        }`}
      >
        <Image src={getMediaUrl(imageUrl)} alt={`Thumbnail ${index + 1}`} fill style={{ objectFit: "cover" }} />
      </button>
    ))}
  </div>
</div>
```
`getMediaUrl`, `allImages`, `selectedImage`, `setSelectedImage` all need to be passed in as props (they currently live in `ProductDisplay`'s own closure) — this is the client-component variant boundary from Pattern 4. `ProductGalleryTop.tsx` is a new layout (horizontal thumbnail strip below a full-width image), not an extraction — it has no verbatim-pixel obligation since it's not the default.

### Telemetry registration (mirrors `theme.unknown_selection` exactly)

```ts
// lib/observability/telemetry.ts — TELEMETRY_EVENTS map (verified shape, lines 25-27 this session)
export const TELEMETRY_EVENTS = {
  'ai.response_guard_failed': { severity: 'error', sampleRate: 1 },
  'ai.response_guard_replaced': { severity: 'warning', sampleRate: 1 },
  'theme.unknown_selection': { severity: 'warning', sampleRate: 1 },
  'layout.unknown_selection': { severity: 'warning', sampleRate: 1 }, // NEW — same shape
  // ...
} as const;
```

```ts
// tests/unit/workers/observability-tail-core.test.ts — parity test to extend
// (verified pattern at lines 71-81 this session, follows theme.unknown_selection's own)
it('registers layout.unknown_selection at warning severity outside the tail critical list', () => {
  expect(TELEMETRY_EVENTS['layout.unknown_selection']).toEqual({
    severity: 'warning',
    sampleRate: 1,
  });
  expect(TAIL_CRITICAL_EVENTS).not.toContain('layout.unknown_selection');
});
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | When `featuredProducts` is empty, `split`/`full-bleed` should fall back to a placeholder image (not to the `minimal` layout) | Pitfall 3 | Medium — CONTEXT.md is silent on this exact case; a placeholder image is the path of least surprise (matches `ProductCard`'s own fallback), but the planner could reasonably choose "degrade to `minimal`'s copy-only treatment" instead — flag as an explicit plan decision, not an implicit pick |
| A2 | `getLayoutSettings()` and `getActiveTheme()` should NOT share a `React.cache()`-wrapped `readAppearance()` helper by default — accept two D1 reads per request unless the planner explicitly opts into the shared-cache variant | Pitfall 1 / Standard Stack Alternatives | Low — either choice satisfies D-02's letter; the two-reads default is simpler and lower-risk to `getActiveTheme()`'s existing, reviewed test suite, but costs one extra cheap D1 query per page render |
| A3 | `ProductGalleryLeft`/`ProductGalleryTop`'s shared gallery state (`allImages`, `selectedImage`, `setSelectedImage`, image-URL resolution) should be lifted to `ProductDisplay` and passed as props to both variants, rather than each variant independently reading `product.media`/`product.primary_image` | Pattern 4 / Code Examples | Low — CONTEXT.md's D-08 implies this ("gallery variants stay client components because image selection is client state"); the alternative (each variant re-deriving `allImages` itself) would duplicate the existing `useMemo` logic and risk the two variants drifting out of sync on image-shape handling |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does `ProductDisplay.tsx`'s local `getMediaUrl()` get replaced with `resolveProductImageSrc()` as part of this phase, or left as-is?**
   - What we know: `resolveProductImageSrc()` (`lib/utils/product-image.ts`) is the more robust, shared, already-tested helper `ProductCard.tsx` uses; `ProductDisplay.tsx`'s own `getMediaUrl()` (lines 66-70) is a narrower local duplicate that doesn't strip a leading-slash-less R2 key.
   - What's unclear: whether swapping it is in scope for this phase (it touches the *existing* default gallery rendering path, not just new variant files) or should be left alone to minimize blast radius on a file already being modified for the variant boundary.
   - Recommendation: leave `getMediaUrl()` as-is for the *default* (`left`) extraction (byte-identical output is the D-14 requirement); use `resolveProductImageSrc()` only for the genuinely *new* surface this phase introduces (the home hero's image, which has no existing local helper to preserve). Don't conflate an unrelated cleanup with this phase's extraction.

2. **Should `LayoutSwitches.tsx` re-fetch its own settings independently, or share a fetch with `ThemePresetGrid`?**
   - What we know: D-12 says "an independent... island with its own pending state," and `ThemePresetGrid` fetches `?category=appearance` on mount already.
   - What's unclear: two independent components both calling `GET /api/admin/settings?category=appearance` on the same page mount is two redundant network round-trips for the same category — harmless but slightly wasteful.
   - Recommendation: accept the duplication (matches D-12's explicit "independent" framing and keeps the two islands decoupled, which is also lower-risk for not touching `ThemePresetGrid` at all, per D-12's "not modified" instruction) — flag as a known, accepted minor inefficiency rather than something to fix.

## Environment Availability

Skipped — this phase has no new external tool/service dependency. D1 access, `react-dom/server`, and the existing settings API are all already available and already exercised by Phase 6 (verified via direct file reads and a real `npm run build`, not probes, since nothing new needs installing).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit: `vitest.config.mts`, `include: ["tests/unit/**/*.test.ts"]`) [VERIFIED: vitest.config.mts, read this session] |
| Config file | `vitest.config.mts` |
| Quick run command | `mise exec -- npx vitest run tests/unit/lib/layout/ tests/unit/components/layout/ tests/unit/workers/observability-tail-core.test.ts` |
| Full suite command | `mise exec -- npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | `CategoryGrid3`/`CategoryGrid2`/`CategoryList` each render correctly from the same `products` prop | unit (`renderToStaticMarkup`) | `mise exec -- npx vitest run tests/unit/components/layout/category/` | ❌ Wave 0 — new files |
| LAYOUT-01 | `CATEGORY_LAYOUT_MAP` is exhaustive over `CategoryLayout` | unit (type-level + runtime `Object.keys` assertion) | `mise exec -- npx vitest run tests/unit/lib/layout/variants.test.ts` | ❌ Wave 0 |
| LAYOUT-02 | `HomeHeroMinimal`/`HomeHeroSplit`/`HomeHeroFullBleed` each render correctly, including the empty-`featuredProducts` fallback for split/full-bleed | unit (`renderToStaticMarkup`) | `mise exec -- npx vitest run tests/unit/components/layout/home/` | ❌ Wave 0 |
| LAYOUT-03 | `ProductGalleryLeft`/`ProductGalleryTop` each render correctly given the same gallery state props | unit (`renderToStaticMarkup`) | `mise exec -- npx vitest run tests/unit/components/layout/product/` | ❌ Wave 0 |
| LAYOUT-02/03 | `getLayoutSettings()` resolves D1 → default correctly for each of absent/empty/unknown/valid, per switch | unit (mirrors `active-theme.test.ts`) | `mise exec -- npx vitest run tests/unit/lib/layout/settings.test.ts` | ❌ Wave 0 |
| LAYOUT-01/02/03 | Unknown stored value emits `layout.unknown_selection`, parity holds against the tail Worker's critical-only list | unit | `mise exec -- npx vitest run tests/unit/workers/observability-tail-core.test.ts` | ✅ exists, needs extension (not new file) |
| LAYOUT-04 | Default variants (`grid-3`, `minimal`, `left`) are pixel-identical to the pre-phase baseline | manual (screenshot diff) | `mise exec -- npm run screenshot:routes -- --label phase-07-defaults` (per route, under `volt-dark`) | ✅ harness exists |
| LAYOUT-01/02/03 | Every non-default variant renders correctly on its real route under `volt-dark` and `luxe` (16 captures minimum, D-14) | manual (screenshot, per variant per theme, via dev-bypass POST between captures) | `mise exec -- npm run screenshot:routes -- --label phase-07-<variant>-<theme>` (repeated per variant/theme combination) | ✅ harness exists; no variant-switching capability built into the script itself — switch via `x-dev-admin` POST between runs, per 06-04's own E2E proof pattern |
| LAYOUT-01/02/03 | Admin `LayoutSwitches` island: load, select, save, error-banner, radiogroup a11y | manual UAT (real Clerk browser session) + source-contract unit tests | `mise exec -- npx vitest run tests/unit/app/admin-layout-switches-source.test.ts` (new, mirrors `admin-appearance-source.test.ts`'s pattern exactly) | ❌ Wave 0 |
| — | Whole-tree scan stays 0 violations after 8 new variant files + `LayoutSwitches.tsx` | scripted | `mise exec -- npm run scan:tokens` | ✅ exists |

### Sampling Rate
- **Per task commit:** `mise exec -- npx vitest run tests/unit/lib/layout/ tests/unit/components/layout/ tests/unit/workers/observability-tail-core.test.ts` + `mise exec -- npm run scan:tokens`
- **Per wave merge:** `mise exec -- npm test` (full unit suite) + `mise exec -- npm run build` (proves every new component/page compiles and the route manifest is unaffected)
- **Phase gate:** Full suite green, `npm run scan:tokens` at 0 violations, `07-SCREENSHOTS.md` recording all 16+ captures (defaults byte-identical under `volt-dark`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/lib/layout/variants.test.ts` — exhaustiveness assertions for `CATEGORY_LAYOUT_MAP`/`HOME_HERO_MAP`/`PRODUCT_GALLERY_MAP` against their enum arrays
- [ ] `tests/unit/lib/layout/settings.test.ts` — covers `getLayoutSettings()` (absent/empty/unknown/valid × 3 switches), mirroring `tests/unit/lib/themes/active-theme.test.ts`'s exact structure
- [ ] `tests/unit/components/layout/category/*.test.ts`, `tests/unit/components/layout/home/*.test.ts`, `tests/unit/components/layout/product/*.test.ts` — one `renderToStaticMarkup` test per variant (8 total)
- [ ] `tests/unit/app/admin-layout-switches-source.test.ts` — mirrors `admin-appearance-source.test.ts`'s split of pure-view render tests + source-contract checks for the fetch/toast wiring `renderToStaticMarkup` can't observe
- [ ] `.planning/phases/07-layout-switches/07-SCREENSHOTS.md` — new manifest file for this phase's captures (does not exist yet; Phase 5/6 used their own phase-scoped files)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; `LayoutSwitches` reuses the existing admin session/`checkAdminPermissions` guard already gating `POST /api/admin/settings` |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Layout-switch writes reuse `checkAdminPermissions(request)` verbatim (`app/api/admin/settings/route.ts:28-34`, read this session) — no new authorization logic; the plan must not introduce a second, unguarded write path |
| V5 Input Validation | yes | The three `appearance.*` layout values written via POST must be validated against their enums both client-side (only render clickable options for shipped variants) and, more importantly, at read time in `getLayoutSettings()` — an arbitrary string written directly to D1 via the generic settings POST endpoint is caught by `getLayoutSettings()`'s own allow-list-and-fallback behavior (same posture as `getActiveTheme()`'s V5 control in Phase 6) |
| V6 Cryptography | no | Not applicable — no new secret/crypto material |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary `appearance.category_layout`/`home_hero`/`product_gallery` value written to D1 (the generic settings POST endpoint accepts any string for any key) | Tampering | `getLayoutSettings()`'s enum-membership check (Pattern 2) — a bogus stored value cannot make any page render a non-existent component or crash, since the resolver silently falls back per-switch |
| Reflected layout name in telemetry fields | Information Disclosure | Do not pass the raw stored string in any telemetry field — follow `theme.unknown_selection`'s exact precedent (`{ outcome: 'invalid' }` only, never the value itself), verified at `lib/themes/active-theme.ts:75-79` this session |
| Untrusted `product.media`/`product.primary_image` shape reaching `<Image src>` unresolved in a new variant | Tampering (data-integrity, not injection) | Route every image source through `resolveProductImageSrc()`, which already normalizes both stored shapes and provides a safe placeholder fallback — do not construct a new ad hoc URL-building path for the hero image (Anti-Patterns) |

## Sources

### Primary (HIGH confidence — direct repo inspection, all read this session)
- `app/category/[slug]/page.tsx`, `app/category/[slug]/CategoryDisplay.tsx` — current products-grid JSX, sort state boundary, no `revalidate`/`dynamic` export (inherits root layout's `force-dynamic`)
- `app/page.tsx` — current hero JSX, `export const revalidate = 3600` (verified inert via real build), `featuredProducts` derivation from `getProductsByCategory("cat_1")`
- `app/product/[slug]/page.tsx`, `app/product/[slug]/ProductDisplay.tsx` — current gallery JSX, `export const revalidate = 0`, local `getMediaUrl()` helper, `allImages`/`selectedImage` state shape
- `components/ProductCard.tsx` — `resolveProductImageSrc()` usage precedent, placeholder fallback path
- `lib/utils/product-image.ts` — `resolveProductImageSrc()`/`resolveProductImageUrl()` full implementation
- `lib/themes/active-theme.ts` — `getActiveTheme()`'s exact fallback-chain/telemetry structure, the direct model for `getLayoutSettings()`
- `lib/utils/settings.ts` — confirms `getSettings()` is a plain, non-memoized `async function`
- `lib/db.ts` — confirms only `getDbAsync()` (the connection) is `React.cache()`-wrapped, not query results
- `lib/observability/telemetry.ts` — `TELEMETRY_EVENTS` map, `theme.unknown_selection`'s exact registration to mirror
- `tests/unit/workers/observability-tail-core.test.ts` — the exact parity-test pattern to extend for `layout.unknown_selection`
- `tests/unit/lib/themes/active-theme.test.ts` — the exact test structure to mirror for `getLayoutSettings()`
- `components/admin/ThemePresetGrid.tsx`, `tests/unit/app/admin-appearance-source.test.ts` — pure-view/stateful-wrapper split pattern, `nextRovingIndex()`/`extractThemeName()` precedent, radiogroup a11y wiring, the exact render-testing approach (`renderToStaticMarkup`, no jsdom) to reuse for `LayoutSwitches`
- `app/api/admin/settings/route.ts`, `lib/db/schema/settings.ts` — POST/GET shape, `checkAdminPermissions` guard, confirmed empty-category re-insert bug and confirmed `appearance` has no `defaultSettings` entries
- `lib/auth/admin-middleware.ts` — `x-dev-admin: mercora-dev-bypass` dev-bypass header mechanism (06-04's own E2E proof method, reusable here)
- `scripts/screenshot-routes.mjs` — confirms no built-in variant-switching capability; the harness always resolves one category/product slug via sitemap and always covers both viewports per route call
- `vitest.config.mts`, `package.json` scripts block — test/build/lint command surface, `mise exec --` convention confirmed via `predev`/`build:worker` wiring already including `build-themes.mjs`
- A real `npm run build` run this session — confirms `/` (home), `/category/[slug]`, `/product/[slug]` all emit as `ƒ` (dynamic, server-rendered on demand), not static/ISR, despite `app/page.tsx`'s own `revalidate = 3600` export
- `.planning/phases/06-theme-file-mechanism-presets/06-RESEARCH.md`, `06-02-SUMMARY.md`, `06-04-SUMMARY.md` — the theme-mechanism precedent this phase mirrors structurally throughout
- `.planning/STATE.md` — carried-forward WINDOWS items (the settings-GET empty-category bug, no local Clerk session)

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` (milestone-level research) — confirms layout switches are architecturally independent of the theme mechanism, re-verified against current code this session rather than trusted as-is

### Tertiary (LOW confidence)
- None used as load-bearing for any claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every mechanism already proven in Phase 6, verified against currently-installed versions
- Architecture: HIGH — every claim (dynamic rendering behavior, `getSettings()` memoization, existing JSX to extract, `defaultSettings` contents) traced to a specific file/line read or a real build run this session, not inferred from training data
- Pitfalls: HIGH — all five pitfalls are either reproduced from direct code inspection (1, 2, 4, 5) or identify a genuinely new, previously-unexercised code path (3, the empty-featured-products case)

**Research date:** 2026-09-05
**Valid until:** 30 days (stable brownfield codebase, no external ecosystem dependency added)
