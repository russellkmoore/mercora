import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CATEGORY_LAYOUTS } from "@/lib/layout/variants";
import { categoryProductsFixture, emptyProductsFixture } from "./fixtures";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const { default: CategoryGrid3 } = await import("@/components/layout/category/CategoryGrid3");
const { default: CategoryGrid2 } = await import("@/components/layout/category/CategoryGrid2");
const { default: CategoryList } = await import("@/components/layout/category/CategoryList");
const { CATEGORY_LAYOUT_MAP } = await import(
  "@/components/layout/category/category-layout-map"
);

const VARIANTS = [
  { name: "grid-3" as const, Component: CategoryGrid3 },
  { name: "grid-2" as const, Component: CategoryGrid2 },
  { name: "list" as const, Component: CategoryList },
];

const EMPTY_STATE_SENTENCE = "No products found in this category.";

describe.each(VARIANTS)("$name category variant", ({ name, Component }) => {
  it("renders one card/row per product, in the order given, with no re-sorting", () => {
    const products = categoryProductsFixture();
    const html = renderToStaticMarkup(
      React.createElement(Component, { products }),
    );
    // Every product's name appears, and in fixture order (id order is a
    // reasonable proxy since names are distinct and appear once each).
    const indices = products.map((p) => {
      const productName =
        typeof p.name === "string" ? p.name : Object.values(p.name ?? {})[0] ?? "";
      return html.indexOf(productName as string);
    });
    expect(indices.every((i) => i >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(html).not.toContain(EMPTY_STATE_SENTENCE);
  });

  it("renders the empty-state sentence exactly once and no product row for an empty array", () => {
    const html = renderToStaticMarkup(
      React.createElement(Component, { products: emptyProductsFixture() }),
    );
    const occurrences = html.split(EMPTY_STATE_SENTENCE).length - 1;
    expect(occurrences).toBe(1);
    expect(html).not.toContain("Learn more");
  });

  it(`carries data-category-layout="${name}" on its root element exactly once`, () => {
    const html = renderToStaticMarkup(
      React.createElement(Component, { products: categoryProductsFixture() }),
    );
    const matches = html.match(new RegExp(`data-category-layout="${name}"`, "g")) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe("CategoryList per-field fallbacks", () => {
  it("shows the no-rating fallback for a product with no rating", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategoryList, { products: categoryProductsFixture() }),
    );
    expect(html).toContain("Be the first to review");
  });

  it("omits the price line for a product with no price", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategoryList, {
        products: [categoryProductsFixture()[1]],
      }),
    );
    expect(html).not.toMatch(/\$\d/);
  });

  it("shows the unavailable copy for a product not available for sale", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategoryList, {
        products: [categoryProductsFixture()[2]],
      }),
    );
    expect(html).toContain("Coming Soon");
  });
});

describe("CATEGORY_LAYOUT_MAP", () => {
  it("has exactly the category enum's members as keys, in order, with no duplicates", () => {
    expect(Object.keys(CATEGORY_LAYOUT_MAP)).toEqual([...CATEGORY_LAYOUTS]);
  });

  it("resolves every enum member to a component that renders non-empty markup", () => {
    for (const layout of CATEGORY_LAYOUTS) {
      const Variant = CATEGORY_LAYOUT_MAP[layout];
      const html = renderToStaticMarkup(
        React.createElement(Variant, { products: categoryProductsFixture() }),
      );
      expect(html.length).toBeGreaterThan(0);
    }
  });
});

describe("CategoryDisplay source contract (LAYOUT-04 anti-genericity)", () => {
  it("contains no comparison of a resolved value against any category variant name literal", () => {
    const display = source("app/category/[slug]/CategoryDisplay.tsx");
    for (const layout of CATEGORY_LAYOUTS) {
      // A literal comparison would read `=== "grid-3"` (or similar); a bare
      // string occurrence inside a comment/doc example does not count. The
      // only string literal occurrences of any enum member in this file are
      // inside the JSDoc explaining the map-access pattern, never adjacent
      // to a `===`/`switch` operator.
      const comparisonPattern = new RegExp(
        `(===|switch\\s*\\()[^\\n]*["']${layout}["']`,
      );
      expect(display).not.toMatch(comparisonPattern);
    }
    // No if/switch branch on categoryLayout at all — only the single map access.
    expect(display).not.toMatch(/if\s*\(\s*categoryLayout/);
    expect(display).not.toMatch(/switch\s*\(\s*categoryLayout/);
  });

  it("takes no prop typed as a bare string for the resolved layout", () => {
    const display = source("app/category/[slug]/CategoryDisplay.tsx");
    // The resolved layout prop must be typed to the specific enum union,
    // never a bare `string` (the generic-`layout`-prop anti-pattern).
    expect(display).not.toMatch(/categoryLayout:\s*string/);
    expect(display).toContain("categoryLayout: CategoryLayout");
  });
});
