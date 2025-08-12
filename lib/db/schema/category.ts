/**
 * MACH Alliance Open Data Model - Category Schema
 * Drizzle ORM schema definition for Cloudflare D1
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/product/category.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Category } from "@/lib/types";

/**
 * Categories table - MACH Alliance compliant category storage
 * 
 * Supports hierarchical category structures with full MACH compliance
 */
export const categories = sqliteTable("categories", {
  // Core identification - REQUIRED
  id: text("id").primaryKey(),
  name: text("name").notNull(), // Stored as JSON for localization
  
  // Display information - OPTIONAL
  description: text("description"), // Stored as JSON for localization  
  slug: text("slug"), // Stored as JSON for localization
  
  // Status and hierarchy - OPTIONAL
  status: text("status", { 
    enum: ["active", "inactive", "archived"] 
  }).default("active"),
  parentId: text("parent_id"), // Parent category identifier
  position: integer("position"), // Sort order within parent
  path: text("path"), // Full category path for breadcrumbs
  
  // External references - OPTIONAL
  externalReferences: text("external_references"), // JSON: Dictionary of cross-system IDs
  
  // Timestamps - OPTIONAL
  createdAt: text("created_at"), // ISO 8601 creation timestamp
  updatedAt: text("updated_at"), // ISO 8601 update timestamp
  
  // Hierarchy and products - OPTIONAL  
  children: text("children"), // JSON: Array of child category references
  productCount: integer("product_count"), // Number of products in category
  
  // Metadata and classification - OPTIONAL
  attributes: text("attributes"), // JSON: Additional metadata schemas  
  tags: text("tags"), // JSON: Array of tags for filtering
  
  // Media assets - OPTIONAL
  primaryImage: text("primary_image"), // JSON: Primary category image (Media object)
  media: text("media"), // JSON: Additional images and assets
  
  // SEO - OPTIONAL
  seo: text("seo"), // JSON: SEO metadata object
  
  // Extensions - OPTIONAL
  extensions: text("extensions"), // JSON: Namespaced dictionary for extension data
});

/**
 * Type for inserting new categories
 */
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Type for selecting categories from database
 */
export type SelectCategory = typeof categories.$inferSelect;

// Helper: parse stringified JSON or return as-is
function parseMaybeJson(val: any) {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// Helper: convert DB record to MACH Category
export function deserializeCategory(record: SelectCategory): Category {
  return {
    id: record.id,
    name: parseMaybeJson(record.name),
    description: record.description ? parseMaybeJson(record.description) : undefined,
    slug: record.slug ? parseMaybeJson(record.slug) : undefined,
    status: record.status ?? undefined,
    parent_id: record.parentId ?? undefined,
    position: record.position ?? undefined,
    path: record.path ?? undefined,
    external_references: record.externalReferences ? JSON.parse(record.externalReferences) : undefined,
    created_at: record.createdAt ?? undefined,
    updated_at: record.updatedAt ?? undefined,
    children: record.children ? JSON.parse(record.children) : undefined,
    product_count: record.productCount ?? undefined,
    attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
    tags: record.tags ? JSON.parse(record.tags) : undefined,
    primary_image: record.primaryImage ? JSON.parse(record.primaryImage) : undefined,
    media: record.media ? JSON.parse(record.media) : undefined,
    seo: record.seo ? JSON.parse(record.seo) : undefined,
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
  };
}

// Helper: convert MACH Category to DB insert format
export function serializeCategory(category: Category): InsertCategory {
  return {
    id: category.id,
    name: typeof category.name === 'string' ? category.name : JSON.stringify(category.name),
    description: category.description ? (typeof category.description === 'string' ? category.description : JSON.stringify(category.description)) : undefined,
    slug: category.slug ? (typeof category.slug === 'string' ? category.slug : JSON.stringify(category.slug)) : undefined,
    status: category.status ?? 'active',
    parentId: category.parent_id,
    position: category.position,
    path: category.path,
    externalReferences: category.external_references ? JSON.stringify(category.external_references) : undefined,
    createdAt: category.created_at ?? new Date().toISOString(),
    updatedAt: category.updated_at ?? new Date().toISOString(),
    children: category.children ? JSON.stringify(category.children) : undefined,
    productCount: category.product_count,
    attributes: category.attributes ? JSON.stringify(category.attributes) : undefined,
    tags: category.tags ? JSON.stringify(category.tags) : undefined,
    primaryImage: category.primary_image ? JSON.stringify(category.primary_image) : undefined,
    media: category.media ? JSON.stringify(category.media) : undefined,
    seo: category.seo ? JSON.stringify(category.seo) : undefined,
    extensions: category.extensions ? JSON.stringify(category.extensions) : undefined,
  };
}
