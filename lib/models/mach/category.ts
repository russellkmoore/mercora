/**
 * MACH Alliance Open Data Model - Category Model
 * 
 * Business logic and CRUD operations for category management
 * following the MACH Alliance Category specification.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/product/category.md
 */

import { getDbAsync } from "@/lib/db";
import { categories, deserializeCategory, serializeCategory } from "@/lib/db/schema/category";
import { eq, desc, asc, like, or, and, inArray, isNull, isNotNull, sql } from "drizzle-orm";

// Helper function to get database instance (consistent pattern)
async function getDb() {
  return await getDbAsync();
}
import type { Media, Category, CategoryReference } from "@/lib/types";

// Category creation input type
export interface CreateCategoryInput {
  // Required fields
  id: string; // Unique identifier for the category
  name: string | Record<string, string>; // Display name (localizable)
  
  // Optional display information
  description?: string | Record<string, string>; // Detailed description (localizable)
  slug?: string | Record<string, string>; // URL-friendly identifier (localizable)
  
  // Status and hierarchy
  status?: "active" | "inactive" | "archived";
  parent_id?: string; // Parent category identifier
  position?: number; // Sort order within parent
  path?: string; // Full category path for breadcrumbs
  
  // External references
  external_references?: Record<string, string>; // Cross-system IDs
  
  // Hierarchy and products
  children?: CategoryReference[]; // Child category references
  product_count?: number; // Number of products in category
  
  // Metadata and classification
  attributes?: Record<string, any>; // Additional metadata
  tags?: string[]; // Tags for filtering and search
  
  // Media assets
  primary_image?: Media; // Primary category image
  media?: Media[]; // Additional images and assets
  
  // SEO
  seo?: {
    meta_title?: string | Record<string, string>;
    meta_description?: string | Record<string, string>;
    meta_keywords?: string[];
    canonical_url?: string;
  };
  
  // Extensions
  extensions?: Record<string, any>;
}

// Category update input type
export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  id: string;
}

// Category filter options
export interface CategoryFilters {
  status?: "active" | "inactive" | "archived" | ("active" | "inactive" | "archived")[];
  parent_id?: string | null; // null for root categories
  has_children?: boolean; // Filter categories with/without children
  has_products?: boolean; // Filter categories with/without products
  tags?: string | string[]; // Filter by tags
  path?: string; // Filter by path (useful for breadcrumbs)
  search?: string; // General text search across name and description
  product_count_min?: number; // Minimum product count
  product_count_max?: number; // Maximum product count
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'position' | 'product_count' | 'path';
  sortOrder?: 'asc' | 'desc';
  include_inactive?: boolean; // Include inactive categories
}

// Category tree options
export interface CategoryTreeOptions {
  max_depth?: number; // Maximum depth to retrieve
  include_product_counts?: boolean; // Include product counts in tree
  include_media?: boolean; // Include media objects in tree
  status_filter?: ("active" | "inactive" | "archived")[]; // Filter by status
}

// Category validation result
export interface CategoryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: Partial<Category>;
}

/**
 * Generate a unique category ID
 */
function generateCategoryId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string | Record<string, string>): string {
  const nameStr = typeof name === 'string' ? name : Object.values(name)[0];
  return nameStr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate category path from parent hierarchy
 */
async function generateCategoryPath(parentId?: string, slug?: string | Record<string, string>): Promise<string> {
  const slugStr = typeof slug === 'string' ? slug : (slug ? Object.values(slug)[0] : '');
  
  if (!parentId || !slugStr) {
    return slugStr ? `/${slugStr}` : '';
  }
  
  const parent = await getCategory(parentId);
  if (!parent) {
    return slugStr ? `/${slugStr}` : '';
  }
  
  const parentPath = parent.path || '';
  return `${parentPath}/${slugStr}`;
}

/**
 * Validate category data according to MACH Alliance standards
 */
export function validateCategory(category: Partial<Category>): CategoryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!category.id) {
    errors.push("id is required");
  }
  
  if (!category.name || (typeof category.name === 'object' && Object.keys(category.name).length === 0)) {
    errors.push("name is required");
  }
  
  // Slug validation (if provided)
  if (category.slug) {
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const slugToValidate = typeof category.slug === 'string' ? category.slug : Object.values(category.slug)[0];
    if (slugToValidate && !slugPattern.test(slugToValidate)) {
      errors.push("slug must contain only lowercase letters, numbers, and hyphens");
    }
  } else if (category.name) {
    warnings.push("slug is recommended for better SEO and URL structure");
  }
  
  // Position validation
  if (category.position !== undefined && category.position < 1) {
    errors.push("position must be a positive integer");
  }
  
  // Product count validation
  if (category.product_count !== undefined && category.product_count < 0) {
    errors.push("product_count must be non-negative");
  }
  
  // SEO validation
  if (category.seo) {
    if (category.seo.meta_keywords && category.seo.meta_keywords.length === 0) {
      warnings.push("meta_keywords array should not be empty");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a new category
 */
export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const id = input.id || generateCategoryId();
  const now = new Date().toISOString();
  
  // Generate slug if not provided
  const slug = input.slug || generateSlug(input.name);
  
  // Generate path
  const path = await generateCategoryPath(input.parent_id, slug);
  
  const machCategory: Category = {
    id,
    name: input.name,
    description: input.description,
    slug,
    status: input.status ?? "active",
    parent_id: input.parent_id,
    position: input.position,
    path,
    external_references: input.external_references,
    created_at: now,
    updated_at: now,
    children: input.children,
    product_count: input.product_count ?? 0,
    attributes: input.attributes,
    tags: input.tags,
    primary_image: input.primary_image,
    media: input.media,
    seo: input.seo,
    extensions: input.extensions,
  };
  
  // Validate before creating
  const validation = validateCategory(machCategory);
  if (!validation.isValid) {
    throw new Error(`Category validation failed: ${validation.errors.join(', ')}`);
  }
  
    const record = serializeCategory(machCategory);
  const [created] = await (await getDb()).insert(categories).values(record).returning();
  return deserializeCategory(created);
}

/**
 * Get a category by ID
 */
export async function getCategory(id: string): Promise<Category | null> {
    
  const [record] = await (await getDb())
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
    
  if (!record) return null;
  return deserializeCategory(record);
}

/**
 * Get a category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
    
  const [record] = await (await getDb())
    .select()
    .from(categories)
    .where(like(categories.slug, `%"${slug}"%`))
    .limit(1);
    
  if (!record) return null;
  return deserializeCategory(record);
}

/**
 * Get category by path
 */
export async function getCategoryByPath(path: string): Promise<Category | null> {
    
  const [record] = await (await getDb())
    .select()
    .from(categories)
    .where(eq(categories.path, path))
    .limit(1);
    
  if (!record) return null;
  return deserializeCategory(record);
}

/**
 * List categories with filtering and pagination
 */
export async function listCategories(filters: CategoryFilters = {}): Promise<Category[]> {
    
  let query = (await getDb()).select().from(categories);
  
  // Build where conditions
  const conditions: any[] = [];
  
  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(categories.status, filters.status));
    } else {
      conditions.push(eq(categories.status, filters.status));
    }
  } else if (!filters.include_inactive) {
    // Default: only show active categories
    conditions.push(eq(categories.status, "active"));
  }
  
  // Parent filter
  if (filters.parent_id !== undefined) {
    if (filters.parent_id === null) {
      conditions.push(isNull(categories.parentId));
    } else {
      conditions.push(eq(categories.parentId, filters.parent_id));
    }
  }
  
  // Children filter
  if (filters.has_children !== undefined) {
    if (filters.has_children) {
      conditions.push(isNotNull(categories.children));
    } else {
      conditions.push(isNull(categories.children));
    }
  }
  
  // Products filter
  if (filters.has_products !== undefined) {
    if (filters.has_products) {
      conditions.push(sql`${categories.productCount} > 0`);
    } else {
      conditions.push(or(
        eq(categories.productCount, 0),
        isNull(categories.productCount)
      ));
    }
  }
  
  // Product count range
  if (filters.product_count_min !== undefined) {
    conditions.push(sql`${categories.productCount} >= ${filters.product_count_min}`);
  }
  if (filters.product_count_max !== undefined) {
    conditions.push(sql`${categories.productCount} <= ${filters.product_count_max}`);
  }
  
  // Tags filter
  if (filters.tags) {
    if (Array.isArray(filters.tags)) {
      const tagConditions = filters.tags.map(tag => 
        like(categories.tags, `%"${tag}"%`)
      );
      conditions.push(or(...tagConditions));
    } else {
      conditions.push(like(categories.tags, `%"${filters.tags}"%`));
    }
  }
  
  // Path filter
  if (filters.path) {
    conditions.push(like(categories.path, `${filters.path}%`));
  }
  
  // Search filter
  if (filters.search) {
    conditions.push(
      or(
        like(categories.name, `%${filters.search}%`),
        like(categories.description, `%${filters.search}%`),
        like(categories.slug, `%${filters.search}%`),
        like(categories.path, `%${filters.search}%`),
        like(categories.tags, `%${filters.search}%`)
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  // Add sorting
  const sortField = filters.sortBy || 'position';
  const sortDir = filters.sortOrder || 'asc';
  
  switch (sortField) {
    case 'name':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.name) : desc(categories.name)) as typeof query;
      break;
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.createdAt) : desc(categories.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.updatedAt) : desc(categories.updatedAt)) as typeof query;
      break;
    case 'position':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.position) : desc(categories.position)) as typeof query;
      break;
    case 'product_count':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.productCount) : desc(categories.productCount)) as typeof query;
      break;
    case 'path':
      query = query.orderBy(sortDir === 'asc' ? asc(categories.path) : desc(categories.path)) as typeof query;
      break;
    default:
      query = query.orderBy(asc(categories.position)) as typeof query;
  }
  
  // Add pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }
  
  const records = await query;
  return records.map(deserializeCategory);
}

/**
 * Get categories count with filters
 */
export async function getCategoriesCount(filters: Omit<CategoryFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
  const categories = await listCategories(filters);
  return categories.length;
}

/**
 * Get root categories (categories without parent)
 */
export async function getRootCategories(): Promise<Category[]> {
  return listCategories({ parent_id: null });
}

/**
 * Get child categories of a parent
 */
export async function getChildCategories(parentId: string): Promise<Category[]> {
  return listCategories({ parent_id: parentId });
}

/**
 * Get category hierarchy tree
 */
export async function getCategoryTree(options: CategoryTreeOptions = {}): Promise<Category[]> {
  const { max_depth = 10, status_filter = ["active"] } = options;
  
  async function buildTree(parentId: string | null = null, currentDepth = 0): Promise<Category[]> {
    if (currentDepth >= max_depth) return [];
    
    const categories = await listCategories({ 
      parent_id: parentId, 
      status: status_filter,
      sortBy: 'position',
      sortOrder: 'asc'
    });
    
    // Recursively build children
    for (const category of categories) {
      const children = await buildTree(category.id, currentDepth + 1);
      if (children.length > 0) {
        category.children = children.map(child => ({
          id: child.id,
          name: child.name,
          slug: typeof child.slug === 'string' ? child.slug : Object.values(child.slug || {})[0] || '',
          parent_id: child.parent_id,
          position: child.position,
          product_count: child.product_count
        }));
      }
    }
    
    return categories;
  }
  
  return buildTree();
}

/**
 * Get category breadcrumbs (path to root)
 */
export async function getCategoryBreadcrumbs(categoryId: string): Promise<Category[]> {
  const breadcrumbs: Category[] = [];
  let currentId: string | undefined = categoryId;
  
  while (currentId) {
    const category = await getCategory(currentId);
    if (!category) break;
    
    breadcrumbs.unshift(category);
    currentId = category.parent_id;
  }
  
  return breadcrumbs;
}

/**
 * Update an existing category
 */
export async function updateCategory(id: string, input: Partial<CreateCategoryInput>): Promise<Category | null> {
    
  // Get existing category first
  const existing = await getCategory(id);
  if (!existing) return null;
  
  // Handle slug and path updates
  let newSlug = input.slug || existing.slug;
  let newPath = existing.path;
  
  if (input.slug || input.parent_id !== undefined) {
    const parentIdForPath = input.parent_id !== undefined ? input.parent_id : existing.parent_id;
    const slugForPath = typeof newSlug === 'string' ? newSlug : (newSlug ? Object.values(newSlug)[0] : '');
    newPath = await generateCategoryPath(parentIdForPath, slugForPath);
  }
  
  // Create updated category object
  const updated: Category = {
    ...existing,
    ...input,
    id, // Ensure ID stays the same
    slug: newSlug,
    path: newPath,
    updated_at: new Date().toISOString(),
  };
  
  // Validate before updating
  const validation = validateCategory(updated);
  if (!validation.isValid) {
    throw new Error(`Category validation failed: ${validation.errors.join(', ')}`);
  }
  
  const record = serializeCategory(updated);
  await (await getDb()).update(categories).set(record).where(eq(categories.id, id));
  
  return getCategory(id);
}

/**
 * Delete a category (soft delete by setting status to archived)
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const result = await updateCategory(id, { status: "archived" });
  return !!result;
}

/**
 * Hard delete a category (permanent removal)
 */
export async function hardDeleteCategory(id: string): Promise<boolean> {
    
  await (await getDb()).delete(categories).where(eq(categories.id, id));
  return true;
}

/**
 * Move category to different parent
 */
export async function moveCategoryToParent(categoryId: string, newParentId: string | null, position?: number): Promise<Category | null> {
  return updateCategory(categoryId, { 
    parent_id: newParentId || undefined, 
    position: position 
  });
}

/**
 * Update category product count
 */
export async function updateCategoryProductCount(categoryId: string, count: number): Promise<Category | null> {
  return updateCategory(categoryId, { product_count: count });
}

/**
 * Get categories by status
 */
export async function getCategoriesByStatus(status: "active" | "inactive" | "archived"): Promise<Category[]> {
  return listCategories({ status });
}

/**
 * Search categories by text
 */
export async function searchCategories(searchTerm: string, limit?: number): Promise<Category[]> {
  return listCategories({ 
    search: searchTerm, 
    limit: limit || 50 
  });
}

/**
 * Get categories by tags
 */
export async function getCategoriesByTags(tags: string | string[]): Promise<Category[]> {
  return listCategories({ tags });
}

/**
 * Get categories with products
 */
export async function getCategoriesWithProducts(): Promise<Category[]> {
  return listCategories({ has_products: true });
}

/**
 * Get empty categories (no products)
 */
export async function getEmptyCategories(): Promise<Category[]> {
  return listCategories({ has_products: false });
}

/**
 * Format category name for display (handle localization)
 */
export function getCategoryDisplayName(category: Category, locale = 'en'): string {
  if (typeof category.name === 'string') {
    return category.name;
  }
  
  // Try locale, then first available language
  return category.name[locale] || Object.values(category.name)[0] || '';
}

/**
 * Format category description for display (handle localization)
 */
export function getCategoryDescription(category: Category, locale = 'en'): string {
  if (!category.description) return '';
  
  if (typeof category.description === 'string') {
    return category.description;
  }
  
  // Try locale, then first available language
  return category.description[locale] || Object.values(category.description)[0] || '';
}

/**
 * Get category URL slug (handle localization)
 */
export function getCategorySlug(category: Category, locale = 'en'): string {
  if (!category.slug) return '';
  
  if (typeof category.slug === 'string') {
    return category.slug;
  }
  
  // Try locale, then first available language
  return category.slug[locale] || Object.values(category.slug)[0] || '';
}
