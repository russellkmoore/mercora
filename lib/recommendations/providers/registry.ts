import type { RecommendationProvider, RecommendationStrategy } from "../types";
import { aiBatchProvider } from "./ai-batch";
import { deterministicProvider } from "./deterministic";

export function getProvider(strategy: RecommendationStrategy): RecommendationProvider {
  return strategy === "ai_batch" ? aiBatchProvider : deterministicProvider;
}
