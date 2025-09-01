/**
 * Pages Data Access Layer - Content Management System
 * 
 * Provides database operations for managing pages, page versions, and templates.
 * Integrates with the existing Cloudflare D1/Drizzle ORM architecture.
 */

import { desc, eq, and, or, isNull, count, like, inArray } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { 
  pages, 
  page_versions, 
  page_templates,
  PageSelect,
  PageInsert,
  PageVersionSelect,
  PageVersionInsert,
  PageTemplateSelect,
  PageTemplateInsert,
  PAGE_STATUS,
  PageStatus,
  generatePageSlug,
  isPagePublished,
  getPageUrl
} from "@/lib/db/schema/pages";

/**
 * Get all pages with optional filtering
 */
export async function getPages(options: {
  status?: PageStatus | PageStatus[];
  includeProtected?: boolean;
  includeNavOnly?: boolean;
  limit?: number;
  offset?: number;
  searchTerm?: string;
} = {}): Promise<PageSelect[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(pages);
  let conditions: any[] = [];
  
  // Filter by status
  if (options.status) {
    if (Array.isArray(options.status)) {
      conditions.push(inArray(pages.status, options.status));
    } else {
      conditions.push(eq(pages.status, options.status));
    }
  }
  
  // Filter protected pages
  if (!options.includeProtected) {
    conditions.push(eq(pages.is_protected, false));
  }
  
  // Filter navigation pages only
  if (options.includeNavOnly) {
    conditions.push(eq(pages.show_in_nav, true));
  }
  
  // Search filter
  if (options.searchTerm) {
    conditions.push(
      or(
        like(pages.title, `%${options.searchTerm}%`),
        like(pages.content, `%${options.searchTerm}%`),
        like(pages.meta_description, `%${options.searchTerm}%`)
      )
    );
  }
  
  // Apply conditions
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  // Apply ordering
  query = query.orderBy(pages.sort_order, pages.title) as any;
  
  // Apply pagination
  if (options.limit) {
    query = query.limit(options.limit) as any;
  }
  if (options.offset) {
    query = query.offset(options.offset) as any;
  }
  
  return query;
}

/**
 * Get published pages for public display
 */
export async function getPublishedPages(): Promise<PageSelect[]> {
  return getPages({ 
    status: PAGE_STATUS.PUBLISHED, 
    includeProtected: false 
  });
}

/**
 * Get navigation pages
 */
export async function getNavigationPages(): Promise<PageSelect[]> {
  return getPages({ 
    status: PAGE_STATUS.PUBLISHED, 
    includeNavOnly: true,
    includeProtected: false 
  });
}

/**
 * Get page by ID
 */
export async function getPageById(id: number): Promise<PageSelect | null> {
  const db = await getDbAsync();
  
  const result = await db.select()
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get page by slug
 */
export async function getPageBySlug(slug: string, includeUnpublished = false): Promise<PageSelect | null> {
  const db = await getDbAsync();
  
  let query = db.select()
    .from(pages)
    .where(eq(pages.slug, slug));
  
  if (!includeUnpublished) {
    query = (query as any).where(and(
      eq(pages.slug, slug),
      eq(pages.status, PAGE_STATUS.PUBLISHED)
    ));
  }
  
  const result = await query.limit(1);
  return result[0] || null;
}

/**
 * Create a new page
 */
export async function createPage(data: Omit<PageInsert, 'id' | 'created_at' | 'updated_at'>): Promise<PageSelect> {
  const db = await getDbAsync();
  
  // Validate required fields for creation
  if (!data.title || data.title.trim().length === 0) {
    throw new Error("Title is required");
  }
  if (!data.content || data.content.trim().length === 0) {
    throw new Error("Content is required");
  }
  
  // Validate data
  const validation = validatePageData(data);
  if (!validation.valid) {
    throw new Error(`Invalid page data: ${validation.errors.join(', ')}`);
  }

  // Generate slug if not provided
  if (!data.slug && data.title) {
    const existingSlugs = await getExistingSlugs();
    data.slug = generatePageSlug(data.title, existingSlugs);
  }
  
  // Set timestamps
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const pageData: PageInsert = {
    ...data,
    created_at: now,
    updated_at: now,
    version: 1
  };
  
  // Insert page
  const result = await db.insert(pages).values(pageData).returning();
  const newPage = result[0];
  
  // Create initial version
  if (newPage) {
    await createPageVersion(newPage.id, {
      title: newPage.title,
      content: newPage.content,
      excerpt: newPage.excerpt,
      meta_title: newPage.meta_title,
      meta_description: newPage.meta_description,
      meta_keywords: newPage.meta_keywords,
      version: 1,
      change_summary: "Initial version",
      created_by: newPage.created_by || "system"
    });
  }
  
  return newPage;
}

/**
 * Update an existing page
 */
export async function updatePage(
  id: number, 
  data: Partial<PageInsert>,
  userId?: string,
  changeSummary?: string
): Promise<PageSelect | null> {
  try {
    console.log(`Updating page ${id} with data:`, data);
    
    // Convert any Date objects in the incoming data to timestamps
    const cleanData = { ...data };
    Object.keys(cleanData).forEach(key => {
      const value = (cleanData as any)[key];
      if (value && Object.prototype.toString.call(value) === '[object Date]') {
        console.log(`Converting Date object for field ${key}:`, value);
        (cleanData as any)[key] = Math.floor(value.getTime() / 1000);
      }
    });
    console.log('Cleaned data:', cleanData);
    
    const db = await getDbAsync();
    
    // Get current page
    const currentPage = await getPageById(id);
    if (!currentPage) {
      throw new Error("Page not found");
    }
    console.log('Current page found:', currentPage.title);
    
    // Validate data
    const validation = validatePageData(cleanData);
    if (!validation.valid) {
      console.error('Validation failed:', validation.errors);
      throw new Error(`Invalid page data: ${validation.errors.join(', ')}`);
    }
    console.log('Data validation passed');
    
    // Generate new slug if title changed
    if (cleanData.title && cleanData.title !== currentPage.title && !cleanData.slug) {
      console.log('Generating new slug for title:', cleanData.title);
      const existingSlugs = await getExistingSlugs();
      cleanData.slug = generatePageSlug(cleanData.title, existingSlugs);
      console.log('Generated slug:', cleanData.slug);
    }
    
    // Increment version if content changed
    const contentChanged = cleanData.content && cleanData.content !== currentPage.content;
    const newVersion = contentChanged ? currentPage.version + 1 : currentPage.version;
    console.log('Version handling - contentChanged:', contentChanged, 'newVersion:', newVersion);
    console.log('Current page data types:', Object.entries(currentPage).map(([k, v]) => `${k}: ${typeof v}`).join(', '));
    
    // Update page
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const updateData: Partial<PageInsert> = {
      ...cleanData,
      updated_at: now,
      updated_by: userId,
      version: newVersion
    };
    
    console.log('About to update with data:', updateData);
    
    // Deep inspection of updateData for any Date objects
    Object.entries(updateData).forEach(([key, value]) => {
      console.log(`Field ${key}:`, typeof value, value);
      if (value && Object.prototype.toString.call(value) === '[object Date]') {
        console.error(`FOUND DATE OBJECT in field ${key}:`, value);
      }
    });
    
    let result;
    try {
      result = await db.update(pages)
        .set(updateData)
        .where(eq(pages.id, id))
        .returning();
      console.log('Database update completed, rows affected:', result.length);
    } catch (dbError) {
      console.error('Database update failed:', dbError);
      throw dbError;
    }
  
    const updatedPage = result[0];
  
  // Create new version if content changed
  if (contentChanged && updatedPage) {
    console.log('Creating page version with data types:', Object.entries(updatedPage).map(([k, v]) => `${k}: ${typeof v}`).join(', '));
    await createPageVersion(id, {
      title: updatedPage.title,
      content: updatedPage.content,
      excerpt: updatedPage.excerpt,
      meta_title: updatedPage.meta_title,
      meta_description: updatedPage.meta_description,
      meta_keywords: updatedPage.meta_keywords,
      version: newVersion,
      change_summary: changeSummary || "Content updated",
      created_by: userId || "system"
    });
  }
  
    console.log('Page updated successfully');
    return updatedPage;
  } catch (error) {
    console.error('Error in updatePage:', error);
    throw error;
  }
}

/**
 * Delete a page and all its versions
 */
export async function deletePage(id: number): Promise<boolean> {
  const db = await getDbAsync();
  
  try {
    // Delete page versions first (cascade should handle this, but being explicit)
    await db.delete(page_versions).where(eq(page_versions.page_id, id));
    
    // Delete page
    const result = await db.delete(pages).where(eq(pages.id, id));
    
    return true;
  } catch (error) {
    console.error("Error deleting page:", error);
    return false;
  }
}

/**
 * Create a page version
 */
export async function createPageVersion(
  pageId: number, 
  data: Omit<PageVersionInsert, 'id' | 'page_id' | 'created_at'>
): Promise<PageVersionSelect> {
  const db = await getDbAsync();
  
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const versionData: PageVersionInsert = {
    ...data,
    page_id: pageId,
    created_at: now
  };
  
  const result = await db.insert(page_versions).values(versionData).returning();
  return result[0];
}

/**
 * Get page versions
 */
export async function getPageVersions(pageId: number): Promise<PageVersionSelect[]> {
  const db = await getDbAsync();
  
  return db.select()
    .from(page_versions)
    .where(eq(page_versions.page_id, pageId))
    .orderBy(desc(page_versions.version));
}

/**
 * Get specific page version
 */
export async function getPageVersion(pageId: number, version: number): Promise<PageVersionSelect | null> {
  const db = await getDbAsync();
  
  const result = await db.select()
    .from(page_versions)
    .where(and(
      eq(page_versions.page_id, pageId),
      eq(page_versions.version, version)
    ))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get page templates
 */
export async function getPageTemplates(activeOnly = true): Promise<PageTemplateSelect[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(page_templates);
  
  if (activeOnly) {
    query = (query as any).where(eq(page_templates.is_active, true));
  }
  
  return (query as any).orderBy(page_templates.display_name);
}

/**
 * Get page template by name
 */
export async function getPageTemplate(name: string): Promise<PageTemplateSelect | null> {
  const db = await getDbAsync();
  
  const result = await db.select()
    .from(page_templates)
    .where(eq(page_templates.name, name))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get page statistics
 */
export async function getPageStats(): Promise<{
  total: number;
  published: number;
  draft: number;
  archived: number;
}> {
  const db = await getDbAsync();
  
  const [totalResult] = await db.select({ count: count() }).from(pages);
  const [publishedResult] = await db.select({ count: count() })
    .from(pages)
    .where(eq(pages.status, PAGE_STATUS.PUBLISHED));
  const [draftResult] = await db.select({ count: count() })
    .from(pages)
    .where(eq(pages.status, PAGE_STATUS.DRAFT));
  const [archivedResult] = await db.select({ count: count() })
    .from(pages)
    .where(eq(pages.status, PAGE_STATUS.ARCHIVED));
  
  return {
    total: totalResult.count,
    published: publishedResult.count,
    draft: draftResult.count,
    archived: archivedResult.count
  };
}

/**
 * Validate page data
 */
export function validatePageData(data: Partial<PageInsert>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Title validation
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      errors.push("Title is required");
    } else if (data.title.length > 500) {
      errors.push("Title must be less than 500 characters");
    }
  }
  
  // Slug validation
  if (data.slug !== undefined) {
    if (!data.slug || data.slug.trim().length === 0) {
      errors.push("Slug is required");
    } else if (!/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push("Slug can only contain lowercase letters, numbers, and hyphens");
    }
  }
  
  // Content validation
  if (data.content !== undefined && data.content && data.content.length > 100000) {
    errors.push("Content must be less than 100,000 characters");
  }
  
  // Status validation
  if (data.status && !Object.values(PAGE_STATUS).includes(data.status as PageStatus)) {
    errors.push("Invalid status");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}


/**
 * Get existing slugs for uniqueness checking
 */
export async function getExistingSlugs(): Promise<string[]> {
  const db = await getDbAsync();
  
  const results = await db.select({ slug: pages.slug }).from(pages);
  return results.map(r => r.slug);
}

/**
 * Search pages
 */
export async function searchPages(
  searchTerm: string, 
  options: {
    includeUnpublished?: boolean;
    includeContent?: boolean;
    limit?: number;
  } = {}
): Promise<PageSelect[]> {
  return getPages({
    searchTerm,
    status: options.includeUnpublished ? undefined : PAGE_STATUS.PUBLISHED,
    limit: options.limit || 10
  });
}

/**
 * Publish a page
 */
export async function publishPage(id: number, userId?: string): Promise<PageSelect | null> {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  return updatePage(id, {
    status: PAGE_STATUS.PUBLISHED,
    published_at: now
  }, userId, "Page published");
}

/**
 * Unpublish a page
 */
export async function unpublishPage(id: number, userId?: string): Promise<PageSelect | null> {
  return updatePage(id, {
    status: PAGE_STATUS.DRAFT,
    published_at: null
  }, userId, "Page unpublished");
}

/**
 * Archive a page
 */
export async function archivePage(id: number, userId?: string): Promise<PageSelect | null> {
  return updatePage(id, {
    status: PAGE_STATUS.ARCHIVED
  }, userId, "Page archived");
}

/**
 * Export utility functions for use in other parts of the app
 */
export { 
  generatePageSlug,
  isPagePublished,
  getPageUrl,
  PAGE_STATUS
} from "@/lib/db/schema/pages";