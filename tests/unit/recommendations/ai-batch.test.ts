import { describe, expect, it } from "vitest";
import { hydrateBatchRecommendations } from "@/lib/recommendations/providers/ai-batch";
import type { Product } from "@/lib/types";

const products = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
] as Product[];

describe("hydrateBatchRecommendations", () => {
  it("hydrates stored IDs in rank order and ignores missing catalog records", () => {
    expect(
      hydrateBatchRecommendations(
        [
          { recommended_product_id: "missing", rank: 0 },
          { recommended_product_id: "b", rank: 2 },
          { recommended_product_id: "a", rank: 1 },
        ],
        products,
        2,
      ).map(({ id }) => id),
    ).toEqual(["a", "b"]);
  });
});
