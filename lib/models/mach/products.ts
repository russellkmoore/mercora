
/**
 * Get a product by its slug (MACH-compliant)
 * @param slug - The URL-friendly product identifier
 * @returns Promise<Product | null>
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = getDb();
  // Some products may have slug as a string or as a localized object; handle both
  const results = await db.select().from(products);
  const match = results.find((p: any) => {
    if (!p.slug) return false;
    if (typeof p.slug === 'string') return p.slug === slug;
    if (typeof p.slug === 'object' && p.slug !== null) {
      return Object.values(p.slug).includes(slug);
    }
    return false;
  });
  return match ? (match as Product) : null;
}
/**
 * MACH Alliance Product Entity - Business Model
 * Core business logic for Product and ProductVariant management
 */

import { eq, and, like, inArray } from 'drizzle-orm';
import type {Product, ProductVariant, Money } from '@/lib/types/';
import { products, product_variants } from '../../db/schema/products.js';
import { validateProduct, validateProductVariant, transformProductForDB, transformVariantForDB } from '../../db/schema/products.js';
import { getDb } from '../../db.js';

/**
 * Core Product CRUD Operations
 */

export async function createProduct(productData: Product): Promise<Product> {
  if (!validateProduct(productData)) {
    throw new Error('Invalid product data provided');
  }

  const db = getDb();
  const product = transformProductForDB(productData);
  
  await db.insert(products).values(product);
  return product;
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDb();
  const result = await db.select().from(products).where(eq(products.id, id));
  return result[0] as Product || null;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const db = getDb();
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  await db.update(products).set(updateData).where(eq(products.id, id));
  return getProduct(id);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(products).where(eq(products.id, id));
  return result.meta.changes > 0;
}

export async function listProducts(options: {
  status?: ('active' | 'inactive' | 'archived' | 'draft')[];
  type?: string;
  brand?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Product[]> {
  const db = getDb();
  const results = await db.select().from(products);
  let filteredResults = results;
  
  // Apply filters in memory
  if (options.status?.length) {
    filteredResults = filteredResults.filter(p => 
      options.status!.includes(p.status as any)
    );
  }
  
  if (options.type) {
    filteredResults = filteredResults.filter(p => p.type === options.type);
  }
  
  if (options.brand) {
    filteredResults = filteredResults.filter(p => p.brand === options.brand);
  }
  
  if (options.offset) {
    filteredResults = filteredResults.slice(options.offset);
  }
  
  if (options.limit) {
    filteredResults = filteredResults.slice(0, options.limit);
  }
  
  return filteredResults as Product[];
}

/**
 * Product Variant Operations
 */

export async function createProductVariant(variantData: ProductVariant): Promise<ProductVariant> {
  if (!validateProductVariant(variantData)) {
    throw new Error('Invalid product variant data provided');
  }
  
  if (!variantData.product_id) {
    throw new Error('Product ID is required for variant creation');
  }

  const db = getDb();
  const variant = transformVariantForDB(variantData);
  
  await db.insert(product_variants).values({
    ...variant,
    product_id: variant.product_id!
  });
  
  return variant;
}

export async function getProductVariant(id: string): Promise<ProductVariant | null> {
  const db = getDb();
  const result = await db.select().from(product_variants).where(eq(product_variants.id, id));
  return result[0] as ProductVariant || null;
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const db = getDb();
  const results = await db.select()
    .from(product_variants)
    .where(eq(product_variants.product_id, productId));
  return results as ProductVariant[];
}

export async function getVariantBySKU(sku: string): Promise<ProductVariant | null> {
  const db = getDb();
  const result = await db.select().from(product_variants).where(eq(product_variants.sku, sku));
  return result[0] as ProductVariant || null;
}

export async function updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | null> {
  const db = getDb();
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  await db.update(product_variants).set(updateData).where(eq(product_variants.id, id));
  return getProductVariant(id);
}

export async function deleteProductVariant(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(product_variants).where(eq(product_variants.id, id));
  return result.meta.changes > 0;
}

/**
 * Product Search Operations
 */

export async function searchProducts(searchTerm: string): Promise<Product[]> {
  const db = getDb();
  const results = await db.select()
    .from(products)
    .where(like(products.name, `%${searchTerm}%`));
  return results as Product[];
}

export async function getProductsByBrand(brand: string): Promise<Product[]> {
  const db = getDb();
  const results = await db.select()
    .from(products)
    .where(eq(products.brand, brand));
  return results as Product[];
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const db = getDb();
  const results = await db.select().from(products);
  
  // Filter products that have the category in their categories array
  const filteredResults = results.filter(product => {
    if (!product.categories) return false;
    return product.categories.includes(categorySlug);
  });
  
  return filteredResults as Product[];
}

export async function getActiveProducts(): Promise<Product[]> {
  const db = getDb();
  const results = await db.select()
    .from(products)
    .where(eq(products.status, 'active'));
  return results as Product[];
}

/**
 * Variant Selection Operations
 */

export async function getVariantByOptions(
  productId: string,
  selectedOptions: Record<string, string>
): Promise<ProductVariant | null> {
  const variants = await getProductVariants(productId);
  
  return variants.find(variant => {
    return variant.option_values.every(ov => 
      selectedOptions[ov.option_id] === ov.value
    );
  }) || null;
}

export async function getAvailableVariants(productId: string): Promise<ProductVariant[]> {
  const db = getDb();
  const results = await db.select()
    .from(product_variants)
    .where(and(
      eq(product_variants.product_id, productId),
      eq(product_variants.status, 'active')
    ));
  return results as ProductVariant[];
}

/**
 * Product Analytics
 */

export async function getProductStats(productId: string) {
  const product = await getProduct(productId);
  if (!product) return null;

  const variants = await getProductVariants(productId);
  const activeVariants = variants.filter(v => v.status === 'active');
  
  // Calculate price range
  const prices = variants.map(v => v.price.amount);
  const priceRange = prices.length > 0 ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
    currency: variants[0]?.price.currency || 'USD'
  } : null;

  return {
    product,
    totalVariants: variants.length,
    activeVariants: activeVariants.length,
    priceRange,
    hasMultipleOptions: (product.options?.length || 0) > 1,
    fulfillmentType: product.fulfillment_type
  };
}

/**
 * Bulk Operations
 */

export async function bulkUpdateProductStatus(
  productIds: string[],
  status: 'active' | 'inactive' | 'archived' | 'draft'
): Promise<number> {
  const db = getDb();
  const result = await db.update(products)
    .set({ 
      status,
      updated_at: new Date().toISOString()
    })
    .where(inArray(products.id, productIds));
  
  return result.meta.changes;
}

export async function bulkUpdateVariantPrices(
  updates: { id: string; price: Money }[]
): Promise<number> {
  const db = getDb();
  let totalUpdated = 0;
  
  for (const update of updates) {
    const result = await db.update(product_variants)
      .set({ 
        price: update.price,
        updated_at: new Date().toISOString()
      })
      .where(eq(product_variants.id, update.id));
    
    totalUpdated += result.meta.changes;
  }
  
  return totalUpdated;
}

/**
 * Product Relationships
 */

export async function addRelatedProduct(productId: string, relatedProductId: string): Promise<boolean> {
  const product = await getProduct(productId);
  if (!product) return false;

  const relatedProducts = product.related_products || [];
  if (relatedProducts.includes(relatedProductId)) return true;

  relatedProducts.push(relatedProductId);
  
  await updateProduct(productId, { related_products: relatedProducts });
  return true;
}

export async function removeRelatedProduct(productId: string, relatedProductId: string): Promise<boolean> {
  const product = await getProduct(productId);
  if (!product) return false;

  const relatedProducts = (product.related_products || []).filter(id => id !== relatedProductId);
  
  await updateProduct(productId, { related_products: relatedProducts });
  return true;
}

export async function getRelatedProducts(productId: string): Promise<Product[]> {
  const db = getDb();
  const product = await getProduct(productId);
  if (!product || !product.related_products) return [];

  const results = await db.select()
    .from(products)
    .where(inArray(products.id, product.related_products));
  return results as Product[];
}

/**
 * Utility Functions
 */

export async function getProductWithVariants(productId: string): Promise<{
  product: Product;
  variants: ProductVariant[];
} | null> {
  const product = await getProduct(productId);
  if (!product) return null;

  const variants = await getProductVariants(productId);
  
  return { product, variants };
}

export async function duplicateProduct(
  productId: string,
  newId: string,
  modifications: Partial<Product> = {}
): Promise<Product | null> {
  const original = await getProduct(productId);
  if (!original) return null;

  const duplicateData: Product = {
    ...original,
    id: newId,
    ...modifications,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return await createProduct(duplicateData);
}

/**
 * Helper to get the effective price (lowest sale or regular) for a product
 * Returns the price of the default variant, or the first variant if not set
 */
export function getEffectivePrice(product: Product): number {
  const variant = product.variants?.find((v) => v.id === product.default_variant_id) || product.variants?.[0];
  return variant?.price?.amount ?? Number.POSITIVE_INFINITY;
}