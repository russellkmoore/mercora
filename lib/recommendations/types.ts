import type { Product } from "@/lib/types";

export type RecommendationStrategy = "deterministic" | "ai_batch";

export interface RecommendationSettings {
  strategy: RecommendationStrategy;
  personalize: boolean;
  limit: number;
  excludeOwned: boolean;
}

export interface RecsOrderLike {
  items?: Array<{ product_id?: string | number; id?: string | number }>;
}

export interface RecsUserContext {
  orders: RecsOrderLike[];
  recentPurchases: string[];
}

export interface ProviderContext {
  allProducts: Product[];
}

export interface RecommendationProvider {
  getBaseRecommendations(
    product: Product,
    count: number,
    context: ProviderContext,
  ): Promise<Product[]>;
}
