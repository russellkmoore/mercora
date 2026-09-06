import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readParitySnapshot } from "../../../helpers/parity-snapshot";
import { categoryProductsFixture } from "./fixtures";

/**
 * Pre/post-extraction parity for CategoryDisplay's products section.
 *
 * The committed snapshot at SNAPSHOT_PATH is the frozen recording made when
 * this suite was first written; CategoryGrid3.tsx is a verbatim extraction
 * of the same JSX. This test renders CategoryDisplay, strips the per-switch
 * evidence attribute, and asserts the render is byte-identical to the
 * recording — proving the extraction changed nothing but that one permitted
 * attribute. The baseline read goes through readParitySnapshot (D-06): a
 * missing baseline fails loudly rather than silently regenerating.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const { default: CategoryDisplay } = await import("@/app/category/[slug]/CategoryDisplay");

const SNAPSHOT_PATH = join(
  process.cwd(),
  "tests/unit/components/layout/category/__snapshots__/category-display-grid3.html",
);

/**
 * The per-switch evidence attribute Task 3 adds to every category variant's
 * root element (`data-category-layout="<member>"`). Pre-extraction it did
 * not exist anywhere in the markup, so stripping it was a no-op; now that
 * CategoryGrid3 exists, it is the single permitted difference from the
 * recording, and its exactly-one occurrence is asserted below.
 */
function stripLayoutAttribute(html: string): { stripped: string; occurrences: number } {
  const matches = html.match(/ data-category-layout="[^"]*"/g) ?? [];
  return {
    stripped: html.replace(/ data-category-layout="[^"]*"/g, ""),
    occurrences: matches.length,
  };
}

describe("CategoryDisplay products section — pre/post-extraction parity", () => {
  it("matches the committed recording once the evidence attribute is stripped, with exactly one occurrence", () => {
    const html = renderToStaticMarkup(
      React.createElement(CategoryDisplay, {
        products: categoryProductsFixture(),
        categoryLayout: "grid-3",
      }),
    );
    const { stripped, occurrences } = stripLayoutAttribute(html);

    const recorded = readParitySnapshot(SNAPSHOT_PATH, stripped);
    expect(stripped).toBe(recorded);
    expect(occurrences).toBe(1);
  });
});
