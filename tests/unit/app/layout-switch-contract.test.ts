import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CATEGORY_LAYOUTS,
  HOME_HEROES,
  PRODUCT_GALLERIES,
  DEFAULT_LAYOUTS,
  type CategoryLayout,
  type HomeHero,
  type ProductGallery,
} from "@/lib/layout/variants";
import { categoryProductsFixture } from "@/tests/unit/components/layout/category/fixtures";

/**
 * Phase-level LAYOUT-04 contract test (07-05).
 *
 * The single repo-wide proof that all three layout switches (category grid
 * density, home hero style, product gallery position) satisfy LAYOUT-04 at
 * once: every enum member has a named component, every production lookup
 * map's key set mirrors its enum exactly (order, no duplicates), every
 * variant renders non-empty markup with its own data attribute, and no
 * map-holding or display file compares a resolved value against a member
 * name literal or declares a generically-named layout prop. This test
 * complements — never duplicates — the three per-switch suites plans
 * 07-01/07-02/07-03 wrote, which own each variant's detailed rendering
 * behavior (empty states, fallbacks, selection borders, etc).
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// --- Independent member-to-component tables --------------------------------
//
// Built by importing each of the eight components directly and listing them
// out member by member here. This is deliberately a SECOND, independent
// statement of the same mapping the three production maps make — if they
// ever disagree, one of them is wrong and this test says so.

const { default: CategoryGrid3 } = await import("@/components/layout/category/CategoryGrid3");
const { default: CategoryGrid2 } = await import("@/components/layout/category/CategoryGrid2");
const { default: CategoryList } = await import("@/components/layout/category/CategoryList");
const { default: HomeHeroFullBleed } = await import(
  "@/components/layout/home/HomeHeroFullBleed"
);
const { default: HomeHeroSplit } = await import("@/components/layout/home/HomeHeroSplit");
const { default: HomeHeroMinimal } = await import("@/components/layout/home/HomeHeroMinimal");
const { default: ProductGalleryLeft } = await import(
  "@/components/layout/product/ProductGalleryLeft"
);
const { default: ProductGalleryTop } = await import(
  "@/components/layout/product/ProductGalleryTop"
);

const CATEGORY_MEMBERS: ReadonlyArray<readonly [CategoryLayout, React.ComponentType<any>]> = [
  ["grid-3", CategoryGrid3],
  ["grid-2", CategoryGrid2],
  ["list", CategoryList],
];

const HOME_MEMBERS: ReadonlyArray<readonly [HomeHero, React.ComponentType<any>]> = [
  ["full-bleed", HomeHeroFullBleed],
  ["split", HomeHeroSplit],
  ["minimal", HomeHeroMinimal],
];

const PRODUCT_MEMBERS: ReadonlyArray<readonly [ProductGallery, React.ComponentType<any>]> = [
  ["left", ProductGalleryLeft],
  ["top", ProductGalleryTop],
];

function featuredProductWithImage() {
  return {
    id: "contract-featured",
    name: "Volt Contract Jacket",
    primary_image: { url: "products/contract-jacket.jpg" },
    media: [],
  } as never;
}

function galleryFixtureProps() {
  return {
    allImages: ["a.jpg"],
    selectedImage: "a.jpg",
    onSelect: vi.fn(),
    productName: "Volt Contract Kit",
  };
}

describe("LAYOUT-04 repo-wide contract: member-to-component table vs. the three enums", () => {
  it("the three independent tables' combined key count equals the sum of all three enums' lengths, with no duplicate across all eight", () => {
    const allNames = [
      ...CATEGORY_MEMBERS.map(([n]) => n),
      ...HOME_MEMBERS.map(([n]) => n),
      ...PRODUCT_MEMBERS.map(([n]) => n),
    ];
    expect(new Set(allNames).size).toBe(allNames.length);
    expect(allNames.length).toBe(
      CATEGORY_LAYOUTS.length + HOME_HEROES.length + PRODUCT_GALLERIES.length,
    );
  });

  it("each independent table's key set equals its own enum exactly, in order", () => {
    expect(CATEGORY_MEMBERS.map(([n]) => n)).toEqual([...CATEGORY_LAYOUTS]);
    expect(HOME_MEMBERS.map(([n]) => n)).toEqual([...HOME_HEROES]);
    expect(PRODUCT_MEMBERS.map(([n]) => n)).toEqual([...PRODUCT_GALLERIES]);
  });

  it("no enum array contains a duplicate entry", () => {
    expect(new Set(CATEGORY_LAYOUTS).size).toBe(CATEGORY_LAYOUTS.length);
    expect(new Set(HOME_HEROES).size).toBe(HOME_HEROES.length);
    expect(new Set(PRODUCT_GALLERIES).size).toBe(PRODUCT_GALLERIES.length);
  });

  it("each switch's default is a member of its own enum", () => {
    expect(CATEGORY_LAYOUTS).toContain(DEFAULT_LAYOUTS.categoryLayout);
    expect(HOME_HEROES).toContain(DEFAULT_LAYOUTS.homeHero);
    expect(PRODUCT_GALLERIES).toContain(DEFAULT_LAYOUTS.productGallery);
  });
});

describe("Every one of the eight components renders non-empty markup with its own switch's data attribute", () => {
  it("every category variant carries data-category-layout set to its own member name, exactly once", () => {
    for (const [name, Component] of CATEGORY_MEMBERS) {
      const html = renderToStaticMarkup(
        React.createElement(Component, { products: categoryProductsFixture() }),
      );
      expect(html.length).toBeGreaterThan(0);
      expect(html.match(new RegExp(`data-category-layout="${name}"`, "g"))).toHaveLength(1);
    }
  });

  it("every home hero variant, handed a real featured product, carries data-home-hero set to its own member name, exactly once", () => {
    for (const [name, Component] of HOME_MEMBERS) {
      const html = renderToStaticMarkup(
        React.createElement(Component, { featuredProduct: featuredProductWithImage() }),
      );
      expect(html.length).toBeGreaterThan(0);
      expect(html.match(new RegExp(`data-home-hero="${name}"`, "g"))).toHaveLength(1);
    }
  });

  it("every product gallery variant carries data-product-gallery set to its own member name, exactly once", () => {
    for (const [name, Component] of PRODUCT_MEMBERS) {
      const html = renderToStaticMarkup(React.createElement(Component, galleryFixtureProps()));
      expect(html.length).toBeGreaterThan(0);
      expect(html.match(new RegExp(`data-product-gallery="${name}"`, "g"))).toHaveLength(1);
    }
  });
});

// --- Production lookup maps mirror their enum exactly ----------------------
//
// The compiler already refuses a map missing a member (each map is declared
// over the enum's Record type) — this reads the source directly and catches
// the OTHER direction: a stray key or a reordering.

const MAP_HOLDING_FILES: ReadonlyArray<{
  path: string;
  mapName: string;
  enumMembers: readonly string[];
}> = [
  {
    path: "components/layout/category/category-layout-map.ts",
    mapName: "CATEGORY_LAYOUT_MAP",
    enumMembers: CATEGORY_LAYOUTS,
  },
  {
    path: "components/layout/home/home-hero-map.ts",
    mapName: "HOME_HERO_MAP",
    enumMembers: HOME_HEROES,
  },
  {
    path: "app/product/[slug]/ProductDisplay.tsx",
    mapName: "PRODUCT_GALLERY_MAP",
    enumMembers: PRODUCT_GALLERIES,
  },
];

function extractMapKeys(src: string, mapName: string): string[] {
  const re = new RegExp(`${mapName}[\\s\\S]*?=\\s*{([\\s\\S]*?)};`);
  const match = src.match(re);
  if (!match) {
    throw new Error(`could not locate a ${mapName} declaration to extract keys from`);
  }
  return [...match[1].matchAll(/^\s*"?([a-zA-Z0-9-]+)"?:/gm)].map((m) => m[1]);
}

describe("Each production lookup map's declared key set equals its enum, in order, with no duplicate key", () => {
  it.each(MAP_HOLDING_FILES.map((f) => [f.path, f.mapName, f.enumMembers] as const))(
    "%s (%s)",
    (path, mapName, enumMembers) => {
      const keys = extractMapKeys(source(path), mapName);
      expect(keys).toEqual([...enumMembers]);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );
});

// --- No name-literal comparison of a resolved value ------------------------

const NAME_LITERAL_CHECK_FILES = [
  "components/layout/category/category-layout-map.ts",
  "components/layout/home/home-hero-map.ts",
  "app/product/[slug]/ProductDisplay.tsx",
  "app/category/[slug]/CategoryDisplay.tsx",
];

const ALL_MEMBERS = [...CATEGORY_LAYOUTS, ...HOME_HEROES, ...PRODUCT_GALLERIES];

describe("No map-holding or display file compares a resolved value against a member name literal", () => {
  it.each(NAME_LITERAL_CHECK_FILES)("%s contains no === / switch comparison against any member name", (path) => {
    const src = source(path);
    for (const member of ALL_MEMBERS) {
      const comparisonPattern = new RegExp(`(===|switch\\s*\\()[^\\n]*["']${member}["']`);
      expect(src).not.toMatch(comparisonPattern);
    }
  });
});

// --- No generically-named layout/variant prop ------------------------------

const PHASE_COMPONENT_FILES = [
  "components/layout/category/CategoryGrid3.tsx",
  "components/layout/category/CategoryGrid2.tsx",
  "components/layout/category/CategoryList.tsx",
  "components/layout/category/category-layout-map.ts",
  "components/layout/home/HomeHeroFullBleed.tsx",
  "components/layout/home/HomeHeroSplit.tsx",
  "components/layout/home/HomeHeroMinimal.tsx",
  "components/layout/home/home-hero-map.ts",
  "components/layout/product/ProductGalleryLeft.tsx",
  "components/layout/product/ProductGalleryTop.tsx",
  "components/layout/product/gallery-media-url.ts",
  "components/admin/LayoutSwitches.tsx",
];

describe("No component file created by this phase declares a prop named for the generic concept rather than for its own switch", () => {
  it.each(PHASE_COMPONENT_FILES)("%s has no bare `layout`/`variant` prop declaration", (path) => {
    const src = source(path);
    // A word-boundary check: "categoryLayout:"/"homeHero:"/"productGallery:"
    // (the switch's OWN name) must not trip this — only a bare `layout:` or
    // `variant:` key, never preceded by a letter that would make it part of
    // a longer, switch-specific identifier.
    expect(src).not.toMatch(/[^a-zA-Z](layout|variant)\??:\s/);
  });
});

// --- No cross-request memoisation or module-scope mutable state -----------

function listFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("No cross-request memoisation helper or module-scope mutable declaration in the layout tree or the resolver", () => {
  const layoutTreeFiles = listFilesRecursive(join(process.cwd(), "components", "layout"));
  const resolverFiles = [
    join(process.cwd(), "lib", "layout", "settings.ts"),
    join(process.cwd(), "lib", "layout", "variants.ts"),
  ];
  const allFiles = [...layoutTreeFiles, ...resolverFiles];

  it.each(allFiles.map((f) => [relative(process.cwd(), f)]))(
    "%s has no top-level `let`, no `unstable_cache`, and no `globalThis` reference",
    (relativePath) => {
      const src = source(relativePath);
      expect(src).not.toMatch(/^(export\s+)?let\s+[A-Za-z_]/m);
      expect(src).not.toMatch(/unstable_cache/);
      expect(src).not.toMatch(/globalThis\./);
    },
  );
});

// --- Neither image-bearing hero reads its image from settings/store-config -

describe("Neither image-bearing hero variant reads its image from a settings module or a store-config field", () => {
  it.each([
    "components/layout/home/HomeHeroSplit.tsx",
    "components/layout/home/HomeHeroFullBleed.tsx",
  ])("%s never references lib/layout/settings, lib/themes/active-theme, or StoreConfig", (path) => {
    const src = source(path);
    expect(src).not.toMatch(/lib\/layout\/settings/);
    expect(src).not.toMatch(/lib\/themes\/active-theme/);
    expect(src).not.toMatch(/StoreConfig/);
  });
});

// --- Coverage assertion: every member has a case in its own per-switch suite

describe("Every one of the eight variants is covered by at least one case in its own per-switch suite (D-13 survives a ninth variant)", () => {
  const categorySuite = source(
    "tests/unit/components/layout/category/category-variants.test.ts",
  );
  const homeSuite = source("tests/unit/components/layout/home/home-hero-variants.test.ts");
  const productSuite = source(
    "tests/unit/components/layout/product/product-gallery-variants.test.ts",
  );

  it.each(CATEGORY_LAYOUTS.map((m) => [m]))("category-variants.test.ts covers %s", (member) => {
    expect(categorySuite).toContain(`"${member}"`);
  });

  it.each(HOME_HEROES.map((m) => [m]))("home-hero-variants.test.ts covers %s", (member) => {
    expect(homeSuite).toContain(`"${member}"`);
  });

  it.each(PRODUCT_GALLERIES.map((m) => [m]))("product-gallery-variants.test.ts covers %s", (member) => {
    expect(productSuite).toContain(`"${member}"`);
  });
});
