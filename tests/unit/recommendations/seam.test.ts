import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/types";

const { getRecommendationSettings, listProducts, getBaseRecommendations } = vi.hoisted(() => ({
  getRecommendationSettings: vi.fn(),
  listProducts: vi.fn(),
  getBaseRecommendations: vi.fn(),
}));

vi.mock("@/lib/utils/settings", () => ({ getRecommendationSettings }));
vi.mock("@/lib/models/mach/products", () => ({ listProducts }));
vi.mock("@/lib/recommendations/providers/registry", () => ({
  getProvider: () => ({ getBaseRecommendations }),
}));

import { getRecommendationsForProduct } from "@/lib/recommendations";

const source = { id: "source", name: "Source", variants: [] } as Product;
const a = { id: "a", name: "A", variants: [] } as Product;
const b = { id: "b", name: "B", variants: [] } as Product;

beforeEach(() => {
  getRecommendationSettings.mockResolvedValue({
    strategy: "deterministic",
    personalize: false,
    limit: 2,
    excludeOwned: false,
  });
  listProducts.mockResolvedValue([source, a, b]);
  getBaseRecommendations.mockResolvedValue([a, b]);
});

describe("getRecommendationsForProduct", () => {
  it("queries only active catalog products and returns the configured count", async () => {
    const result = await getRecommendationsForProduct(source);
    expect(listProducts).toHaveBeenCalledWith({ status: ["active"] });
    expect(getBaseRecommendations).toHaveBeenCalledWith(source, 7, {
      allProducts: [source, a, b],
    });
    expect(result.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("falls back to the catalog when the selected provider fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getBaseRecommendations.mockRejectedValueOnce(new Error("batch unavailable"));
    expect((await getRecommendationsForProduct(source)).map(({ id }) => id)).toEqual(["a", "b"]);
    error.mockRestore();
  });
});
