/**
 * MACH Alliance Open Data Model - Category
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/product/category.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

import type { MACHMedia } from './Media.js';

/**
 * Category-specific SEO metadata (supports localization)
 */
interface MACHCategorySEO {
  meta_title?: string | Record<string, string>; // Page title (localizable)
  meta_description?: string | Record<string, string>; // Meta description (localizable)
  meta_keywords?: string[]; // Keywords for SEO
  canonical_url?: string; // Canonical URL for SEO
}

/**
 * MACH Alliance Open Data Model - Category Entity v1.0
 * 
 * The Category entity defines the hierarchical and navigational structure used to
 * group and organize products. It is central to product discovery, navigation, and
 * merchandising strategies across both B2B and B2C environments.
 */
export interface MACHCategory {
  // Core identification - REQUIRED
  id: string; // Unique identifier for the category
  name: string | Record<string, string>; // Display name of the category (localizable)

  // Display information - OPTIONAL
  description?: string | Record<string, string>; // Detailed description (localizable)
  slug?: string | Record<string, string>; // URL-friendly identifier (localizable)

  // Status and hierarchy - OPTIONAL
  status?: "active" | "inactive" | "archived";
  parent_id?: string; // Parent category identifier for hierarchy
  position?: number; // Sort order within parent category
  path?: string; // Full category path for breadcrumbs

  // External references - OPTIONAL
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601 creation timestamp
  updated_at?: string; // ISO 8601 update timestamp

  // Hierarchy and products - OPTIONAL
  children?: MACHCategoryReference[]; // Array of child category references
  product_count?: number; // Number of products in this category

  // Metadata and classification - OPTIONAL
  attributes?: Record<string, any>; // Additional metadata schemas or search filters
  tags?: string[]; // Array of tags for filtering and search

  // Media assets - OPTIONAL
  primary_image?: MACHMedia; // Primary category image
  media?: MACHMedia[]; // Additional images and assets

  // SEO - OPTIONAL
  seo?: MACHCategorySEO; // Metadata for search engine optimization

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Category reference for child categories
 */
export interface MACHCategoryReference {
  // Required for reference
  id: string;
  name: string | Record<string, string>;
  slug: string;

  // Optional reference details
  parent_id?: string;
  position?: number;
  product_count?: number;
}

// Type guards for category discrimination

export function isActiveCategory(category: MACHCategory): boolean {
  return category.status === "active" || category.status === undefined;
}

export function isRootCategory(category: MACHCategory): boolean {
  return category.parent_id === undefined;
}

export function hasChildren(category: MACHCategory): boolean {
  return category.children !== undefined && category.children.length > 0;
}

export function hasProducts(category: MACHCategory): boolean {
  return category.product_count !== undefined && category.product_count > 0;
}

export function isLocalized(value: string | Record<string, string>): value is Record<string, string> {
  return typeof value === 'object' && value !== null;
}

export function hasMedia(category: MACHCategory): boolean {
  return category.primary_image !== undefined || (category.media !== undefined && category.media.length > 0);
}

// Sample objects for reference

/**
 * Sample minimal category
 */
export const sampleMinimalCategory: MACHCategory = {
  id: "CAT-SHORTS-001",
  name: "Shorts",
  slug: "shorts",
  parent_id: "CAT-CLOTHING-001",
  position: 3,
  status: "active"
};

/**
 * Sample extended category with localization
 */
export const sampleExtendedCategory: MACHCategory = {
  id: "CAT-SHORTS-001",
  name: {
    "en-US": "Shorts",
    "de-DE": "Shorts"
  },
  description: {
    "en-US": "Comfortable shorts for all occasions",
    "de-DE": "Bequeme Shorts für alle Gelegenheiten"
  },
  slug: {
    "en-US": "shorts",
    "de-DE": "shorts"
  },
  status: "active",
  external_references: {
    pim_id: "cat_shorts_001",
    commerce_id: "shorts-category",
    erp_id: "CAT-789"
  },
  created_at: "2025-06-01T12:00:00Z",
  updated_at: "2025-06-10T12:30:00Z",
  parent_id: "CAT-CLOTHING-001",
  position: 3,
  path: "/clothing/shorts",
  product_count: 42,
  children: [
    {
      id: "CAT-RUNNING-SHORTS-001",
      name: {
        "en-US": "Running Shorts",
        "de-DE": "Laufshorts"
      },
      slug: "running-shorts",
      parent_id: "CAT-SHORTS-001",
      position: 1,
      product_count: 15
    }
  ],
  attributes: {
    style: "Modern",
    season: "Summer"
  },
  tags: ["trousers", "clothing", "casual"],
  primary_image: {
    file: {
      url: "https://cdn.example.com/categories/shorts-hero.webp",
      format: "webp"
    },
    accessibility: {
      alt_text: "Shorts Category"
    }
  },
  media: [
    {
      file: {
        url: "https://cdn.example.com/categories/shorts-banner.webp",
        format: "webp"
      },
      type: "image",
      accessibility: {
        alt_text: "Summer Shorts Collection"
      },
      extensions: {
        display: {
          type: "banner"
        }
      }
    }
  ],
  seo: {
    meta_title: {
      "en-US": "Premium Shorts Collection | MACH Store",
      "de-DE": "Premium-Shorts-Kollektion | MACH Store"
    },
    meta_description: {
      "en-US": "Discover our comfortable shorts for every occasion",
      "de-DE": "Entdecken Sie unsere bequemen Shorts für jede Gelegenheit"
    },
    meta_keywords: ["shorts", "casual wear", "summer"]
  },
  extensions: {
    merchandising: {
      featured: true,
      display_priority: 5,
      promotional_badge: {
        "en-US": "New Collection",
        "de-DE": "Neue Kollektion"
      },
      banner_image: "https://cdn.example.com/banners/shorts-promo.webp"
    },
    availability: {
      channel_availability: ["web", "store", "mobile"],
      region_availability: ["EU", "US", "UK"]
    }
  }
};
