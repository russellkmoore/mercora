import type { Product } from "@/lib/types";
import { listProducts } from "@/lib/models/mach/products";
import { getRecommendationSettings } from "@/lib/utils/settings";
import { blendRecommendations } from "./blend";
import { getProvider } from "./providers/registry";
import type { RecsUserContext } from "./types";

export async function getRecommendationsForProduct(
  product: Product,
  options: { userContext?: RecsUserContext | null; limit?: number } = {},
): Promise<Product[]> {
  try {
    const settings = await getRecommendationSettings();
    const requestedLimit = options.limit ?? settings.limit;
    const limit = Math.max(1, Math.min(6, Math.trunc(requestedLimit)));
    const allProducts = await listProducts({ status: ["active"] });
    const provider = getProvider(settings.strategy);

    let base: Product[] = [];
    try {
      base = await provider.getBaseRecommendations(product, limit + 5, {
        allProducts,
      });
    } catch (error) {
      console.error(
        "getRecommendationsForProduct: provider failed; using catalog fallback",
        error,
      );
    }

    return blendRecommendations({
      product,
      base,
      allProducts,
      userContext: options.userContext ?? null,
      limit,
      personalize: settings.personalize,
      excludeOwned: settings.excludeOwned,
    });
  } catch (error) {
    console.error("getRecommendationsForProduct: failed", error);
    return [];
  }
}

export type { RecsUserContext } from "./types";
