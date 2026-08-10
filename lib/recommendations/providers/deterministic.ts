import type { RecommendationProvider } from "../types";
import { rankRecommendationCandidates } from "../scoring";

export const deterministicProvider: RecommendationProvider = {
  async getBaseRecommendations(product, count, context) {
    return rankRecommendationCandidates(product, context.allProducts, count);
  },
};
