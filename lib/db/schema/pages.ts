/**
 * Pages Schema - Content Management System
 * 
 * Database schema for managing static content pages like privacy policy,
 * terms of service, about us, etc. Integrates with the existing admin system
 * and supports SEO optimization and content versioning.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Pages table for content management
 */
export const pages = sqliteTable("pages", {
  // Primary key
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  
  // Page identification
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  
  // Content
  content: text("content").notNull(), // Rich text content (HTML)
  excerpt: text("excerpt"), // Optional short description
  
  // SEO and metadata
  meta_title: text("meta_title"), // SEO title (defaults to title)
  meta_description: text("meta_description"), // SEO description
  meta_keywords: text("meta_keywords"), // SEO keywords
  
  // Publishing
  status: text("status").notNull().default("draft"), // draft, published, archived
  published_at: integer("published_at", { mode: "timestamp" }),
  
  // Content organization
  template: text("template").default("default"), // page template type
  parent_id: integer("parent_id"), // For hierarchical pages
  sort_order: integer("sort_order").default(0), // Display order
  
  // System fields
  created_at: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  created_by: text("created_by"), // User ID who created the page
  updated_by: text("updated_by"), // User ID who last updated the page
  
  // Version control
  version: integer("version").notNull().default(1),
  
  // Navigation and display
  show_in_nav: integer("show_in_nav", { mode: "boolean" }).default(false),
  nav_title: text("nav_title"), // Alternative title for navigation
  
  // Advanced features
  custom_css: text("custom_css"), // Page-specific styling
  custom_js: text("custom_js"), // Page-specific JavaScript
  
  // Access control
  is_protected: integer("is_protected", { mode: "boolean" }).default(false),
  required_roles: text("required_roles"), // JSON array of required roles
  
}, (table) => ({
  // Indexes for performance
  slugIdx: index("pages_slug_idx").on(table.slug),
  statusIdx: index("pages_status_idx").on(table.status),
  parentIdx: index("pages_parent_idx").on(table.parent_id),
  publishedIdx: index("pages_published_idx").on(table.published_at),
  navIdx: index("pages_nav_idx").on(table.show_in_nav),
}));

/**
 * Page versions table for content history
 */
export const page_versions = sqliteTable("page_versions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  page_id: integer("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  
  // Versioned content
  title: text("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  meta_title: text("meta_title"),
  meta_description: text("meta_description"),
  meta_keywords: text("meta_keywords"),
  
  // Version metadata
  version: integer("version").notNull(),
  change_summary: text("change_summary"), // Description of changes
  
  // System fields
  created_at: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  created_by: text("created_by").notNull(),
  
}, (table) => ({
  pageVersionIdx: index("page_versions_page_id_version_idx").on(table.page_id, table.version),
}));

/**
 * Page templates configuration
 */
export const page_templates = sqliteTable("page_templates", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  
  // Template identification
  name: text("name").notNull().unique(),
  display_name: text("display_name").notNull(),
  description: text("description"),
  
  // Template configuration
  fields: text("fields").notNull(), // JSON configuration of fields
  default_content: text("default_content"), // Default content for new pages
  
  // System fields
  created_at: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  is_active: integer("is_active", { mode: "boolean" }).default(true),
  
}, (table) => ({
  nameIdx: index("page_templates_name_idx").on(table.name),
  activeIdx: index("page_templates_active_idx").on(table.is_active),
}));

/**
 * Type definitions for TypeScript
 */
export type PageInsert = typeof pages.$inferInsert;
export type PageSelect = typeof pages.$inferSelect;
export type PageVersionInsert = typeof page_versions.$inferInsert;
export type PageVersionSelect = typeof page_versions.$inferSelect;
export type PageTemplateInsert = typeof page_templates.$inferInsert;
export type PageTemplateSelect = typeof page_templates.$inferSelect;

/**
 * Page status enum
 */
export const PAGE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published", 
  ARCHIVED: "archived"
} as const;

export type PageStatus = typeof PAGE_STATUS[keyof typeof PAGE_STATUS];

/**
 * Default page templates
 */
export const DEFAULT_PAGE_TEMPLATES = [
  {
    name: "default",
    display_name: "Default Page",
    description: "Standard content page with title and content",
    fields: JSON.stringify({
      title: { type: "text", required: true },
      content: { type: "richtext", required: true },
      excerpt: { type: "textarea", required: false }
    }),
    default_content: "<p>Enter your page content here...</p>"
  },
  {
    name: "legal",
    display_name: "Legal Document",
    description: "Template for privacy policy, terms of service, etc.",
    fields: JSON.stringify({
      title: { type: "text", required: true },
      content: { type: "richtext", required: true },
      last_updated: { type: "date", required: true },
      effective_date: { type: "date", required: false }
    }),
    default_content: `
      <h2>1. Introduction</h2>
      <p>Enter your legal document content here...</p>
      
      <h2>2. Definitions</h2>
      <p>Define key terms...</p>
      
      <h2>3. Contact Information</h2>
      <p>How to contact us regarding this document...</p>
    `
  },
  {
    name: "about",
    display_name: "About Page",
    description: "Company or team information page",
    fields: JSON.stringify({
      title: { type: "text", required: true },
      content: { type: "richtext", required: true },
      hero_image: { type: "image", required: false },
      team_section: { type: "richtext", required: false }
    }),
    default_content: `
      <h2>Our Story</h2>
      <p>Tell your company's story...</p>
      
      <h2>Our Mission</h2>
      <p>What drives us...</p>
      
      <h2>Our Team</h2>
      <p>Meet the people behind the company...</p>
    `
  }
] as const;

/**
 * Utility functions for page management
 */

/**
 * Generate a unique slug from title
 */
export function generatePageSlug(title: string, existingSlugs: string[] = []): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Ensure uniqueness
  let counter = 1;
  let originalSlug = slug;
  while (existingSlugs.includes(slug)) {
    slug = `${originalSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Validate page data
 */
export function validatePageData(data: Partial<PageInsert>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.title?.trim()) {
    errors.push("Title is required");
  }
  
  if (!data.content?.trim()) {
    errors.push("Content is required");
  }
  
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push("Slug must contain only lowercase letters, numbers, and hyphens");
  }
  
  if (data.status && !Object.values(PAGE_STATUS).includes(data.status as PageStatus)) {
    errors.push("Invalid page status");
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Check if page is published and visible
 */
export function isPagePublished(page: PageSelect): boolean {
  return page.status === PAGE_STATUS.PUBLISHED && 
         (page.published_at === null || page.published_at <= new Date());
}

/**
 * Get page URL path
 */
export function getPageUrl(page: PageSelect): string {
  return `/${page.slug}`;
}