# Phase 7: Layout Switches - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 20 (2 lib, 8 variant components, 5 modified pages/displays, 1 admin component, 1 admin page, 1 telemetry, ~5 test files, 1 screenshots doc)
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/layout/variants.ts` | config/model (enum) | transform | `lib/themes/manifest.generated.ts` (const arrays/types) | role-match |
| `lib/layout/settings.ts` | service | request-response (D1 read + fallback) | `lib/themes/active-theme.ts` | exact |
| `components/layout/category/CategoryGrid3.tsx` | component | request-response (RSC) | `app/category/[slug]/CategoryDisplay.tsx` lines 132-143 (products `<section>`) | exact (verbatim source) |
| `components/layout/category/CategoryGrid2.tsx` | component | request-response (RSC) | same section, new column/size variant | role-match |
| `components/layout/category/CategoryList.tsx` | component | request-response (RSC) | same section + `components/ProductCard.tsx` data contract | role-match |
| `components/layout/home/HomeHeroMinimal.tsx` | component | request-response (RSC) | `app/page.tsx` lines 58-71 (hero `<section>`) | exact (verbatim source) |
| `components/layout/home/HomeHeroSplit.tsx` | component | request-response (RSC) | same hero + `lib/utils/product-image.ts` `resolveProductImageSrc` | role-match |
| `components/layout/home/HomeHeroFullBleed.tsx` | component | request-response (RSC) | same hero + `resolveProductImageSrc` + Phase 6 scrim precedent | role-match |
| `components/layout/product/ProductGalleryLeft.tsx` | component (client) | request-response + client state | `app/product/[slug]/ProductDisplay.tsx` lines 152-184 (gallery block) | exact (verbatim source) |
| `components/layout/product/ProductGalleryTop.tsx` | component (client) | request-response + client state | same gallery block, new layout | role-match |
| `app/category/[slug]/page.tsx` | route/controller | request-response | itself (modified) — add `getLayoutSettings()` + `CATEGORY_LAYOUT_MAP` | exact (self) |
| `app/category/[slug]/CategoryDisplay.tsx` | component (client) | request-response | itself (modified) — products section replaced by resolved variant prop | exact (self) |
| `app/page.tsx` | route/controller | request-response | itself (modified) — add `getLayoutSettings()` + `HOME_HERO_MAP` | exact (self) |
| `app/product/[slug]/page.tsx` | route/controller | request-response | itself (modified) — add `getLayoutSettings()`, pass `productGallery` | exact (self) |
| `app/product/[slug]/ProductDisplay.tsx` | component (client) | request-response + client state | itself (modified) — add `PRODUCT_GALLERY_MAP`, extract gallery state as props | exact (self) |
| `lib/observability/telemetry.ts` | config | event-driven | `TELEMETRY_EVENTS['theme.unknown_selection']` entry, line 28 | exact |
| `components/admin/LayoutSwitches.tsx` | component (client island) | CRUD (settings save) | `components/admin/ThemePresetGrid.tsx` | exact |
| `app/admin/settings/appearance/page.tsx` | route (RSC) | request-response | itself (modified) — add `<LayoutSwitches />` below `<ThemePresetGrid />` | exact (self) |
| `tests/unit/lib/layout/variants.test.ts` | test | transform | none direct; exhaustiveness assertion pattern from Pattern 1 in RESEARCH | no close analog — synthesize from research skeleton |
| `tests/unit/lib/layout/settings.test.ts` | test | request-response | `tests/unit/lib/themes/active-theme.test.ts` | exact |
| `tests/unit/components/layout/**/*.test.ts` (8 files) | test | request-response (render) | `tests/unit/components/account/subscription-manager.test.ts` (pure-view render split) | role-match |
| `tests/unit/app/admin-layout-switches-source.test.ts` | test | request-response | `tests/unit/app/admin-appearance-source.test.ts` | exact |
| `tests/unit/workers/observability-tail-core.test.ts` (extend) | test | event-driven | itself, lines 71-81 (`theme.unknown_selection` parity block) | exact |
| `07-SCREENSHOTS.md` | docs | file-I/O | `06.1-SCREENSHOTS.md` | exact |

## Pattern Assignments

### `lib/layout/variants.ts` (config, transform)

**Analog:** `lib/themes/manifest.generated.ts` (const-array + derived-type convention already used repo-wide) and D-01's own literal spec.

**Core pattern** — write directly per D-01/Pattern 1 in RESEARCH (no analog file has this exact `as const` tuple-to-union shape for layouts yet, but it is the same idiom the manifest file and `CATEGORY_LAYOUTS`/`HOME_HEROES`/`PRODUCT_GALLERIES` already establish repo-wide):
```ts
export const CATEGORY_LAYOUTS = ["grid-3", "grid-2", "list"] as const;
export type CategoryLayout = (typeof CATEGORY_LAYOUTS)[number];

export const HOME_HEROES = ["full-bleed", "split", "minimal"] as const;
export type HomeHero = (typeof HOME_HEROES)[number];

export const PRODUCT_GALLERIES = ["left", "top"] as const;
export type ProductGallery = (typeof PRODUCT_GALLERIES)[number];

export const DEFAULT_LAYOUTS = {
  categoryLayout: "grid-3" as CategoryLayout,
  homeHero: "minimal" as HomeHero,
  productGallery: "left" as ProductGallery,
} as const;
```

---

### `lib/layout/settings.ts` (service, request-response)

**Analog:** `lib/themes/active-theme.ts` (full file read — 88 lines, this is the literal structural sibling per D-02).

**Imports pattern** (lines 23-25):
```ts
import { getSettings } from "@/lib/utils/settings";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";
```
For `settings.ts`, swap the manifest import for `lib/layout/variants.ts`'s enums.

**Constant-export pattern** (lines 27-28):
```ts
export const APPEARANCE_SETTINGS_CATEGORY = "appearance";
export const APPEARANCE_THEME_SETTING_KEY = "appearance.theme";
```
Layout keys are `appearance.category_layout`, `appearance.home_hero`, `appearance.product_gallery` — same category constant can be reused/imported from `active-theme.ts` or redeclared locally (D-02/Discretion allows a shared `readAppearance()` helper; simplest is to import the existing `APPEARANCE_SETTINGS_CATEGORY` constant rather than redefine it).

**Full fallback-chain pattern to mirror per switch** (lines 46-88, the entire `getActiveTheme()` body):
```ts
export async function getActiveTheme(): Promise<string> {
  const manifestNames = new Set(THEME_MANIFEST.map((theme) => theme.name));

  let stored: unknown;
  try {
    const settings = await getSettings(APPEARANCE_SETTINGS_CATEGORY);
    stored = settings[APPEARANCE_THEME_SETTING_KEY];
  } catch {
    // DB hiccup degrades to default, doesn't take down the route.
    return resolveEnvOrManifestDefault(manifestNames);
  }

  if (stored === undefined || stored === null) {
    return resolveEnvOrManifestDefault(manifestNames); // absent: normal, no telemetry
  }

  if (typeof stored === "string") {
    const trimmed = stored.trim();
    if (trimmed === "") {
      return resolveEnvOrManifestDefault(manifestNames); // empty: normal, no telemetry
    }
    if (manifestNames.has(trimmed)) {
      return trimmed;
    }
    recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
    return resolveEnvOrManifestDefault(manifestNames);
  }

  recordTelemetry("theme.unknown_selection", { outcome: "invalid" });
  return resolveEnvOrManifestDefault(manifestNames);
}
```
For `getLayoutSettings()`: no env-default tier (D-04 says "no env vars for layouts"), so `resolveEnvOrManifestDefault` collapses to simply returning that switch's `DEFAULT_LAYOUTS` member; everything else — the try/catch-degrades-to-default, absent/null silent fallback, empty-string silent fallback, allow-list check, `recordTelemetry("layout.unknown_selection", { outcome: "invalid" })` on both the present-but-invalid-string and the present-non-string branches — copies verbatim, once per switch (category_layout, home_hero, product_gallery), reading all three off a single `getSettings(APPEARANCE_SETTINGS_CATEGORY)` call (one D1 read for all three switches, matching Pitfall 1's "accept two reads per request" resolution — one extra read total, not three).

**Error handling pattern:** the `try { ... } catch { return default }` wrapping the D1 read (lines 50-57) — never let a DB hiccup throw past this function.

**Telemetry call signature:** `recordTelemetry("theme.unknown_selection", { outcome: "invalid" })` — never pass the raw stored string (line 80/86); mirror exactly for `layout.unknown_selection`.

---

### `components/layout/category/CategoryGrid3.tsx` (component, request-response — verbatim extraction)

**Analog:** `app/category/[slug]/CategoryDisplay.tsx` (full file read, 158 lines).

**Exact JSX to extract verbatim** (lines 132-143):
```tsx
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
Rename `sortedProducts` prop to `products` (the sort already happened in `CategoryDisplay` before the resolved variant is invoked — see Pitfall 2 resolution below). Imports needed: `import ProductCard from "@/components/ProductCard"; import type { Product } from "@/lib/types/";`.

**`CategoryDisplay.tsx`'s own imports** (lines 40-45, keep as-is minus what moves to the variant file):
```tsx
"use client";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Product } from "@/lib/types/";
import { isVariantAvailable } from "@/lib/inventory/availability";
```
After extraction, `CategoryDisplay` keeps `sortBy` state, the `ToggleGroup` block (lines 92-130), and renders `<ResolvedVariant products={sortedProducts} />` in place of the old `<section>` — per Pitfall 2, `CategoryDisplay` receives the **resolved component** (typed `ComponentType<{ products: Product[] }>`), not the enum string, as a new prop from the server page; it must never do `if (categoryLayout === ...)` branching itself.

**`app/category/[slug]/page.tsx` wiring point** (currently imports `CategoryDisplay` at line 41 and renders `<CategoryDisplay products={products} />` at line 171) — add the `getLayoutSettings()` call and `CATEGORY_LAYOUT_MAP` lookup here, pass the resolved component down as a new prop.

---

### `components/layout/category/CategoryGrid2.tsx` / `CategoryList.tsx`

**Analog:** same `CategoryGrid3` extraction source, adapted per D-06 (`grid-2`: two `lg` columns/larger cards; `list`: one row per product, image left/name-price-CTA right, reusing `ProductCard`'s data contract). No pixel-identical obligation — new layouts, Claude's Discretion on exact spacing.

**Reference for `ProductCard`'s data contract** (needed for `list`'s manual row layout instead of the card component):
Read `components/ProductCard.tsx`'s prop shape and its `resolveProductImageSrc`/price-display usage directly when building `CategoryList.tsx` (not re-derived from CategoryDisplay, since the list variant needs the same product fields laid out differently, not the `<ProductCard>` component itself).

---

### `components/layout/home/HomeHeroMinimal.tsx` (component, request-response — verbatim extraction)

**Analog:** `app/page.tsx` (full file read, 85 lines).

**Exact JSX to extract verbatim** (lines 58-71):
```tsx
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
Import needed: `import Link from "next/link";`. Copy strings are hardcoded English literals — extract unchanged, no copy-config layer (out of scope).

**`app/page.tsx`'s surrounding structure to preserve** (lines 48-56, 82-85 — the outer wrapper div, `featuredProducts` derivation, and the now-dead `revalidate = 3600` export, per Pitfall 5 leave as-is):
```tsx
export default async function HomePage() {
  const featuredProducts = (await getProductsByCategory("cat_1"))
    .filter((product) => product.status === "active")
    .map(toPublicProduct)
    .slice(0, 3);

  return (
    <div className="bg-surface-elevated text-foreground px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
      {/* resolved hero variant renders here, replacing the old inline <section> */}
      {/* Featured Products Grid — lines 74-82, UNCHANGED, stays in page.tsx */}
    </div>
  );
}
export const revalidate = 3600;
```
Add `getLayoutSettings()` + `HOME_HERO_MAP` lookup here; the Featured Products Grid section (lines 74-82) is NOT part of any hero variant and stays in `app/page.tsx` untouched.

---

### `components/layout/home/HomeHeroSplit.tsx` / `HomeHeroFullBleed.tsx`

**Analog:** `HomeHeroMinimal`'s extraction source (copy/text) + `lib/utils/product-image.ts`'s `resolveProductImageSrc` (lines 98-105) for the image.

**Image-resolution pattern to reuse** (`lib/utils/product-image.ts:98-105`):
```ts
export function resolveProductImageSrc(
  primaryImage: unknown,
  media?: unknown,
  placeholder = '/placeholder.svg'
): string {
  const url = resolveProductImageUrl(primaryImage, media);
  if (!url) return placeholder;
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return `/${url}`;
}
```
Call as `resolveProductImageSrc(featuredProducts[0]?.primary_image, featuredProducts[0]?.media)` — this already returns the placeholder path when `featuredProducts` is empty (Pitfall 3's A1 assumption: placeholder image, not a degrade-to-minimal branch), since `primaryImage`/`media` will be `undefined` and the function's own `!url` guard returns `placeholder`. Do NOT reinvent this via `ProductDisplay.tsx`'s local `getMediaUrl()` — that helper is narrower (no leading-slash normalization) and is being left in place only for the *default* gallery extraction, not reused for new surface area.

**Scrim precedent (full-bleed only):** per D-07/RESEARCH, use `bg-black/NN` under the token-class scanner sentinel, following Phase 6's polarity-neutral-scrim precedent (check `06-*` phase files if a literal scrim class is needed verbatim; otherwise `bg-black/40` or similar is Claude's Discretion per CONTEXT.md).

---

### `components/layout/product/ProductGalleryLeft.tsx` (component, client, request-response — verbatim extraction)

**Analog:** `app/product/[slug]/ProductDisplay.tsx` (full file read, 366 lines).

**Exact JSX to extract verbatim** (lines 152-184):
```tsx
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
`getMediaUrl` (defined locally in `ProductDisplay.tsx` at lines 69-73 — `function getMediaUrl(media: any): string { if (!media) return "/placeholder.jpg"; if (typeof media === "string") return media; return media.file?.url || "/placeholder.jpg"; }`), `allImages`, `selectedImage`, `setSelectedImage`, `product.name` must all be passed in as props (`GalleryProps`) since they currently live in `ProductDisplay`'s closure (`useMemo` at lines 96-115, `useState` at line 117). Keep `getMediaUrl` as-is for this default variant per the byte-identical requirement — do NOT swap to `resolveProductImageSrc` here (Open Question 1's recommendation).

**`"use client"` directive:** required at top of file (line 34 of the source) since image-thumbnail selection is client state (D-08).

**`ProductDisplay.tsx`'s new map + prop** (per Pattern 4 in RESEARCH):
```tsx
import ProductGalleryLeft from "@/components/layout/product/ProductGalleryLeft";
import ProductGalleryTop from "@/components/layout/product/ProductGalleryTop";
import type { ProductGallery } from "@/lib/layout/variants";

const PRODUCT_GALLERY_MAP: Record<ProductGallery, ComponentType<GalleryProps>> = {
  left: ProductGalleryLeft,
  top: ProductGalleryTop,
};

interface ProductDisplayProps {
  // ...existing props (product, recommendations, reviews, reviewEligibility, subscription)
  productGallery: ProductGallery; // resolved enum value, NOT `layout: string`
}
```
`app/product/[slug]/page.tsx` wiring (currently renders `<ProductDisplay product={...} recommendations={...} reviews={...} reviewEligibility={...} subscription={...} />` at lines 90-102) — add `const { productGallery } = await getLayoutSettings();` and pass `productGallery={productGallery}` as a new prop, same call-site shape as the existing props.

---

### `components/layout/product/ProductGalleryTop.tsx`

**Analog:** same gallery block source above, restructured per D-08 (full-width image above info, horizontal thumbnail strip) — new layout, no pixel-identical obligation, same `GalleryProps` contract as `ProductGalleryLeft`.

---

### Telemetry registration — `lib/observability/telemetry.ts`

**Analog:** the `theme.unknown_selection` entry itself (verified, `lib/observability/telemetry.ts:25-28`):
```ts
export const TELEMETRY_EVENTS = {
  'ai.response_guard_failed': { severity: 'error', sampleRate: 1 },
  'ai.response_guard_replaced': { severity: 'warning', sampleRate: 1 },
  'theme.unknown_selection': { severity: 'warning', sampleRate: 1 },
  'layout.unknown_selection': { severity: 'warning', sampleRate: 1 }, // NEW — add directly below theme's entry
  'payment.pricing_rejected': { severity: 'warning', sampleRate: 0.05 },
  // ...rest of the map unchanged
} as const;
```
Never add `layout.unknown_selection` to `TAIL_CRITICAL_EVENTS` (D-03 explicit).

**Parity test to extend — `tests/unit/workers/observability-tail-core.test.ts:71-81`** (verified exact block):
```ts
it('registers theme.unknown_selection at warning severity outside the tail critical list', () => {
  expect(TELEMETRY_EVENTS['theme.unknown_selection']).toEqual({
    severity: 'warning',
    sampleRate: 1,
  });
  expect(TAIL_CRITICAL_EVENTS).not.toContain('theme.unknown_selection');
});
```
Add a sibling `it('registers layout.unknown_selection at warning severity outside the tail critical list', ...)` block with the same two assertions, `layout.unknown_selection` substituted — do not modify the existing theme test, add a new one immediately after it.

---

### `components/admin/LayoutSwitches.tsx` (component, client island, CRUD)

**Analog:** `components/admin/ThemePresetGrid.tsx` (full file read, 312 lines) — this is an exact structural analog per D-12.

**Imports pattern** (lines 1-13):
```tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_THEME_NAME, THEME_MANIFEST } from "@/lib/themes/manifest.generated";
import {
  APPEARANCE_SETTINGS_CATEGORY,
  APPEARANCE_THEME_SETTING_KEY,
} from "@/lib/themes/active-theme";
```
For `LayoutSwitches.tsx`, swap the theme-manifest import for `lib/layout/variants.ts`'s `CATEGORY_LAYOUTS`/`HOME_HEROES`/`PRODUCT_GALLERIES`/`DEFAULT_LAYOUTS`, and import `APPEARANCE_SETTINGS_CATEGORY` from `active-theme.ts` (shared constant) or `lib/layout/settings.ts` if redeclared there.

**`nextRovingIndex` helper — copy verbatim** (lines 48-55, exported and independently unit-tested per D-11/`Don't Hand-Roll`):
```tsx
export function nextRovingIndex(currentIndex: number, key: string, length: number): number {
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  return (currentIndex + delta + length) % length;
}
```

**Value-extraction helper pattern to mirror per switch** (`extractThemeName`, lines 34-46 — one such function needed per switch, e.g. `extractCategoryLayout`, `extractHomeHero`, `extractProductGallery`):
```tsx
export function extractThemeName(rows: SettingRow[]): string {
  const row = rows.find((candidate) => candidate.key === APPEARANCE_THEME_SETTING_KEY);
  if (!row) return DEFAULT_THEME_NAME;
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (typeof parsed === "string" && THEME_MANIFEST.some((theme) => theme.name === parsed)) {
      return parsed;
    }
  } catch {
    // Malformed stored value — fall through to the default below.
  }
  return DEFAULT_THEME_NAME;
}
```

**Content/wrapper split — the full pattern** (lines 57-214 is the pure `ThemePresetGridContent`; lines 216-312 is the stateful `ThemePresetGrid` wrapper). `LayoutSwitches.tsx` needs the same split, times three (one radiogroup section per switch) or one combined content component handling all three — either is fine; the load-failure banner (lines 90-102), the `role="radiogroup"`/`aria-label`/`onKeyDown` wiring (lines 104-109), per-option `role="radio"`/`aria-checked`/`tabIndex`/`onClick`/`onKeyDown` (Enter/Space) wiring (lines 116-134), and the `Save` button's disabled-state logic (lines 85-86, 195-211) all copy directly — substitute icon+label options (D-11) for the theme-preset color-chip mock (lines 135-168) since layout options are "a small inline line-art icon plus a label," not color swatches.

**Fetch-on-mount pattern** (lines 222-238):
```tsx
useEffect(() => {
  let cancelled = false;
  void fetch(`/api/admin/settings?category=${APPEARANCE_SETTINGS_CATEGORY}`)
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not load settings");
      const body = (await response.json()) as SettingsResponse;
      if (cancelled) return;
      setSavedTheme(extractThemeName(body.settings));
      setStatus("loaded");
    })
    .catch(() => {
      if (!cancelled) setStatus("error");
    });
  return () => { cancelled = true; };
}, []);
```
D-12 note: `LayoutSwitches` does its own independent fetch (accepted duplication with `ThemePresetGrid`'s fetch, per Open Question 2 in RESEARCH — do not share state).

**Save/POST pattern** (lines 259-299):
```tsx
async function save() {
  if (!pendingTheme || !THEME_MANIFEST.some((theme) => theme.name === pendingTheme)) return;
  if (pendingTheme === savedTheme) return;

  setSaving(true);
  try {
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          {
            key: APPEARANCE_THEME_SETTING_KEY,
            value: pendingTheme,
            category: APPEARANCE_SETTINGS_CATEGORY,
            data_type: "string",
          },
        ],
      }),
    });
    if (!response.ok) throw new Error("Save failed");

    const body = (await response.json()) as SettingsResponse;
    const confirmedName = extractThemeName(body.settings);
    setSavedTheme(confirmedName);
    setPendingTheme(null);
    toast.success(`Theme updated to ${label}.`);
  } catch {
    toast.error("Couldn't save your theme selection. Try again.");
  } finally {
    setSaving(false);
  }
}
```
For `LayoutSwitches`, `updates` is an array of **three** entries (one per switch key: `appearance.category_layout`, `appearance.home_hero`, `appearance.product_gallery`), all posted together on one "Save Layout" click (D-12: "own pending state and a 'Save Layout' button... saving the three keys"). Toast copy: adapt to "Layout updated." / "Couldn't save your layout selection. Try again." (or similar — exact copy is Claude's Discretion, but the retry-affordance pattern — error toast, no auto-retry loop — copies directly).

**Critical constraint (D-12):** `ThemePresetGrid.tsx` is NOT modified. `LayoutSwitches.tsx` is a wholly separate file/component, imported into the same page but never imported by or importing from `ThemePresetGrid.tsx`.

---

### `app/admin/settings/appearance/page.tsx` (route, modified)

**Analog:** itself (full file read, 30 lines) — exact current content:
```tsx
import { ThemePresetGrid } from "@/components/admin/ThemePresetGrid";

export const metadata = {
  title: "Appearance",
};

export default function AdminAppearancePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Appearance</h1>
        <p className="text-gray-400">
          Choose the storefront&apos;s look. Changes apply to the live site immediately
          after saving — no redeploy needed.
        </p>
      </div>

      <ThemePresetGrid />
    </div>
  );
}
```
Modification (D-10): add `import { LayoutSwitches } from "@/components/admin/LayoutSwitches";` and render `<LayoutSwitches />` immediately below `<ThemePresetGrid />`, inside the same `space-y-6` wrapper — optionally with its own `<h2>`/intro paragraph for the "Layout" section heading (D-10/D-11 call this "a Layout section... below the theme grid").

---

## Shared Patterns

### D1 settings read + enum fallback + telemetry-on-unknown-only
**Source:** `lib/themes/active-theme.ts:41-88` (full function body, quoted above)
**Apply to:** `lib/layout/settings.ts`'s `getLayoutSettings()`, once per switch (category_layout, home_hero, product_gallery)
**Rule:** absent/empty → default, silent. Present-and-invalid (wrong type or not in allow-list) → default + exactly one `recordTelemetry` call with `{ outcome: "invalid" }`, never the raw value. DB-read failure → default via try/catch, never throws.

### Admin radiogroup a11y + roving tabindex
**Source:** `components/admin/ThemePresetGrid.tsx:104-134` (radiogroup/radio ARIA wiring) + `:48-55` (`nextRovingIndex`) + `:244-257` (`handleGridKeyDown`)
**Apply to:** `components/admin/LayoutSwitches.tsx`'s three radiogroups (category layout, home hero, product gallery)
```tsx
export function nextRovingIndex(currentIndex: number, key: string, length: number): number {
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  return (currentIndex + delta + length) % length;
}
```

### Typed lookup map + exhaustiveness (anti-genericity control)
**Source:** RESEARCH.md Pattern 1 (no direct prior-code analog exists for this exact idiom in the repo yet — it is new to this phase, modeled structurally on `THEME_MANIFEST.some((theme) => theme.name === pendingTheme)`'s allow-list discipline, `ThemePresetGrid.tsx:263`)
**Apply to:** `CATEGORY_LAYOUT_MAP`, `HOME_HERO_MAP`, `PRODUCT_GALLERY_MAP` — each a `Record<Enum, ComponentType<Props>>` defined at the server-page call site (category/home) or inside `ProductDisplay.tsx` (product gallery, per Pattern 4's client-boundary split)

### Product image resolution
**Source:** `lib/utils/product-image.ts:98-105` (`resolveProductImageSrc`, already consumed by `components/ProductCard.tsx`)
**Apply to:** `HomeHeroSplit.tsx` and `HomeHeroFullBleed.tsx` only — the *new* image surface this phase introduces. Do NOT apply to `ProductGalleryLeft.tsx`'s extraction (keep its local `getMediaUrl` verbatim for byte-identical default output).

### Render-test split (pure content component + `renderToStaticMarkup`)
**Source:** `components/admin/ThemePresetGrid.tsx`'s `ThemePresetGridContent` export (lines 76-214) + `tests/unit/app/admin-appearance-source.test.ts` (full file, 310 lines — especially the `renderGrid()` helper at lines 105-118 and the "source-level checks" `describe` block at lines 284-310 for the two things a static render can't observe: fetch URL and toast copy)
**Apply to:** all 8 variant-component tests, `LayoutSwitches` tests, and `settings.test.ts`

### Telemetry-registration parity test
**Source:** `tests/unit/workers/observability-tail-core.test.ts:71-81` (exact block quoted above)
**Apply to:** new `layout.unknown_selection` parity test, added as a sibling `it(...)` block, same file

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/unit/lib/layout/variants.test.ts` | test | transform | No existing exhaustiveness-assertion test file for a `Record<Enum, Component>` map exists yet in this repo — synthesize directly from RESEARCH.md Pattern 1's skeleton (`Object.keys(MAP).sort()` vs `[...ENUM].sort()` equality is the simplest runtime-checkable form) |
| `components/layout/category/CategoryGrid2.tsx`, `CategoryList.tsx`, `home/HomeHeroSplit.tsx`, `HomeHeroFullBleed.tsx`, `product/ProductGalleryTop.tsx` | component | request-response | These are new intentional layouts, not extractions — no pixel-identical prior source exists; use the corresponding default variant's extraction as a structural/import-pattern starting point only, then apply Claude's Discretion for spacing/typography per D-06/D-07/D-08 |

## Metadata

**Analog search scope:** `lib/themes/`, `components/admin/`, `app/category/[slug]/`, `app/page.tsx`, `app/product/[slug]/`, `lib/utils/product-image.ts`, `lib/observability/telemetry.ts`, `tests/unit/lib/themes/`, `tests/unit/app/`, `tests/unit/workers/`
**Files scanned:** 12 read in full (all listed as analogs above), all confirmed git-tracked via `git ls-files`
**Pattern extraction date:** 2026-09-05

## PATTERN MAPPING COMPLETE
