/**
 * === Product Model ===
 *
 * This module provides functions for working with Product data, including
 * hydrating partial product records with related data from multiple tables.
 *
 * === Key Functions ===
 * - **hydrateProduct**: Transforms database product records into complete Product objects
 * - **Relational Data**: Fetches prices, inventory, images, tags, and attributes
 * - **Type Safety**: Ensures all related data is properly typed and structured
 *
 * === Database Schema ===
 * Products are stored across multiple normalized tables:
 * - `products`: Core product information
 * - `productPrices`: Current pricing data
 * - `productSalePrices`: Sale/discount pricing
 * - `productInventory`: Stock levels and availability
 * - `productImages`: Product image URLs
 * - `productTags`: Categorization tags
 * - `productUseCases`: Use case classifications
 * - `productAttributes`: Key-value attributes (color, weight, etc.)
 */

import { getDbAsync } from "@/lib/db";
import {
  productPrices,
  productSalePrices,
  productInventory,
  productImages,
  productTags,
  productUseCases,
  productAttributes,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Product } from "@/lib/types/product";
import { products } from "@/lib/db/schema";

/**
 * Hydrates a basic product record with all related data
 * 
 * Takes a minimal product record from the database and fetches all related
 * information (pricing, inventory, images, etc.) to create a complete
 * Product object suitable for use in the application.
 * 
 * @param product - Basic product record from database
 * @returns Promise<Product> - Complete product object with all related data
 * 
 * @example
 * ```typescript
 * const basicProduct = await db.select().from(products).where(eq(products.id, 1));
 * const fullProduct = await hydrateProduct(basicProduct[0]);
 * console.log(fullProduct.price, fullProduct.images, fullProduct.tags);
 * ```
 */
export async function hydrateProduct(
  product: typeof products.$inferSelect
): Promise<Product> {
  const db = await getDbAsync();

  // Batch all queries to run in parallel instead of sequentially
  // This reduces 7 sequential queries to 2 parallel batches
  const [
    // Batch 1: Single-record queries (price, sale price, inventory)
    [price, salePrice, inventory],
    // Batch 2: Multi-record queries (images, tags, use cases, attributes)
    [images, tags, useCases, attributesRaw]
  ] = await Promise.all([
    // Single-record queries
    Promise.all([
      db.select().from(productPrices).where(eq(productPrices.productId, product.id)).then(rows => rows[0]),
      db.select().from(productSalePrices).where(eq(productSalePrices.productId, product.id)).then(rows => rows[0]),
      db.select().from(productInventory).where(eq(productInventory.productId, product.id)).then(rows => rows[0])
    ]),
    // Multi-record queries
    Promise.all([
      db.select({ imageUrl: productImages.imageUrl }).from(productImages).where(eq(productImages.productId, product.id)),
      db.select({ value: productTags.tag }).from(productTags).where(eq(productTags.productId, product.id)),
      db.select({ value: productUseCases.useCase }).from(productUseCases).where(eq(productUseCases.productId, product.id)),
      db.select({ key: productAttributes.key, value: productAttributes.value }).from(productAttributes).where(eq(productAttributes.productId, product.id))
    ])
  ]);

  const attributes: Record<string, string> = {};
  for (const attr of attributesRaw) {
    attributes[attr.key] = attr.value;
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? "",
    longDescription: product.longDescription ?? "",
    primaryImageUrl: product.primaryImageUrl,
    images: images.map((img) => img.imageUrl),
    price: price?.price ?? 0,
    active: product.active ?? false,
    salePrice: salePrice?.sale_price ?? 0,
    onSale: !!product.onSale,
    quantityInStock: inventory?.quantityInStock ?? 0,
    availability:
      product.availability === "available" ? "available" : "coming_soon",
    tags: tags.map((t) => t.value),
    useCases: useCases.map((u) => u.value),
    attributes,
    aiNotes: product.aiNotes ?? "",
  };
}

/**
 * Efficiently hydrates multiple products in a single batch operation
 * 
 * This function is optimized for loading multiple products at once by using
 * the existing single-product hydrator but with better parallelization.
 * For even better performance, this could be rewritten to use SQL IN clauses.
 * 
 * @param products - Array of basic product records from database
 * @returns Promise<Product[]> - Array of fully hydrated products
 */
export async function hydrateProductsBatch(
  productRecords: (typeof products.$inferSelect)[]
): Promise<Product[]> {
  // Use Promise.all to hydrate all products in parallel instead of sequentially
  return Promise.all(productRecords.map((product: typeof products.$inferSelect) => hydrateProduct(product)));
}
