import type { Product } from "@/lib/types";
import type { RecsUserContext } from "./types";

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function productSignals(product: Product): Set<string> {
  return new Set([
    ...strings(product.tags),
    ...strings(product.categories),
    ...(typeof product.type === "string" ? [product.type] : []),
    ...(typeof product.brand === "string" ? [product.brand] : []),
  ].map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

/** Stable, catalog-neutral similarity with an optional purchase-history boost. */
export function rankRecommendationCandidates(
  source: Product,
  catalog: readonly Product[],
  count: number,
  userContext: RecsUserContext | null = null,
): Product[] {
  const sourceSignals = productSignals(source);
  const purchasedIds = new Set(userContext?.recentPurchases.map(String) ?? []);
  const purchasedSignals = new Set<string>();
  for (const product of catalog) {
    if (!purchasedIds.has(String(product.id))) continue;
    for (const signal of productSignals(product)) purchasedSignals.add(signal);
  }

  return catalog
    .map((product, index) => ({
      product,
      index,
      score:
        overlap(sourceSignals, productSignals(product)) * 4 +
        overlap(purchasedSignals, productSignals(product)) * 2,
    }))
    .filter(({ product }) => String(product.id) !== String(source.id))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, Math.trunc(count)))
    .map(({ product }) => product);
}
