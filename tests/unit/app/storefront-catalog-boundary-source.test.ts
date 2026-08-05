import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("storefront catalog boundaries", () => {
  it.each([
    "app/product/[slug]/page.tsx",
    "app/category/[slug]/page.tsx",
    "app/page.tsx",
  ])("projects products before the client boundary in %s", (path) => {
    const contents = source(path);
    expect(contents).toContain("toPublicProduct");
    expect(contents).toMatch(/status\s*!==?\s*["']active["']|status\s*===?\s*["']active["']/);
  });

  it.each([
    "lib/mcp/tools/search.ts",
    "lib/mcp/tools/recommend.ts",
    "lib/mcp/tools/assess.ts",
  ])("uses the public projection for external catalog output in %s", (path) => {
    expect(source(path)).toContain("toPublicProduct");
  });

  it("keeps exact inventory out of storefront components", () => {
    const productDisplay = source("app/product/[slug]/ProductDisplay.tsx");
    expect(productDisplay).toContain("available_for_sale");
    expect(productDisplay).not.toContain("quantityInStock");
  });
});
