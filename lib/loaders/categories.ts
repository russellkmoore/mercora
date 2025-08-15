/**
 * Category Loaders - App-level category data fetching
 * 
 * These functions provide app-specific category data loading functionality
 * built on top of the MACH Alliance compliant category models.
 */

import { 
  listCategories, 
  getCategory, 
  getCategoryBySlug,
  getCategoryTree,
  getCategoriesByStatus
} from '@/lib/models/mach/category';
import type { Category } from '@/lib/types';

/**
 * Get all categories
 */
export async function getCategories(): Promise<Category[]> {
  return await getCategoriesByStatus('active');
}

/**
 * Get category by slug
 */
export async function getCategoryBySlugLoader(slug: string): Promise<Category | null> {
  return await getCategoryBySlug(slug);
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  return await getCategory(id);
}

/**
 * Get category hierarchy/tree
 */
export async function getCategoryHierarchy(): Promise<Category[]> {
  return await getCategoryTree();
}