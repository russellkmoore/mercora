/**
 * MACH Alliance Open Data Model - Category Schema
 * Drizzle ORM schema definition for Cloudflare D1
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/product/category.md
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { MACHCategory } from "@/lib/types/mach/Category";

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

/**
 * Transform database record to MACH Category interface
 */
export function transformToMACHCategory(record: SelectCategory): MACHCategory {
  return {
    // Core identification - REQUIRED
    id: record.id,
    name: record.name ? (isJsonString(record.name) ? JSON.parse(record.name) : record.name) : "",
    
    // Display information - OPTIONAL
    description: record.description ? (isJsonString(record.description) ? JSON.parse(record.description) : record.description) : undefined,
    slug: record.slug ? (isJsonString(record.slug) ? JSON.parse(record.slug) : record.slug) : undefined,
    
    // Status and hierarchy - OPTIONAL  
    status: record.status ?? undefined,
    parent_id: record.parentId ?? undefined,
    position: record.position ?? undefined,
    path: record.path ?? undefined,
    
    // External references - OPTIONAL
    external_references: record.externalReferences ? JSON.parse(record.externalReferences) : undefined,
    
    // Timestamps - OPTIONAL
    created_at: record.createdAt ?? undefined,
    updated_at: record.updatedAt ?? undefined,
    
    // Hierarchy and products - OPTIONAL
    children: record.children ? JSON.parse(record.children) : undefined,
    product_count: record.productCount ?? undefined,
    
    // Metadata and classification - OPTIONAL
    attributes: record.attributes ? JSON.parse(record.attributes) : undefined,
    tags: record.tags ? JSON.parse(record.tags) : undefined,
    
    // Media assets - OPTIONAL
    primary_image: record.primaryImage ? JSON.parse(record.primaryImage) : undefined,
    media: record.media ? JSON.parse(record.media) : undefined,
    
    // SEO - OPTIONAL
    seo: record.seo ? JSON.parse(record.seo) : undefined,
    
    // Extensions - OPTIONAL
    extensions: record.extensions ? JSON.parse(record.extensions) : undefined,
  };
}

/**
 * Transform MACH Category to database insert format
 */
export function transformFromMACHCategory(category: MACHCategory): InsertCategory {
  return {
    id: category.id,
    name: typeof category.name === 'string' ? category.name : JSON.stringify(category.name),
    description: category.description ? 
      (typeof category.description === 'string' ? category.description : JSON.stringify(category.description)) : undefined,
    slug: category.slug ? 
      (typeof category.slug === 'string' ? category.slug : JSON.stringify(category.slug)) : undefined,
    status: category.status ?? "active",
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

/**
 * Helper function to check if a string is valid JSON
 */
function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
