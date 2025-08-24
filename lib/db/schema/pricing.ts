/**
 * MACH Alliance Pricing Entity - Database Schema
 * 
 * Drizzle ORM schema definition for MACH Alliance compliant pricing data.
 * Supports flexible pricing models for B2B, B2C, bulk, and dynamic pricing.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { Money, Pricing, TaxInfo, BulkPricingTier } from '@/lib/types';

/**
 * MACH Alliance Pricing table schema
 * Optimized for Cloudflare D1 with JSON storage for complex objects
 */
export const pricing = sqliteTable('pricing', {
  // Core identification - REQUIRED
  id: text('id').primaryKey(),
  product_id: text('product_id').notNull(),
  
  // Price values (stored as JSON for Money objects) - REQUIRED
  list_price: text('list_price', { mode: 'json' }).notNull().$type<Money>(),
  sale_price: text('sale_price', { mode: 'json' }).notNull().$type<Money>(),
  
  // Classification and status - OPTIONAL
  type: text('type', { enum: ['retail', 'wholesale', 'bulk', 'contract', 'dynamic'] }).default('retail'),
  status: text('status', { enum: ['active', 'inactive', 'scheduled', 'expired', 'draft'] }).default('active'),
  
  // External references (stored as JSON) - OPTIONAL
  external_references: text('external_references', { mode: 'json' }).$type<Record<string, string>>(),
  
  // Timestamps - OPTIONAL
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  valid_from: text('valid_from'), // ISO 8601
  valid_to: text('valid_to'), // ISO 8601
  
  // Associations - OPTIONAL
  campaign_id: text('campaign_id'),
  pricelist_id: text('pricelist_id'),
  catalog_id: text('catalog_id'),
  
  // Tax information (stored as JSON) - OPTIONAL
  tax: text('tax', { mode: 'json' }).$type<TaxInfo>(),
  
  // Additional pricing context - OPTIONAL
  currency_code: text('currency_code', { length: 3 }), // ISO 4217
  minimum_quantity: integer('minimum_quantity').default(1),
  customer_segment_id: text('customer_segment_id'),
  channel_id: text('channel_id'),
  region_id: text('region_id'),
  
  // Extensions for custom data (stored as JSON) - OPTIONAL
  extensions: text('extensions', { mode: 'json' }).$type<Record<string, any>>()
}, (table) => ({
  // Performance indexes for common queries
  product_idx: index('idx_pricing_product').on(table.product_id),
  status_idx: index('idx_pricing_status').on(table.status),
  type_idx: index('idx_pricing_type').on(table.type),
  pricelist_idx: index('idx_pricing_pricelist').on(table.pricelist_id),
  campaign_idx: index('idx_pricing_campaign').on(table.campaign_id),
  customer_segment_idx: index('idx_pricing_customer_segment').on(table.customer_segment_id),
  channel_idx: index('idx_pricing_channel').on(table.channel_id),
  validity_idx: index('idx_pricing_validity').on(table.valid_from, table.valid_to),
  created_idx: index('idx_pricing_created').on(table.created_at)
}));

// Schema type inference
export type PricingSelect = typeof pricing.$inferSelect;
export type PricingInsert = typeof pricing.$inferInsert;

/**
 * Helper: convert DB record to MACH Pricing
 */
export function deserializePricing(record: PricingSelect): Pricing {
  return {
    id: record.id,
    product_id: record.product_id,
    list_price: record.list_price,
    sale_price: record.sale_price,
    type: record.type as Pricing['type'],
    status: record.status as Pricing['status'],
    external_references: record.external_references || undefined,
    created_at: record.created_at || undefined,
    updated_at: record.updated_at || undefined,
    valid_from: record.valid_from || undefined,
    valid_to: record.valid_to || undefined,
    campaign_id: record.campaign_id || undefined,
    pricelist_id: record.pricelist_id || undefined,
    catalog_id: record.catalog_id || undefined,
    tax: record.tax || undefined,
    currency_code: record.currency_code || undefined,
    minimum_quantity: record.minimum_quantity || undefined,
    customer_segment_id: record.customer_segment_id || undefined,
    channel_id: record.channel_id || undefined,
    region_id: record.region_id || undefined,
    extensions: record.extensions || undefined
  };
}

// Helper: convert MACH Pricing to DB insert format
export function serializePricing(pricing: Pricing): PricingInsert {
  return {
    id: pricing.id,
    product_id: pricing.product_id,
    list_price: pricing.list_price,
    sale_price: pricing.sale_price,
    type: pricing.type || 'retail',
    status: pricing.status || 'active',
    external_references: pricing.external_references || null,
    created_at: pricing.created_at || undefined,
    updated_at: pricing.updated_at || undefined,
    valid_from: pricing.valid_from || null,
    valid_to: pricing.valid_to || null,
    campaign_id: pricing.campaign_id || null,
    pricelist_id: pricing.pricelist_id || null,
    catalog_id: pricing.catalog_id || null,
    tax: pricing.tax || null,
    currency_code: pricing.currency_code || null,
    minimum_quantity: pricing.minimum_quantity || 1,
    customer_segment_id: pricing.customer_segment_id || null,
    channel_id: pricing.channel_id || null,
    region_id: pricing.region_id || null,
    extensions: pricing.extensions || null
  };
}

/**
 * Utility functions for pricing validation and operations
 */

/**
 * Validate Money object structure
 */
export function isValidMoney(money: any): money is Money {
  return typeof money === 'object' && 
         money !== null && 
         typeof money.amount === 'number' && 
         typeof money.currency === 'string' &&
         money.currency.length === 3;
}

/**
 * Validate pricing type
 */
export function isValidPricingType(type: string): type is NonNullable<Pricing['type']> {
  return ['retail', 'wholesale', 'bulk', 'contract', 'dynamic'].includes(type);
}

/**
 * Validate pricing status
 */
export function isValidPricingStatus(status: string): status is NonNullable<Pricing['status']> {
  return ['active', 'inactive', 'scheduled', 'expired', 'draft'].includes(status);
}

/**
 * Check if pricing is currently valid based on date range
 */
export function isPricingCurrentlyValid(pricing: Pricing, date?: Date): boolean {
  const checkDate = date || new Date();
  const checkTime = checkDate.toISOString();
  
  const afterStart = !pricing.valid_from || checkTime >= pricing.valid_from;
  const beforeEnd = !pricing.valid_to || checkTime <= pricing.valid_to;
  
  return afterStart && beforeEnd;
}

/**
 * Calculate discount percentage from list and sale price
 */
export function calculateDiscountPercentage(pricing: Pricing): number | null {
  if (!pricing.list_price || !pricing.sale_price) return null;
  if (pricing.list_price.currency !== pricing.sale_price.currency) return null;
  if (pricing.list_price.amount <= 0) return null;
  
  const discount = pricing.list_price.amount - pricing.sale_price.amount;
  return Math.round((discount / pricing.list_price.amount) * 100 * 100) / 100; // Round to 2 decimals
}

/**
 * Get bulk pricing tier for quantity
 */
export function getBulkPricingTier(pricing: Pricing, quantity: number): BulkPricingTier | null {
  const bulkExtension = pricing.extensions?.bulk_pricing;
  if (!bulkExtension?.tiers) return null;
  
  // Find the appropriate tier for the quantity
  const tiers = bulkExtension.tiers as BulkPricingTier[];
  
  // Sort tiers by minimum_quantity descending to find the highest applicable tier
  const sortedTiers = tiers
    .filter(tier => quantity >= tier.minimum_quantity)
    .sort((a, b) => b.minimum_quantity - a.minimum_quantity);
  
  return sortedTiers[0] || null;
}

/**
 * Get effective price for quantity (considering bulk pricing)
 */
export function getEffectivePriceForQuantity(pricing: Pricing, quantity: number): Money {
  const bulkTier = getBulkPricingTier(pricing, quantity);
  return bulkTier ? bulkTier.price : pricing.sale_price;
}

/**
 * Validate tax info structure
 */
export function isValidTaxInfo(tax: any): tax is TaxInfo {
  if (!tax || typeof tax !== 'object') return true; // Tax is optional
  
  const validTaxTypes = ['VAT', 'GST', 'PST', 'HST', 'sales_tax', 'none'];
  
  return (tax.included === undefined || typeof tax.included === 'boolean') &&
         (tax.rate === undefined || (typeof tax.rate === 'number' && tax.rate >= 0 && tax.rate <= 1)) &&
         (tax.type === undefined || validTaxTypes.includes(tax.type)) &&
         (tax.amount === undefined || isValidMoney(tax.amount));
}

/**
 * Generate pricing ID if not provided
 */
export function generatePricingId(productId: string, type?: string, suffix?: string): string {
  const typePrefix = type ? type.toUpperCase().substring(0, 3) : 'PRC';
  const timestamp = Date.now().toString(36);
  const suffixPart = suffix ? `-${suffix}` : '';
  return `${typePrefix}-${productId}-${timestamp}${suffixPart}`;
}

/**
 * Validate complete pricing object
 */
export function validatePricingObject(pricing: Partial<Pricing>): string[] {
  const errors: string[] = [];
  
  // Required fields
  if (!pricing.id) errors.push('id is required');
  if (!pricing.product_id) errors.push('product_id is required');
  if (!pricing.list_price) errors.push('list_price is required');
  if (!pricing.sale_price) errors.push('sale_price is required');
  
  // Validate Money objects
  if (pricing.list_price && !isValidMoney(pricing.list_price)) {
    errors.push('list_price must be a valid Money object');
  }
  if (pricing.sale_price && !isValidMoney(pricing.sale_price)) {
    errors.push('sale_price must be a valid Money object');
  }
  
  // Validate currency consistency
  if (pricing.list_price && pricing.sale_price && 
      pricing.list_price.currency !== pricing.sale_price.currency) {
    errors.push('list_price and sale_price must have the same currency');
  }
  
  // Validate enums
  if (pricing.type && !isValidPricingType(pricing.type)) {
    errors.push('invalid pricing type');
  }
  if (pricing.status && !isValidPricingStatus(pricing.status)) {
    errors.push('invalid pricing status');
  }
  
  // Validate currency code format
  if (pricing.currency_code && !/^[A-Z]{3}$/.test(pricing.currency_code)) {
    errors.push('currency_code must be a 3-letter ISO 4217 code');
  }
  
  // Validate dates
  if (pricing.valid_from && isNaN(Date.parse(pricing.valid_from))) {
    errors.push('valid_from must be a valid ISO 8601 date');
  }
  if (pricing.valid_to && isNaN(Date.parse(pricing.valid_to))) {
    errors.push('valid_to must be a valid ISO 8601 date');
  }
  
  // Validate date range
  if (pricing.valid_from && pricing.valid_to && pricing.valid_from >= pricing.valid_to) {
    errors.push('valid_from must be before valid_to');
  }
  
  // Validate minimum quantity
  if (pricing.minimum_quantity !== undefined && 
      (!Number.isInteger(pricing.minimum_quantity) || pricing.minimum_quantity < 1)) {
    errors.push('minimum_quantity must be a positive integer');
  }
  
  // Validate tax info
  if (pricing.tax && !isValidTaxInfo(pricing.tax)) {
    errors.push('invalid tax information structure');
  }
  
  return errors;
}

/**
 * Convert price to different currency (requires exchange rate)
 */
export function convertPrice(price: Money, targetCurrency: string, exchangeRate: number): Money {
  return {
    amount: Math.round(price.amount * exchangeRate * 100) / 100, // Round to 2 decimals
    currency: targetCurrency
  };
}

/**
 * Format price for display
 */
export function formatPriceDisplay(price: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price.amount);
}
