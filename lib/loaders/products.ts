/**
 * Product Loaders - App-level product data fetching
 * 
 * These functions provide app-specific product data loading functionality
 * built on top of the MACH Alliance compliant product models.
 */

import { listProducts, getProduct, getProductBySlug } from '@/lib/models/mach/products';
import type { Product } from '@/lib/types';

/**
 * Get products by category slug
 * This is a placeholder implementation - in a full implementation,
 * you would have product-category relationships in your database
 */
export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  // For now, return all active products
  // In a real implementation, you'd join with a category relationship table
  const allProducts = await listProducts({ status: ['active'], limit: 50 });
  
  // Simple filtering by category slug for demo purposes
  // In production, this would be a proper database join
  if (categorySlug === 'featured') {
    // Return first 3 products as "featured"
    return allProducts.slice(0, 3);
  }
  
  return allProducts;
}

/**
 * Get a single product by its slug
 */
export async function getProductBySlugLoader(slug: string): Promise<Product | null> {
  return await getProductBySlug(slug);
}

/**
 * Get a single product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  return await getProduct(id);
}

/**
 * Get all products with optional filtering
 */
export async function getAllProducts(options?: {
  limit?: number;
  status?: ('active' | 'inactive' | 'archived' | 'draft')[];
}): Promise<Product[]> {
  return await listProducts(options);
}