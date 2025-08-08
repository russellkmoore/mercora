/**
 * MACH Alliance Open Data Model - Pricing
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/pricing/pricing.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

import type { Money } from '../money.js';

/**
 * MACH Alliance Open Data Model - Pricing Entity v1.0
 * 
 * A unified pricing model that supports flexible, multi-currency pricing across
 * both B2B and B2C commerce scenarios.
 */
export interface MACHPricing {
  // Core identification - REQUIRED
  id: string;
  product_id: string; // Reference to the product/SKU this pricing applies to
  list_price: Money; // Manufacturer's suggested retail price (MSRP)
  sale_price: Money; // Actual selling price to customer

  // Classification and status - OPTIONAL
  type?: "retail" | "wholesale" | "bulk" | "contract" | "dynamic";
  status?: "active" | "inactive" | "scheduled" | "expired" | "draft";
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
  valid_from?: string; // ISO 8601
  valid_to?: string; // ISO 8601

  // Associations - OPTIONAL
  campaign_id?: string;
  pricelist_id?: string;
  catalog_id?: string;

  // Tax information - OPTIONAL
  tax?: MACHTaxInfo;

  // Additional pricing context - OPTIONAL
  currency_code?: string; // ISO 4217 (if different from Money object)
  minimum_quantity?: number;
  customer_segment_id?: string;
  channel_id?: string;
  region_id?: string;

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Tax information for pricing
 */
export interface MACHTaxInfo {
  included?: boolean; // Whether tax is included in the price
  rate?: number; // Tax rate as decimal (e.g., 0.21 for 21%)
  type?: "VAT" | "GST" | "PST" | "HST" | "sales_tax" | "none";
  amount?: Money; // Calculated tax amount
}

/**
 * Bulk pricing tier definition
 */
export interface MACHBulkPricingTier {
  minimum_quantity: number;
  maximum_quantity?: number; // null for unlimited
  price: Money;
}

/**
 * Customer segment pricing
 */
export interface MACHSegmentPricing {
  segment_id: string;
  segment_name?: string;
  price: Money;
  minimum_quantity?: number;
}

// Type guards for pricing type discrimination
export function isRetailPricing(pricing: MACHPricing): boolean {
  return pricing.type === "retail" || pricing.type === undefined;
}

export function isWholesalePricing(pricing: MACHPricing): boolean {
  return pricing.type === "wholesale";
}

export function isBulkPricing(pricing: MACHPricing): boolean {
  return pricing.type === "bulk";
}

export function isActivePricing(pricing: MACHPricing): boolean {
  return pricing.status === "active" || pricing.status === undefined;
}

export function isPricingValid(pricing: MACHPricing, date?: Date): boolean {
  const checkDate = date || new Date();
  const checkTime = checkDate.toISOString();
  
  const afterStart = !pricing.valid_from || checkTime >= pricing.valid_from;
  const beforeEnd = !pricing.valid_to || checkTime <= pricing.valid_to;
  
  return afterStart && beforeEnd;
}

// Sample objects for reference

/**
 * Sample minimal pricing
 */
export const sampleMinimalPricing: MACHPricing = {
  id: "PRICE-MIN-001",
  product_id: "PROD-001",
  list_price: {
    amount: 49.99,
    currency: "USD"
  },
  sale_price: {
    amount: 49.99,
    currency: "USD"
  }
};

/**
 * Sample simple retail pricing
 */
export const sampleRetailPricing: MACHPricing = {
  id: "PRICE-001",
  product_id: "PROD-001",
  type: "retail",
  status: "active",
  list_price: {
    amount: 39.95,
    currency: "EUR"
  },
  sale_price: {
    amount: 34.95,
    currency: "EUR"
  },
  external_references: {
    pms_id: "price-123",
    erp_id: "price-456"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  pricelist_id: "RETAIL-2024",
  catalog_id: "EU-ENGLISH",
  tax: {
    included: true,
    rate: 0.21,
    type: "VAT"
  },
  extensions: {
    internal: {
      cost_price: {
        amount: 25.00,
        currency: "EUR"
      },
      margin_percentage: 39.8,
      source: "erp"
    }
  }
};

/**
 * Sample campaign-based pricing
 */
export const sampleCampaignPricing: MACHPricing = {
  id: "PRICE-CAMPAIGN-001",
  product_id: "PROD-001",
  type: "retail",
  status: "active",
  list_price: {
    amount: 39.95,
    currency: "EUR"
  },
  sale_price: {
    amount: 31.96,
    currency: "EUR"
  },
  campaign_id: "CAMPAIGN-BLACK-FRIDAY-2024",
  pricelist_id: "BLACK-FRIDAY-2024",
  catalog_id: "EU-ENGLISH",
  external_references: {
    pms_id: "price-campaign-123",
    erp_id: "price-campaign-456"
  },
  created_at: "2024-10-01T00:00:00Z",
  updated_at: "2024-11-20T00:00:00Z",
  valid_from: "2024-11-29T00:00:00Z",
  valid_to: "2024-12-02T23:59:59Z",
  tax: {
    included: true,
    rate: 0.21,
    type: "VAT"
  },
  extensions: {
    campaign: {
      campaign_name: "Black Friday Sale 2024",
      discount_percentage: 20,
      source: "marketing_platform"
    },
    internal: {
      cost_price: {
        amount: 25.00,
        currency: "EUR"
      },
      source: "erp"
    }
  }
};

/**
 * Sample bulk pricing with tiers
 */
export const sampleBulkPricing: MACHPricing = {
  id: "PRICE-BULK-001",
  product_id: "PROD-001",
  type: "bulk",
  status: "active",
  list_price: {
    amount: 39.95,
    currency: "EUR"
  },
  sale_price: {
    amount: 39.95,
    currency: "EUR"
  },
  pricelist_id: "BULK-2024",
  catalog_id: "EU-ENGLISH",
  external_references: {
    pms_id: "price-bulk-123",
    erp_id: "price-bulk-456"
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  tax: {
    included: true,
    rate: 0.21,
    type: "VAT"
  },
  extensions: {
    bulk_pricing: {
      tiers: [
        {
          minimum_quantity: 10,
          maximum_quantity: 49,
          price: {
            amount: 35.95,
            currency: "EUR"
          }
        },
        {
          minimum_quantity: 50,
          maximum_quantity: 99,
          price: {
            amount: 32.95,
            currency: "EUR"
          }
        },
        {
          minimum_quantity: 100,
          price: {
            amount: 29.95,
            currency: "EUR"
          }
        }
      ]
    },
    internal: {
      cost_price: {
        amount: 25.00,
        currency: "EUR"
      }
    }
  }
};

/**
 * Sample B2B wholesale pricing matrix
 */
export const sampleB2BPricingMatrix: MACHPricing = {
  id: "PRICE-MATRIX-B2B-001",
  type: "wholesale",
  status: "active",
  customer_segment_id: "SEGMENT-CUST-042",
  pricelist_id: "B2B-JUNE-2025",
  catalog_id: "B2B-CATALOG",
  channel_id: "CHANNEL-B2B",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  valid_from: "2024-01-01T00:00:00Z",
  valid_to: "2027-01-01T00:00:00Z",
  external_references: {
    pms_id: "matrix-b2b-042",
    cache_key: "price:b2b:segment-042:cat-tshirts"
  },
  product_id: "CATEGORY-TSHIRTS", // Category-level pricing
  list_price: { amount: 0, currency: "EUR" }, // Placeholder for matrix pricing
  sale_price: { amount: 0, currency: "EUR" }, // Placeholder for matrix pricing
  extensions: {
    matrix_pricing: {
      prices: [
        {
          product_id: "PROD-001",
          sku: "TSHIRT-001",
          list_price: {
            amount: 39.95,
            currency: "EUR"
          },
          sale_price: {
            amount: 28.95,
            currency: "EUR"
          },
          unit_of_measure: "colli",
          price_tier: "default"
        },
        {
          product_id: "PROD-002",
          sku: "TSHIRT-002",
          list_price: {
            amount: 35.00,
            currency: "EUR"
          },
          sale_price: {
            amount: 25.50,
            currency: "EUR"
          },
          unit_of_measure: "colli",
          price_tier: "bulk",
          minimum_quantity: 10
        }
      ],
      performance_optimized: true,
      cache_ttl_seconds: 3600
    }
  }
};
