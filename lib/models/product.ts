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
import { eq, inArray } from "drizzle-orm";
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
  product: typeof products.$inferSelect,
  dbInstance?: Awaited<ReturnType<typeof getDbAsync>>
): Promise<Product> {
  const startTime = Date.now();
  const db = dbInstance || (await getDbAsync());
  const dbTime = Date.now();
  
  if (!dbInstance) {
    console.log(`⚡ hydrateProduct[${product.id}]: New DB connection took ${dbTime - startTime}ms`);
  }

  // Batch all queries to run in parallel instead of sequentially
  // This reduces 7 sequential queries to 2 parallel batches
  const queryStart = Date.now();
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
  
  const queryTime = Date.now();
  console.log(`⚡ hydrateProduct[${product.id}]: Parallel queries took ${queryTime - queryStart}ms`);

  const attributes: Record<string, string> = {};
  for (const attr of attributesRaw) {
    attributes[attr.key] = attr.value;
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`⚡ hydrateProduct[${product.id}]: Total hydration took ${totalTime}ms`);

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
  productRecords: (typeof products.$inferSelect)[],
  dbInstance?: Awaited<ReturnType<typeof getDbAsync>>
): Promise<Product[]> {
  const startTime = Date.now();
  console.log(`🔄 hydrateProductsBatch: Starting batch hydration of ${productRecords.length} products`);
  
  if (productRecords.length === 0) return [];
  
  const db = dbInstance || (await getDbAsync());
  const productIds = productRecords.map(p => p.id);
  
  // Single batch query for all products instead of individual queries
  const batchQueryStart = Date.now();
  const [
    allPrices,
    allSalePrices, 
    allInventory,
    allImages,
    allTags,
    allUseCases,
    allAttributes
  ] = await Promise.all([
    db.select().from(productPrices).where(inArray(productPrices.productId, productIds)),
    db.select().from(productSalePrices).where(inArray(productSalePrices.productId, productIds)),
    db.select().from(productInventory).where(inArray(productInventory.productId, productIds)),
    db.select({ productId: productImages.productId, imageUrl: productImages.imageUrl }).from(productImages).where(inArray(productImages.productId, productIds)),
    db.select({ productId: productTags.productId, value: productTags.tag }).from(productTags).where(inArray(productTags.productId, productIds)),
    db.select({ productId: productUseCases.productId, value: productUseCases.useCase }).from(productUseCases).where(inArray(productUseCases.productId, productIds)),
    db.select({ productId: productAttributes.productId, key: productAttributes.key, value: productAttributes.value }).from(productAttributes).where(inArray(productAttributes.productId, productIds))
  ]);
  
  const batchQueryTime = Date.now();
  console.log(`🔄 hydrateProductsBatch: Batch queries took ${batchQueryTime - batchQueryStart}ms`);
  
  // Group results by product ID for fast lookup
  const pricesMap = new Map(allPrices.map(p => [p.productId, p]));
  const salePricesMap = new Map(allSalePrices.map(p => [p.productId, p]));
  const inventoryMap = new Map(allInventory.map(p => [p.productId, p]));
  const imagesMap = new Map<number, string[]>();
  const tagsMap = new Map<number, string[]>();
  const useCasesMap = new Map<number, string[]>();
  const attributesMap = new Map<number, Record<string, string>>();
  
  // Group multi-record results
  allImages.forEach(img => {
    if (!imagesMap.has(img.productId)) imagesMap.set(img.productId, []);
    imagesMap.get(img.productId)!.push(img.imageUrl);
  });
  
  allTags.forEach(tag => {
    if (!tagsMap.has(tag.productId)) tagsMap.set(tag.productId, []);
    tagsMap.get(tag.productId)!.push(tag.value);
  });
  
  allUseCases.forEach(uc => {
    if (!useCasesMap.has(uc.productId)) useCasesMap.set(uc.productId, []);
    useCasesMap.get(uc.productId)!.push(uc.value);
  });
  
  allAttributes.forEach(attr => {
    if (!attributesMap.has(attr.productId)) attributesMap.set(attr.productId, {});
    attributesMap.get(attr.productId)![attr.key] = attr.value;
  });
  
  const mapBuildTime = Date.now();
  console.log(`🔄 hydrateProductsBatch: Map building took ${mapBuildTime - batchQueryTime}ms`);
  
  // Build final products using the maps
  const result = productRecords.map((product): Product => {
    const price = pricesMap.get(product.id);
    const salePrice = salePricesMap.get(product.id);
    const inventory = inventoryMap.get(product.id);
    const images = imagesMap.get(product.id) || [];
    const tags = tagsMap.get(product.id) || [];
    const useCases = useCasesMap.get(product.id) || [];
    const attributes = attributesMap.get(product.id) || {};
    
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription ?? "",
      longDescription: product.longDescription ?? "",
      primaryImageUrl: product.primaryImageUrl,
      images,
      price: price?.price ?? 0,
      active: product.active ?? false,
      salePrice: salePrice?.sale_price ?? 0,
      onSale: !!product.onSale,
      quantityInStock: inventory?.quantityInStock ?? 0,
      availability: product.availability === "available" ? "available" : "coming_soon",
      tags,
      useCases,
      attributes,
      aiNotes: product.aiNotes ?? "",
    };
  });
  
  const totalTime = Date.now() - startTime;
  console.log(`🔄 hydrateProductsBatch: Completed ${productRecords.length} products in ${totalTime}ms (avg: ${(totalTime/productRecords.length).toFixed(1)}ms per product)`);
  
  return result;
}
