import { describe, expect, it } from "vitest";

import {
  collectionRedirects,
  pageRedirects,
  productRedirects,
  transformRedirects,
} from "@/scripts/shopify-migration/transformers/redirects";

describe("redirect transform", () => {
  it("uses verified public slugs rather than generated entity IDs", () => {
    expect(productRedirects([{ legacyHandle: "old-product", publicSlug: "new-product" }])[0]).toMatchObject({
      sourcePath: "/products/old-product",
      targetPath: "/product/new-product",
    });
    expect(collectionRedirects([{ legacyHandle: "old", publicSlug: "new" }])[0].targetPath).toBe("/category/new");
    expect(pageRedirects([{ legacyHandle: "old", publicSlug: "new" }])[0].targetPath).toBe("/new");
    expect(() => productRedirects([{ legacyHandle: "old", publicSlug: "shopify_product_deadbeef" }])).toThrow(
      "Invalid public route segment",
    );
    const generated = transformRedirects([], {
      generated: productRedirects([{ legacyHandle: "old", publicSlug: "new" }]),
    });
    expect(generated.records[0].sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.idMap.get(generated.records[0].sourceFingerprint!)).toBe("/products/old");
  });

  it("accepts only executable legacy sources and deduplicates identical entries", () => {
    const result = transformRedirects([
      { id: 1, path: "/products/old", target: "/product/new" },
      { id: 2, path: "/products/old", target: "/product/new" },
      { id: 3, path: "/external", target: "https://example.test" },
      { id: 4, path: "/pages/encoded", target: "/safe/%2e%2e/admin" },
      { id: 5, path: "/pages/query?x=1", target: "/new" },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ sourcePath: "/products/old", targetPath: "/product/new" });
    expect(result.warnings[0]).toContain("duplicate");
    expect(result.skipped).toHaveLength(3);
    expect([...result.idMap.keys()].every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });

  it("accepts every runtime legacy prefix and rejects runtime-inert path forms", () => {
    const result = transformRedirects([
      { id: 1, path: "/products/old", target: "/product/new" },
      { id: 2, path: "/collections/old", target: "/category/new" },
      { id: 3, path: "/pages/old", target: "/new" },
      { id: 4, path: "/blogs/news/old", target: "/blog/new" },
      { id: 5, path: "/policies/old", target: "/policy/new" },
      { id: 6, path: "/products/%6f", target: "/product/encoded" },
      { id: 7, path: "/products/café", target: "/product/unicode" },
      { id: 8, path: `/products/${Array.from({ length: 12 }, (_, index) => `s${index}`).join("/")}`, target: "/too-many" },
      { id: 9, path: `/products/${"a".repeat(2040)}`, target: "/long-source" },
      { id: 10, path: "/products/long-target", target: `/${"a".repeat(2048)}` },
      { id: 11, path: "/products/legacy-target", target: "/products/new" },
      { id: 12, path: "/pages/protected", target: "/elsewhere" },
      { id: undefined, path: "/pages/no-id", target: "/elsewhere" },
    ] as Parameters<typeof transformRedirects>[0], {
      protectedSourcePaths: new Set(["/pages/protected"]),
    });

    expect(result.records.map(({ sourcePath }) => sourcePath)).toEqual([
      "/blogs/news/old",
      "/collections/old",
      "/pages/old",
      "/policies/old",
      "/products/old",
    ]);
    expect(result.skipped).toHaveLength(8);
    expect(result.skipped.map(({ reason }) => reason)).toContain(
      "Shopify redirect requires a bounded source ID and text paths",
    );
  });

  it("removes conflicting source mappings", () => {
    const result = transformRedirects([
      { id: 1, path: "/products/collision", target: "/product/one" },
      { id: 2, path: "/products/collision", target: "/product/two" },
      { id: 3, path: "/products/kept", target: "/product/destination" },
    ]);
    expect(result.records.map(({ sourcePath }) => sourcePath)).toEqual(["/products/kept"]);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].reason).toContain("conflicting targets");
  });

  it("detects cycles before the runtime policy rejects legacy targets", () => {
    const result = transformRedirects([
      { id: 1, path: "/products/cycle-a", target: "/products/cycle-b" },
      { id: 2, path: "/products/cycle-b", target: "/products/cycle-a" },
      { id: 3, path: "/products/into-cycle", target: "/products/cycle-a" },
    ]);
    expect(result.records).toEqual([]);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.every(({ reason }) => reason.includes("cycle"))).toBe(true);
  });
});
