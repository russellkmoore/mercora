import type { ExtractResult } from "../../lib/types.js";
import type { PaginationOptions, ShopifyClient } from "../../lib/shopify-api.js";

export async function extractFromShopifyApi<T>(
  client: ShopifyClient,
  resource: string,
  key: string,
  options?: PaginationOptions,
): Promise<ExtractResult<T>> {
  const records = await client.fetchPaginated<T>(resource, key, options);
  return { records, source: "api", extractedAt: new Date().toISOString() };
}
