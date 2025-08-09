/**
 * MACH-compliant Categories Loader
 * 
 * Uses the new MACH category model for all category operations.
 * Provides clean interfaces for category loading and management.
 */

import type { Category } from "@/lib/types";
import { 
  listCategories, 
  getCategoryByPath as getMACHCategoryByPath, 
  getCategoryTree,
  getCategoriesByParent,
  getCategoryHierarchy 
} from "../models/mach/categories";

/**
 * Get all categories with optional filtering
 */
export async function getCategories(filters?: {
  status?: 'active' | 'inactive';
  parentId?: string;
  limit?: number;
}): Promise<Category[]> {
  return await listCategories({
    status: filters?.status || 'active',
    parentId: filters?.parentId,
    limit: filters?.limit,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  });
}

/**
 * Get category by path (replaces getCategoryBySlug)
 */
export async function getCategoryByPath(path: string): Promise<Category | null> {
  return await getMACHCategoryByPath(path);
}

/**
 * Get root categories (top-level categories with no parent)
 */
export async function getRootCategories(): Promise<Category[]> {
  return await getCategoriesByParent(); // undefined parentId = root categories
}

/**
 * Get category tree structure
 */
export async function getCategoryTreeStructure(parentId?: string) {
  return await getCategoryTree(parentId);
}

/**
 * Get category breadcrumbs
 */
export async function getCategoryBreadcrumbs(categoryId: string): Promise<Category[]> {
  return await getCategoryHierarchy(categoryId);
}
