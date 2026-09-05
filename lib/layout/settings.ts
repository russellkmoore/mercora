/**
 * === Layout Settings Resolution ===
 *
 * Resolves the three layout switches (category grid density, home hero
 * style, product gallery position) for the current request, from the same
 * `appearance` D1 category `getActiveTheme()` reads. Each stored value is
 * validated against its own enum (`lib/layout/variants.ts`); an absent,
 * empty, or invalid value falls back to that switch's default. Always
 * returns three enum members — never throws.
 *
 * Server-only. Never import this from a client component — it reads the
 * D1-backed settings helper.
 *
 * === One shared appearance read per request (D-04) ===
 * The `appearance` category is now read exactly once per request and
 * shared with the theme resolver: both this function and
 * `getActiveTheme()` (`lib/themes/active-theme.ts`) call
 * `readAppearanceSettings()` (`lib/themes/appearance-read.ts`), the single
 * module that owns this read. This resolver stays fully independent of
 * `getActiveTheme()`'s own internals and its own frozen test suite — it
 * only shares the read, not the resolution logic.
 *
 * === Caching ===
 * Deliberately holds no state between requests: no module-scope variable,
 * no cross-request memoisation helper, no top-level mutable binding
 * anywhere in this file. The one framework-level memoisation wrapper in
 * this path lives in `readAppearanceSettings()` itself — a request-scoped
 * `React.cache()`, not an isolate-scoped cache — so a Cloudflare Workers
 * isolate reused across requests can never be served a stale layout after
 * an admin save (same posture as `getActiveTheme()`).
 */

import { recordTelemetry } from "@/lib/observability/telemetry";
import {
  CATEGORY_LAYOUTS,
  HOME_HEROES,
  PRODUCT_GALLERIES,
  DEFAULT_LAYOUTS,
  type CategoryLayout,
  type HomeHero,
  type ProductGallery,
} from "@/lib/layout/variants";
import { readAppearanceSettings } from "@/lib/themes/appearance-read";

export const LAYOUT_SETTING_KEYS = {
  categoryLayout: "appearance.category_layout",
  homeHero: "appearance.home_hero",
  productGallery: "appearance.product_gallery",
} as const;

/**
 * Resolves one switch's stored value against its own enum array (never by
 * indexing an object with the stored string — a value naming an
 * object-prototype member must fall back, not resolve through the
 * prototype chain; T-07-01).
 *
 * Mirrors `getActiveTheme()`'s exact fallback chain: absent/null silent
 * default, empty/whitespace-only silent default, a match returns the
 * trimmed member, anything else (a present-but-unmatched string, or a
 * present non-string) emits exactly one `layout.unknown_selection` signal
 * carrying only the allowed `outcome` field — never the stored value
 * itself (T-07-02).
 */
function resolveLayoutEnum<T extends string>(
  stored: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (stored === undefined || stored === null) {
    return fallback;
  }

  if (typeof stored !== "string") {
    recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
    return fallback;
  }

  const trimmed = stored.trim();
  if (trimmed === "") {
    return fallback;
  }

  if ((allowed as readonly string[]).includes(trimmed)) {
    return trimmed as T;
  }

  recordTelemetry("layout.unknown_selection", { outcome: "invalid" });
  return fallback;
}

/**
 * Resolves the three layout switches for the current request. Always
 * returns three enum members; never throws.
 */
export async function getLayoutSettings(): Promise<{
  categoryLayout: CategoryLayout;
  homeHero: HomeHero;
  productGallery: ProductGallery;
}> {
  // readAppearanceSettings() already degrades a database hiccup to `{}`;
  // that alone resolves every switch below to its default, same posture as
  // getActiveTheme().
  const settings = await readAppearanceSettings();

  return {
    categoryLayout: resolveLayoutEnum(
      settings[LAYOUT_SETTING_KEYS.categoryLayout],
      CATEGORY_LAYOUTS,
      DEFAULT_LAYOUTS.categoryLayout,
    ),
    homeHero: resolveLayoutEnum(
      settings[LAYOUT_SETTING_KEYS.homeHero],
      HOME_HEROES,
      DEFAULT_LAYOUTS.homeHero,
    ),
    productGallery: resolveLayoutEnum(
      settings[LAYOUT_SETTING_KEYS.productGallery],
      PRODUCT_GALLERIES,
      DEFAULT_LAYOUTS.productGallery,
    ),
  };
}
