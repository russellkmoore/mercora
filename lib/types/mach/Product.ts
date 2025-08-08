/**
 * MACH Alliance Open Data Model - Product Entity
 * 
 * Official MACH Product specification implementation:
 * https://github.com/machalliance/standards/blob/main/models/entities/product/product.md
 * 
 * This is a pure implementation of the MACH Alliance Product specification
 * with zero modifications or extensions.
 */

import type { Money } from '../';
import type { MACHMedia } from './Media.js';
import type { MACHInventory } from './Inventory.js';

/**
 * Official MACH Product Entity
 * Represents the master product information shared across all variants
 */
export interface MACHProduct {
  // Core identification (MUST)
  id: string;
  name: string | Record<string, string>; // Localizable
  
  // Classification and status (SHOULD)
  type?: string; // Reference to Product Type for classification
  status?: "active" | "inactive" | "archived" | "draft";
  external_references?: Record<string, string>; // Cross-system IDs
  
  // Timestamps (SHOULD)
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
  
  // Display information (SHOULD/COULD)
  description?: string | Record<string, string>; // Localizable
  slug?: string; // URL-friendly string for routing and SEO
  brand?: string; // Brand name or identifier
  
  // Categorization (RECOMMENDED/COULD)
  categories?: string[]; // Array of category references
  tags?: string[]; // Array of tags for filtering and search
  
  // Variant configuration (SHOULD)
  options?: MACHProductOption[]; // Array of option definitions for variants
  default_variant_id?: string; // ID of the primary/master variant
  variants?: MACHProductVariant[]; // Array of product variants (Option 1)
  
  // Fulfillment and tax (SHOULD)
  fulfillment_type?: "physical" | "digital" | "service";
  tax_category?: string; // Default tax classification
  
  // Media assets (SHOULD/COULD)
  primary_image?: MACHMedia; // Primary product image
  media?: MACHMedia[]; // Additional images, videos, documents
  
  // SEO and ratings (SHOULD/COULD)
  seo?: MACHSEO; // Metadata for search engine optimization
  rating?: MACHRating; // Aggregated customer review information
  
  // Relationships (COULD)
  related_products?: string[]; // Array of related product IDs
  
  // Extensibility (RECOMMENDED)
  extensions?: Record<string, any>; // Namespaced dictionary for extension data
}

/**
 * Official MACH Product Variant Entity
 * Represents individual sellable items with specific attribute combinations
 */
export interface MACHProductVariant {
  // Core identification (MUST)
  id: string;
  sku: string; // Stock Keeping Unit - unique identifier
  option_values: MACHOptionValue[]; // Array of option/value pairs for this variant
  price: Money; // Variant pricing
  
  // Optional identification
  product_id?: string; // Reference to parent product (Option 2 only)
  
  // Status and ordering (SHOULD)
  status?: "active" | "inactive" | "discontinued";
  position?: number; // Sort order for display purposes
  
  // Pricing (COULD)
  compare_at_price?: Money; // Original/MSRP price for showing discounts
  cost?: Money; // Cost of goods for margin calculations
  
  // Physical attributes (SHOULD/COULD)
  weight?: MACHWeight; // Physical weight for shipping calculations
  dimensions?: MACHDimensions; // Physical dimensions
  barcode?: string; // Barcode (UPC, EAN, ISBN, etc.)
  
  // Commerce (SHOULD/COULD)
  inventory?: MACHProductInventory; // Simplified inventory info for this variant
  tax_category?: string; // Tax classification override
  shipping_required?: boolean; // Whether physical shipping is needed
  
  // Media and attributes (COULD)
  media?: MACHMedia[]; // Variant-specific images
  attributes?: Record<string, any>; // Additional variant-specific attributes
  
  // Timestamps (SHOULD)
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
}

/**
 * Official MACH Product Option Definition
 */
export interface MACHProductOption {
  id: string; // Unique identifier for the option
  name: string | Record<string, string>; // Display name for the option (localizable)
  values: (string | Record<string, string>)[]; // Available values for this option (localizable)
  position?: number; // Display order for the option
}

/**
 * Official MACH Option Value Pair
 */
export interface MACHOptionValue {
  option_id: string; // Reference to option definition
  value: string; // Selected value for this option
}

/**
 * Additional supporting types specific to Product
 */

// Simplified inventory reference for product variants (not the full MACH Inventory entity)
export interface MACHProductInventory {
  track_inventory?: boolean;
  quantity?: number;
  allow_backorder?: boolean;
  backorder_quantity?: number;
  lead_time_days?: number;
  location_quantities?: Record<string, number>;
}

export interface MACHWeight {
  value: number;
  unit: "g" | "kg" | "oz" | "lb";
}

export interface MACHDimensions {
  length: number;
  width: number;
  height: number;
  unit: "cm" | "m" | "in" | "ft";
}

export interface MACHSEO {
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
}

export interface MACHRating {
  average: number; // 0-5
  count: number; // Total number of ratings
}

/**
 * Type guards for MACH Product validation
 */
export function isMACHProduct(obj: any): obj is MACHProduct {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    (typeof obj.name === 'string' || (typeof obj.name === 'object' && obj.name !== null))
  );
}

export function isMACHProductVariant(obj: any): obj is MACHProductVariant {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.sku === 'string' &&
    Array.isArray(obj.option_values) &&
    obj.price &&
    typeof obj.price.amount === 'number' &&
    typeof obj.price.currency === 'string'
  );
}

/**
 * Sample MACH Product objects for reference
 */
export const MACHProductExamples = {
  /**
   * Simple Product Example (from MACH spec)
   */
  simpleProduct: {
    id: "PROD-001",
    name: "Organic Cotton T-Shirt",
    description: "Sustainable, soft cotton t-shirt",
    status: "active" as const,
    type: "PT-APPAREL-001",
    slug: "organic-cotton-tshirt",
    brand: "MACH Apparel",
    categories: ["apparel", "shirts", "sustainable"],
    default_variant_id: "VAR-001",
    fulfillment_type: "physical" as const,
    tax_category: "apparel-standard",
    external_references: {
      erp_id: "ERP-67890",
      pim_id: "PIM-ORGANIC-001"
    },
    options: [],
    variants: [{
      id: "VAR-001",
      sku: "TSHIRT-001",
      status: "active" as const,
      position: 1,
      option_values: [],
      price: {
        amount: 34.95,
        currency: "EUR"
      },
      inventory: {
        track_inventory: true,
        quantity: 28,
        allow_backorder: true,
        backorder_quantity: 72,
        lead_time_days: 2
      },
      weight: {
        value: 200,
        unit: "g" as const
      },
      barcode: "1234567890123",
      shipping_required: true
    }],
    primary_image: {
      file: {
        url: "https://cdn.example.com/img/tshirt-primary.webp",
        format: "webp"
      },
      accessibility: {
        alt_text: "Organic Cotton T-Shirt"
      }
    },
    seo: {
      meta_title: "Organic Cotton T-Shirt - Sustainable Fashion",
      meta_description: "Eco-friendly organic cotton t-shirt for conscious consumers."
    }
  } as MACHProduct,

  /**
   * Digital Product Example (from MACH spec)
   */
  digitalProduct: {
    id: "PROD-003",
    name: {
      "en-US": "Premium Design Templates",
      "es-ES": "Plantillas de Diseño Premium"
    },
    description: {
      "en-US": "Professional design template bundle with 50+ layouts",
      "es-ES": "Paquete de plantillas de diseño profesional con más de 50 diseños"
    },
    status: "active" as const,
    brand: "MACH Digital",
    categories: ["digital", "design", "templates"],
    default_variant_id: "VAR-001",
    fulfillment_type: "digital" as const,
    tax_category: "digital-goods",
    external_references: {
      license_server: "LIC-TEMPLATES-001"
    },
    options: [],
    variants: [{
      id: "VAR-001",
      sku: "TEMPLATES-PRO",
      status: "active" as const,
      position: 1,
      option_values: [],
      price: {
        amount: 79.99,
        currency: "USD"
      },
      shipping_required: false,
      attributes: {
        download_limit: 5,
        license_type: "single-user",
        file_size_mb: 450
      }
    }],
    primary_image: {
      file: {
        url: "https://cdn.example.com/img/templates-preview.webp",
        format: "webp"
      },
      accessibility: {
        alt_text: "Premium Design Templates Preview"
      }
    },
    extensions: {
      digital_delivery: {
        delivery_method: "download",
        access_period_days: 365,
        drm_protected: false
      }
    }
  } as MACHProduct
};
