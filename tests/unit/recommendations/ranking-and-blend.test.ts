import { describe, expect, it } from "vitest";
import { blendRecommendations } from "@/lib/recommendations/blend";
import { rankRecommendationCandidates } from "@/lib/recommendations/scoring";
import type { Product } from "@/lib/types";

function product(
  id: string,
  tags: string[] = [],
  inventory: { track_inventory?: boolean; quantity?: number; allow_backorder?: boolean } | null = null,
): Product {
  return {
    id,
    name: id,
    tags,
    variants: inventory === null
      ? []
      : [{ id: `${id}-variant`, sku: id, option_values: [], price: { amount: 100, currency: "USD" }, inventory }],
  } as Product;
}

describe("recommendation ranking", () => {
  it("is catalog-neutral, stable, and excludes the source", () => {
    const source = product("source", ["shared", "feature"]);
    const catalog = [
      source,
      product("unrelated", ["coffee"]),
      product("best", ["shared", "feature"]),
      product("tie", ["shared"]),
    ];
    expect(rankRecommendationCandidates(source, catalog, 3).map(({ id }) => id)).toEqual([
      "best",
      "tie",
      "unrelated",
    ]);
  });
});

describe("recommendation blending", () => {
  it("deduplicates and tops up a short provider response", () => {
    const source = product("source");
    const a = product("a");
    const b = product("b");
    const c = product("c");
    expect(
      blendRecommendations({
        product: source,
        base: [a, a],
        allProducts: [source, a, b, c],
        userContext: null,
        limit: 3,
        personalize: false,
        excludeOwned: false,
      }).map(({ id }) => id),
    ).toEqual(["a", "b", "c"]);
  });

  it("filters tracked OOS products while retaining untracked and backordered products", () => {
    const source = product("source");
    const out = product("out", [], { track_inventory: true, quantity: 0 });
    const untracked = product("untracked", [], { track_inventory: false, quantity: 0 });
    const backorder = product("backorder", [], {
      track_inventory: true,
      quantity: 0,
      allow_backorder: true,
    });
    const result = blendRecommendations({
      product: source,
      base: [out, untracked, backorder],
      allProducts: [source, out, untracked, backorder],
      userContext: null,
      limit: 3,
      personalize: false,
      excludeOwned: false,
    });
    expect(result.map(({ id }) => id)).toEqual(["untracked", "backorder"]);
  });

  it("excludes owned products from every candidate source", () => {
    const source = product("source");
    const owned = product("owned");
    const other = product("other");
    const result = blendRecommendations({
      product: source,
      base: [owned],
      allProducts: [source, owned, other],
      userContext: { orders: [{}], recentPurchases: ["owned"] },
      limit: 2,
      personalize: true,
      excludeOwned: true,
    });
    expect(result.map(({ id }) => id)).toEqual(["other"]);
  });

  it("reserves one slot for personalization when order history exists", () => {
    const source = product("source", ["shared"]);
    const a = product("a", ["shared"]);
    const b = product("b", ["shared"]);
    const c = product("c");
    const d = product("d");
    const e = product("e");
    const result = blendRecommendations({
      product: source,
      base: [c, d, e],
      allProducts: [source, a, b, c, d, e],
      userContext: { orders: [{}], recentPurchases: [] },
      limit: 3,
      personalize: true,
      excludeOwned: false,
    });
    expect(result.map(({ id }) => id)).toEqual(["c", "d", "a"]);
  });
});
