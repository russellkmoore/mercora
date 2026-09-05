/**
 * Typed lookup map from the resolved home-hero enum to its named component
 * (LAYOUT-04's anti-genericity control). Adding a member to `HomeHero`
 * without a matching entry here fails to typecheck.
 *
 * Lives in its own module (rather than inline in `app/page.tsx`) so tests
 * can assert the map's key/enum equality and its every-member-renders
 * invariant directly, without importing the server page's own
 * data-fetching dependencies. Unlike the category-layout map, the home page
 * never crosses a server-to-client-component boundary (it renders the
 * resolved hero entirely server-side), so the lookup itself can live and
 * run wherever is most convenient — this module, imported directly by
 * `app/page.tsx`.
 */

import type { ComponentType } from "react";
import type { Product } from "@/lib/types";
import type { HomeHero } from "@/lib/layout/variants";
import HomeHeroFullBleed from "./HomeHeroFullBleed";
import HomeHeroSplit from "./HomeHeroSplit";
import HomeHeroMinimal from "./HomeHeroMinimal";

export const HOME_HERO_MAP: Record<HomeHero, ComponentType<{ featuredProduct: Product | null }>> = {
  "full-bleed": HomeHeroFullBleed,
  "split": HomeHeroSplit,
  "minimal": HomeHeroMinimal,
};
