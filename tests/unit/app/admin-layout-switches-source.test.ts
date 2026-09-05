import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_LAYOUTS,
  HOME_HEROES,
  PRODUCT_GALLERIES,
  DEFAULT_LAYOUTS,
} from "@/lib/layout/variants";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Mirrors tests/unit/app/admin-appearance-source.test.ts's structure exactly
 * (07-PATTERNS.md): renders the real, exported LayoutSwitchesContent (the
 * pure, props-driven view split out of LayoutSwitches for exactly this
 * purpose) via react-dom/server's renderToStaticMarkup, and exercises
 * extractLayoutSelections and nextRovingIndex directly. There is no
 * jsdom/@testing-library/react in this project's test dependencies, so real
 * event simulation is out of reach; what IS covered directly, against real
 * render output, is everything the interaction paths ultimately produce:
 * group/option counts, ARIA roles/state, Save-disabled combinations, and the
 * pure roving-index math the keydown handler calls. A few assertions remain
 * as source-text checks where the underlying behavior (an async fetch call,
 * or copy embedded in an imperative toast.* call) lives inside
 * LayoutSwitches's effects/handlers and genuinely cannot be observed from a
 * static render.
 */

const { LayoutSwitchesContent, extractLayoutSelections, nextRovingIndex } = await import(
  "@/components/admin/LayoutSwitches"
);

const TOTAL_OPTIONS = CATEGORY_LAYOUTS.length + HOME_HEROES.length + PRODUCT_GALLERIES.length;

function renderSwitches(
  props: Partial<React.ComponentProps<typeof LayoutSwitchesContent>> = {},
) {
  return renderToStaticMarkup(
    React.createElement(LayoutSwitchesContent, {
      status: "loaded",
      saved: { ...DEFAULT_LAYOUTS },
      pending: {},
      saving: false,
      onSelect: () => {},
      onGroupKeyDown: () => {},
      onSave: () => {},
      ...props,
    }),
  );
}

describe("LayoutSwitchesContent — rendered behavior", () => {
  it("renders exactly one radiogroup per switch and one radio per enum member — no hardcoded counts", () => {
    const html = renderSwitches();
    expect(html.match(/role="radiogroup"/g)).toHaveLength(3);
    expect(html.match(/role="radio"/g)).toHaveLength(TOTAL_OPTIONS);
  });

  it("exposes each group's accessible name matching its own group label", () => {
    const html = renderSwitches();
    expect(html).toContain('aria-label="Category layout"');
    expect(html).toContain('aria-label="Home hero"');
    expect(html).toContain('aria-label="Product gallery"');
  });

  it("checks the option matching each saved value when there is no pending change, and disables Save", () => {
    const html = renderSwitches({
      saved: { categoryLayout: "grid-2", homeHero: "split", productGallery: "top" },
    });
    expect(html.match(/aria-checked="true"/g)).toHaveLength(3);
    expect(html).toMatch(/id="layout-option-categoryLayout-grid-2"[^>]*aria-checked="true"/);
    expect(html).toMatch(/id="layout-option-homeHero-split"[^>]*aria-checked="true"/);
    expect(html).toMatch(/id="layout-option-productGallery-top"[^>]*aria-checked="true"/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("reflects a pending change in one group without moving the other two groups' checked options", () => {
    const html = renderSwitches({
      saved: { ...DEFAULT_LAYOUTS },
      pending: { categoryLayout: "list" },
    });
    expect(html).toMatch(/id="layout-option-categoryLayout-list"[^>]*aria-checked="true"/);
    expect(html).toMatch(
      new RegExp(`id="layout-option-homeHero-${DEFAULT_LAYOUTS.homeHero}"[^>]*aria-checked="true"`),
    );
    expect(html).toMatch(
      new RegExp(
        `id="layout-option-productGallery-${DEFAULT_LAYOUTS.productGallery}"[^>]*aria-checked="true"`,
      ),
    );
  });

  it("enables Save once a pending value differs from saved, and disables it again once they match", () => {
    const enabled = renderSwitches({
      saved: { ...DEFAULT_LAYOUTS },
      pending: { categoryLayout: "list" },
    });
    expect(enabled).not.toMatch(/<button[^>]*disabled=""/);

    const revertedToSame = renderSwitches({
      saved: { ...DEFAULT_LAYOUTS },
      pending: { categoryLayout: DEFAULT_LAYOUTS.categoryLayout },
    });
    expect(revertedToSame).toMatch(/<button[^>]*disabled=""/);
  });

  it("renders options in the loading state but disables Save", () => {
    const html = renderSwitches({ status: "loading", saved: null });
    expect(html.match(/role="radio"/g)).toHaveLength(TOTAL_OPTIONS);
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("shows the load-failure banner with the theme grid's exact copy and disables Save", () => {
    const html = renderSwitches({ status: "error", saved: null });
    expect(html).toContain("Settings could not be loaded.");
    expect(html).toContain(
      "The fields below are showing defaults, not your stored values, so saving is disabled to keep it from overwriting them.",
    );
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("disables Save and shows the in-progress label while saving", () => {
    const html = renderSwitches({
      saved: { ...DEFAULT_LAYOUTS },
      pending: { categoryLayout: "list" },
      saving: true,
    });
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("Saving…");
  });

  it("renders every option's icon and label matching the copywriting contract exactly", () => {
    const html = renderSwitches();
    expect(html).toContain("3 columns");
    expect(html).toContain("2 columns");
    expect(html).toMatch(/<span class="text-sm">List<\/span>/);
    expect(html).toContain("Minimal");
    expect(html).toContain("Split");
    expect(html).toContain("Full-bleed");
    expect(html).toContain("Gallery left");
    expect(html).toContain("Gallery top");
    expect(html.match(/<svg/g)?.length).toBeGreaterThanOrEqual(TOTAL_OPTIONS);
  });

  it("renders no group with zero options — each group's option count matches its own enum length", () => {
    const html = renderSwitches();
    const categoryRadios = html.match(/id="layout-option-categoryLayout-[^"]*"/g);
    const heroRadios = html.match(/id="layout-option-homeHero-[^"]*"/g);
    const galleryRadios = html.match(/id="layout-option-productGallery-[^"]*"/g);
    expect(categoryRadios).toHaveLength(CATEGORY_LAYOUTS.length);
    expect(heroRadios).toHaveLength(HOME_HEROES.length);
    expect(galleryRadios).toHaveLength(PRODUCT_GALLERIES.length);
  });
});

describe("extractLayoutSelections()", () => {
  it("falls back to each switch's default for an absent row", () => {
    expect(extractLayoutSelections([])).toEqual(DEFAULT_LAYOUTS);
  });

  it("falls back to the default for an unparseable value", () => {
    const result = extractLayoutSelections([
      { key: "appearance.category_layout", value: "not json" },
    ]);
    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
  });

  it("falls back to the default for a non-string parsed value", () => {
    const result = extractLayoutSelections([{ key: "appearance.home_hero", value: "42" }]);
    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
  });

  it("falls back to the default for a value outside that switch's own enum", () => {
    const result = extractLayoutSelections([
      { key: "appearance.product_gallery", value: '"not-a-real-gallery"' },
    ]);
    expect(result.productGallery).toBe(DEFAULT_LAYOUTS.productGallery);
  });

  it("returns the stored member when it is valid", () => {
    const result = extractLayoutSelections([
      { key: "appearance.category_layout", value: '"grid-2"' },
      { key: "appearance.home_hero", value: '"split"' },
      { key: "appearance.product_gallery", value: '"top"' },
    ]);
    expect(result).toEqual({ categoryLayout: "grid-2", homeHero: "split", productGallery: "top" });
  });

  it("rejects a value valid for a different switch — cross-switch isolation", () => {
    // "left" is a member of PRODUCT_GALLERIES, not CATEGORY_LAYOUTS or HOME_HEROES.
    const result = extractLayoutSelections([
      { key: "appearance.category_layout", value: '"left"' },
      { key: "appearance.home_hero", value: '"left"' },
    ]);
    expect(result.categoryLayout).toBe(DEFAULT_LAYOUTS.categoryLayout);
    expect(result.homeHero).toBe(DEFAULT_LAYOUTS.homeHero);
  });
});

describe("nextRovingIndex()", () => {
  it("moves forward on ArrowRight/ArrowDown and backward on ArrowLeft/ArrowUp", () => {
    expect(nextRovingIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextRovingIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextRovingIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(nextRovingIndex(1, "ArrowUp", 3)).toBe(0);
  });

  it("wraps forwards past the last index and backwards past the first, for a group of three", () => {
    expect(nextRovingIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextRovingIndex(0, "ArrowLeft", 3)).toBe(2);
  });

  it("wraps forwards past the last index and backwards past the first, for a group of two", () => {
    expect(nextRovingIndex(1, "ArrowRight", 2)).toBe(0);
    expect(nextRovingIndex(0, "ArrowLeft", 2)).toBe(1);
  });
});

describe("LayoutSwitches source wiring (source-level checks)", () => {
  // These remain source-text checks deliberately: they assert on request
  // wiring (which endpoint URL is used, response-vs-pending read-back) and
  // imperative toast/heading copy that live inside LayoutSwitches's
  // effects/async handlers, neither of which renderToStaticMarkup can
  // observe without jsdom/@testing-library, which are not present in this
  // project's test dependencies (06-REVIEW WR-03 precedent).
  it("posts to the existing settings endpoint and introduces no new route", () => {
    const grid = source("components/admin/LayoutSwitches.tsx");
    expect(grid).toContain('fetch("/api/admin/settings"');
    expect(grid).toContain('fetch(`/api/admin/settings?category=');
  });

  it("sends exactly three updates in one request under the appearance category", () => {
    const grid = source("components/admin/LayoutSwitches.tsx");
    expect(grid).toContain("const updates = SWITCH_GROUPS.map(");
    expect(grid).toContain("category: APPEARANCE_SETTINGS_CATEGORY,");
    expect(grid).toContain("body: JSON.stringify({ updates })");
  });

  it("reads the confirmed values back from the response body, not the pending state", () => {
    const grid = source("components/admin/LayoutSwitches.tsx");
    expect(grid).toContain("setSaved(extractLayoutSelections(body.settings))");
  });

  it("uses the exact toast, heading and subtitle copywriting-contract literals", () => {
    const grid = source("components/admin/LayoutSwitches.tsx");
    expect(grid).toContain("Layout saved.");
    expect(grid).toContain("Couldn't save your layout changes. Try again.");
    expect(grid).toContain("Layout</h2>");
    expect(grid).toContain(
      "Change the structure of the category grid, home hero, and product gallery —",
    );
  });
});
