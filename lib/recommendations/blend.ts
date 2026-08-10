import { isVariantAvailable } from "@/lib/inventory/availability";
import type { Product } from "@/lib/types";
import { rankRecommendationCandidates } from "./scoring";
import type { RecsUserContext } from "./types";

export interface BlendInput {
  product: Product;
  base: Product[];
  allProducts: Product[];
  userContext: RecsUserContext | null;
  limit: number;
  personalize: boolean;
  excludeOwned: boolean;
}

export function isRecommendationAvailable(product: Product): boolean {
  const variants = product.variants ?? [];
  return variants.length === 0 || variants.some(isVariantAvailable);
}

/** Blend provider output with one personalized slot and a distinct count top-up. */
export function blendRecommendations(input: BlendInput): Product[] {
  const { product, base, allProducts, userContext, personalize, excludeOwned } = input;
  const limit = Math.max(1, Math.min(6, Math.trunc(input.limit)));
  const sourceId = String(product.id);
  const ownedIds = new Set(
    excludeOwned && userContext ? userContext.recentPurchases.map(String) : [],
  );
  const eligible = (candidate: Product) =>
    String(candidate.id) !== sourceId &&
    !ownedIds.has(String(candidate.id)) &&
    isRecommendationAvailable(candidate);

  const seen = new Set<string>();
  const cleanBase: Product[] = [];
  for (const candidate of base) {
    const id = String(candidate.id);
    if (!eligible(candidate) || seen.has(id)) continue;
    seen.add(id);
    cleanBase.push(candidate);
  }

  let result = cleanBase.slice(0, limit);
  if (personalize && userContext?.orders.length) {
    const baseTop = cleanBase.slice(0, Math.max(0, limit - 1));
    const baseIds = new Set(baseTop.map(({ id }) => String(id)));
    const personalized = rankRecommendationCandidates(
      product,
      allProducts.filter(eligible),
      limit + 5,
      userContext,
    ).find(({ id }) => !baseIds.has(String(id)));
    result = personalized ? [...baseTop, personalized] : cleanBase.slice(0, limit);
  }

  const have = new Set(result.map(({ id }) => String(id)));
  const topUp = (candidates: readonly Product[]) => {
    for (const candidate of candidates) {
      if (result.length >= limit) break;
      const id = String(candidate.id);
      if (!eligible(candidate) || have.has(id)) continue;
      have.add(id);
      result.push(candidate);
    }
  };
  topUp(cleanBase);
  topUp(allProducts);
  return result.slice(0, limit);
}
