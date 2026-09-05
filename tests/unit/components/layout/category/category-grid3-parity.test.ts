import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { categoryProductsFixture } from "./fixtures";

/**
 * Pre/post-extraction parity for CategoryDisplay's products section.
 *
 * Task 1 (this run): CategoryGrid3 does not exist yet. This test renders
 * today's CategoryDisplay, strips the (not-yet-existing) per-switch evidence
 * attribute Task 3 adds, and — because the snapshot file does not exist yet
 * either — writes it once. That write IS the frozen recording; committing it
 * is the whole point of this task, not a build artefact to .gitignore.
 *
 * Task 3: CategoryGrid3.tsx is a verbatim extraction of the same JSX. This
 * same test then finds the snapshot already on disk and asserts the new
 * render is byte-identical to it once the evidence attribute is stripped —
 * proving the extraction changed nothing but the one permitted attribute.
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

    if (!existsSync(SNAPSHOT_PATH)) {
      mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
      writeFileSync(SNAPSHOT_PATH, stripped, "utf8");
    }

    const recorded = readFileSync(SNAPSHOT_PATH, "utf8");
    expect(stripped).toBe(recorded);
    expect(occurrences).toBe(1);
  });
});
