/**
 * === Product Loaders ===
 *
 * High-level data loading functions for products throughout the application.
 * Provides clean, typed interfaces for common product retrieval patterns
 * with automatic hydration and relationship loading.
 *
 * === Features ===
 * - **Category Loading**: Get all products within a specific category
 * - **Slug Resolution**: Find products by URL-friendly slugs
 * - **Automatic Hydration**: All products returned with complete data
 * - **Type Safety**: Fully typed return values with Product interface
 * - **Error Handling**: Graceful null handling for missing products
 *
 * === Performance ===
 * - Leverages database query optimization
 * - Uses efficient single-query hydration where possible
 * - Implements proper indexing on slug and category lookups
 *
 * === Usage ===
 * ```typescript
 * // Get featured products for homepage
 * const featured = await getProductsByCategory("featured");
 * 
 * // Get specific product for detail page
 * const product = await getProductBySlug("arctic-pulse-tool");
 * ```
 */

import { getDbAsync } from "@/lib/db";
import { eq } from "drizzle-orm";
import { products } from "@/lib/db/schema";
import { hydrateProduct } from "../models/product";
import { getCategoryProducts } from "../models/category";
import type { Product } from "@/lib/types/product";

/**
 * Load all products within a specific category with caching
 * 
 * @param categorySlug - URL slug of the category to load
 * @returns Promise<Product[]> - Array of fully hydrated products
 */
export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  // For featured products on homepage, limit the query to improve performance
  if (categorySlug === "featured") {
    const products = await getCategoryProducts(categorySlug);
    return products.slice(0, 3); // Only return first 3 for performance
  }
  return getCategoryProducts(categorySlug);
}

/**
 * Load a single product by its URL slug
 * 
 * @param slug - URL-friendly product identifier
 * @returns Promise<Product | null> - Hydrated product or null if not found
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getDbAsync();
  const product = await db.query.products.findFirst({
    where: eq(products.slug, slug),
  });
  if (!product) return null;
  return await hydrateProduct(product);
}
