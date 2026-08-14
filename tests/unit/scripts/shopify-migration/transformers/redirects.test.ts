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
  });

  it("accepts only safe internal paths and deduplicates identical entries", () => {
    const result = transformRedirects([
      { id: 1, path: "/old/path", target: "/new/path" },
      { id: 2, path: "/old/path", target: "/new/path" },
      { id: 3, path: "/external", target: "https://example.test" },
      { id: 4, path: "/encoded", target: "/safe/%2e%2e/admin" },
      { id: 5, path: "/query?x=1", target: "/new" },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ sourcePath: "/old/path", targetPath: "/new/path" });
    expect(result.warnings[0]).toContain("duplicate");
    expect(result.skipped).toHaveLength(3);
    expect([...result.idMap.keys()].every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });

  it("removes conflicting, cyclic, direct-loop, and protected-route redirects", () => {
    const result = transformRedirects([
      { id: 1, path: "/collision", target: "/one" },
      { id: 2, path: "/collision", target: "/two" },
      { id: 3, path: "/cycle-a", target: "/cycle-b" },
      { id: 4, path: "/cycle-b", target: "/cycle-a" },
      { id: 5, path: "/same", target: "/same" },
      { id: 6, path: "/checkout", target: "/elsewhere" },
      { id: 7, path: "/kept", target: "/destination" },
      { id: 8, path: "/into-cycle", target: "/cycle-a" },
    ], { protectedSourcePaths: new Set(["/checkout"]) });

    expect(result.records.map(({ sourcePath }) => sourcePath)).toEqual(["/kept"]);
    expect(result.skipped).toHaveLength(7);
    expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/conflicting targets/);
    expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/cycle/);
  });
});
