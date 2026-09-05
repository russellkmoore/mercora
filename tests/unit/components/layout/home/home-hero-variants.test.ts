import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
  const recording = source(RECORDING_PATH);
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
