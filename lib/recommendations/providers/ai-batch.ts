import { eq } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { product_recommendations } from "@/lib/db/schema/product-recommendations";
import type { Product } from "@/lib/types";
import type { RecommendationProvider } from "../types";

interface BatchRow {
  recommended_product_id: string;
  rank: number;
}

export function hydrateBatchRecommendations(
  rows: readonly BatchRow[],
  allProducts: readonly Product[],
  count: number,
): Product[] {
  const byId = new Map(allProducts.map((product) => [String(product.id), product]));
  return [...rows]
    .sort((left, right) => left.rank - right.rank)
    .map((row) => byId.get(String(row.recommended_product_id)))
    .filter((product): product is Product => product !== undefined)
    .slice(0, Math.max(0, Math.trunc(count)));
}

export const aiBatchProvider: RecommendationProvider = {
  async getBaseRecommendations(product, count, context) {
    const db = await getDbAsync();
    const rows = await db
      .select({
        recommended_product_id: product_recommendations.recommended_product_id,
        rank: product_recommendations.rank,
      })
      .from(product_recommendations)
      .where(eq(product_recommendations.source_product_id, String(product.id)));
    return hydrateBatchRecommendations(rows, context.allProducts, count);
  },
};
