import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HOME_HEROES } from "@/lib/layout/variants";
import { readParitySnapshot } from "../../../helpers/parity-snapshot";

/**
 * Home hero variant tests (Phase 7, Plan 02).
 *
 * Task 1 covers the pre-extraction source parity for HomeHeroMinimal and its
 * own render behavior. Tasks 2 and 3 extend this same file with the split/
 * full-bleed variants, the map/source-contract rows, and the delegation
 * cases — see 07-02-PLAN.md.
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

const RECORDING_PATH =
  "tests/unit/components/layout/home/__snapshots__/home-hero-minimal-preextraction.txt";
const MINIMAL_COMPONENT_PATH = "components/layout/home/HomeHeroMinimal.tsx";

const { default: HomeHeroMinimal } = await import("@/components/layout/home/HomeHeroMinimal");

describe("HomeHeroMinimal — pre-extraction source parity", () => {
  const recording = readParitySnapshot(RECORDING_PATH);
  const componentSource = source(MINIMAL_COMPONENT_PATH);

  it("the recording file is non-empty", () => {
    expect(recording.trim().length).toBeGreaterThan(0);
  });

  it("every recorded line, normalised, appears in the extracted component's source in order — the opening section tag's remainder matches character for character, everything else matches exactly", () => {
    const recordedLines = recording.split("\n").filter((line) => line.trim() !== "");
    const componentLines = componentSource.split("\n");

    let searchFrom = 0;
    for (const rawLine of recordedLines) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("<section")) {
        // The opening tag gained a data-home-hero attribute — the remainder
        // after `<section` must still match character for character.
        const remainder = trimmed.slice("<section".length);
        const matchIndex = componentLines.findIndex(
          (line, idx) =>
            idx >= searchFrom && line.trim().startsWith("<section") && line.trim().endsWith(remainder),
        );
        expect(matchIndex).toBeGreaterThanOrEqual(searchFrom);
        searchFrom = matchIndex + 1;
        continue;
      }
      const matchIndex = componentLines.findIndex(
        (line, idx) => idx >= searchFrom && line.trim() === trimmed,
      );
      expect(matchIndex).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = matchIndex + 1;
    }
  });
});

describe("HomeHeroMinimal render", () => {
  it("renders the headline, body copy, and CTA verbatim, with exactly one link to the featured category route", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeHeroMinimal, { featuredProduct: null }),
    );
    expect(html).toContain("This Gear Powers Your Next Escape");
    expect(html).toContain(
      "High-performance electric gear, rugged and designed for the edge of",
    );
    expect(html).toContain("Shop Featured Gear");
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain('href="/category/featured"');
    expect(html.match(/data-home-hero="minimal"/g)).toHaveLength(1);
  });

  it("renders identically whether handed a featured product or null, because it ignores the prop", () => {
    const withProduct = renderToStaticMarkup(
      React.createElement(HomeHeroMinimal, {
        featuredProduct: { id: "p1", primary_image: { url: "products/x.jpg" } } as never,
      }),
    );
    const withoutProduct = renderToStaticMarkup(
      React.createElement(HomeHeroMinimal, { featuredProduct: null }),
    );
    expect(withProduct).toBe(withoutProduct);
  });
});

// --- Task 2: HomeHeroSplit / HomeHeroFullBleed ------------------------------

const { default: HomeHeroSplit } = await import("@/components/layout/home/HomeHeroSplit");
const { default: HomeHeroFullBleed } = await import(
  "@/components/layout/home/HomeHeroFullBleed"
);

const SPLIT_COMPONENT_PATH = "components/layout/home/HomeHeroSplit.tsx";
const FULL_BLEED_COMPONENT_PATH = "components/layout/home/HomeHeroFullBleed.tsx";

function productWithImage() {
  return {
    id: "featured-1",
    name: "Volt Trail Jacket",
    primary_image: { url: "products/volt-trail-jacket.jpg" },
    media: [],
  } as never;
}

function productWithNoImageData() {
  return {
    id: "featured-2",
    name: "Volt Base Layer",
  } as never;
}

const NEW_HERO_VARIANTS = [
  { name: "split" as const, Component: HomeHeroSplit, path: SPLIT_COMPONENT_PATH },
  {
    name: "full-bleed" as const,
    Component: HomeHeroFullBleed,
    path: FULL_BLEED_COMPONENT_PATH,
  },
];

describe.each(NEW_HERO_VARIANTS)("$name home hero variant", ({ name, Component, path }) => {
  it("handed a featured product, renders the copy, an image from the shared resolver, the CTA, and its own data attribute", () => {
    const html = renderToStaticMarkup(
      React.createElement(Component, { featuredProduct: productWithImage() }),
    );
    expect(html).toContain("This Gear Powers Your Next Escape");
    expect(html).toContain(
      "High-performance electric gear, rugged and designed for the edge of",
    );
    expect(html).toContain("Shop Featured Gear");
    expect(html).toContain('src="/products/volt-trail-jacket.jpg"');
    expect(html.match(new RegExp(`data-home-hero="${name}"`, "g"))).toHaveLength(1);
  });

  it("handed null, delegates to HomeHeroMinimal — the served markup carries the centred variant's attribute value and copy", () => {
    const html = renderToStaticMarkup(React.createElement(Component, { featuredProduct: null }));
    const minimalHtml = renderToStaticMarkup(
      React.createElement(HomeHeroMinimal, { featuredProduct: null }),
    );
    expect(html).toBe(minimalHtml);
    expect(html.match(/data-home-hero="minimal"/g)).toHaveLength(1);
    expect(html).not.toContain(`data-home-hero="${name}"`);
  });

  it("handed a product with no image data, still renders an image element with the shared resolver's placeholder path", () => {
    const html = renderToStaticMarkup(
      React.createElement(Component, { featuredProduct: productWithNoImageData() }),
    );
    expect(html).toContain('src="/products/placeholder.png"');
  });

  it("source contract: never references the settings/layout-settings modules or a store-config field, and uses no raw-HTML sink", () => {
    const src = source(path);
    expect(src).not.toMatch(/lib\/layout\/settings/);
    expect(src).not.toMatch(/lib\/themes\/active-theme/);
    expect(src).not.toMatch(/StoreConfig/);
    expect(src).not.toMatch(/dangerouslySetInnerHTML/);
  });
});

// --- Task 3: HOME_HERO_MAP and the app/page.tsx source contract -----------

const { HOME_HERO_MAP } = await import("@/components/layout/home/home-hero-map");
const HOME_PAGE_PATH = "app/page.tsx";

describe("HOME_HERO_MAP", () => {
  it("has exactly the hero enum's members as keys, in order, with no duplicates", () => {
    expect(Object.keys(HOME_HERO_MAP)).toEqual([...HOME_HEROES]);
  });

  it("resolves every enum member to a component that renders non-empty markup with a featured product and with null", () => {
    for (const hero of HOME_HEROES) {
      const Variant = HOME_HERO_MAP[hero];
      const withProduct = renderToStaticMarkup(
        React.createElement(Variant, { featuredProduct: productWithImage() }),
      );
      const withoutProduct = renderToStaticMarkup(
        React.createElement(Variant, { featuredProduct: null }),
      );
      expect(withProduct.length).toBeGreaterThan(0);
      expect(withoutProduct.length).toBeGreaterThan(0);
    }
  });
});

describe("app/page.tsx source contract (LAYOUT-04 anti-genericity)", () => {
  it("awaits the resolver directly in the page body, above the returned tree, not inside a Suspense child", () => {
    const page = source(HOME_PAGE_PATH);
    expect(page).toContain("await getLayoutSettings()");
    expect(page).not.toMatch(/<Suspense[^>]*>[\s\S]*getLayoutSettings/);
  });

  it("contains no comparison of a resolved value against any hero member name literal", () => {
    const page = source(HOME_PAGE_PATH);
    for (const hero of HOME_HEROES) {
      const comparisonPattern = new RegExp(`(===|switch\\s*\\()[^\\n]*["']${hero}["']`);
      expect(page).not.toMatch(comparisonPattern);
    }
    expect(page).not.toMatch(/if\s*\(\s*homeHero/);
    expect(page).not.toMatch(/switch\s*\(\s*homeHero/);
  });

  it("leaves the featured-products grid's markup, ordering, and priority flag on the first card unchanged", () => {
    const page = source(HOME_PAGE_PATH);
    expect(page).toContain(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-12 sm:mb-16",
    );
    expect(page).toContain("priority={index === 0}");
  });
});

describe("HomeHeroFullBleed scrim sentinel", () => {
  it("carries exactly one region-start and one region-end sentinel, with a written reason on the start line", () => {
    const src = source(FULL_BLEED_COMPONENT_PATH);
    const startMatches = src.match(/gsd:scan-ignore-start/g) ?? [];
    const endMatches = src.match(/gsd:scan-ignore-end/g) ?? [];
    expect(startMatches).toHaveLength(1);
    expect(endMatches).toHaveLength(1);
    const startLine = src.split("\n").find((line) => line.includes("gsd:scan-ignore-start"));
    expect(startLine).toBeTruthy();
    // A written reason means more than just the sentinel token on the line.
    expect(startLine!.replace(/[{}/*-]/g, "").replace("gsd:scan-ignore-start", "").trim().length).toBeGreaterThan(20);
  });

  it("keeps the CTA button outside the sentinel region, still on token classes", () => {
    const src = source(FULL_BLEED_COMPONENT_PATH);
    const startIdx = src.indexOf("gsd:scan-ignore-start");
    const endIdx = src.indexOf("gsd:scan-ignore-end");
    const ctaIdx = src.indexOf("Shop Featured Gear");
    expect(ctaIdx).toBeGreaterThan(endIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    expect(src).toContain("bg-primary text-on-primary");
  });
});
