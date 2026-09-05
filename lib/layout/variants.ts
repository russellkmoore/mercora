/**
 * === Layout Switch Enumerations ===
 *
 * The single source of truth for the three layout switches (category grid
 * density, home hero style, product gallery position). The server resolver
 * (`lib/layout/settings.ts`), the admin `LayoutSwitches` island, and every
 * test in this phase all read the three enums and the defaults object from
 * here — nothing restates these member lists anywhere else.
 *
 * Isomorphic: no server-only import, safe to import from a client component
 * (the admin island does exactly that).
 *
 * === Primary identity ===
 * A switch's identity is its enum member name. Today's rendering for each
 * switch is demoted to whichever member happens to be listed in
 * `DEFAULT_LAYOUTS` below — no page, component, or test may special-case a
 * default beyond reading it from that object.
 */

export const CATEGORY_LAYOUTS = ["grid-3", "grid-2", "list"] as const;
export type CategoryLayout = (typeof CATEGORY_LAYOUTS)[number];

export const HOME_HEROES = ["full-bleed", "split", "minimal"] as const;
export type HomeHero = (typeof HOME_HEROES)[number];

export const PRODUCT_GALLERIES = ["left", "top"] as const;
export type ProductGallery = (typeof PRODUCT_GALLERIES)[number];

/** Reproduces today's look exactly (D-04): no defaulted variant is new. */
export const DEFAULT_LAYOUTS = {
  categoryLayout: "grid-3" as CategoryLayout,
  homeHero: "minimal" as HomeHero,
  productGallery: "left" as ProductGallery,
} as const;
