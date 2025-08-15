/**
 * MACH Alliance Pricing Entity - Business Model
 * 
 * Comprehensive business logic for pricing management supporting B2B, B2C,
 * bulk pricing, campaigns, customer segments, and dynamic pricing strategies.
 * 
 * Based on MACH Alliance specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/pricing/pricing.md
 */

import { eq, and, or, gte, lte, isNull, isNotNull, sql, desc, asc, inArray } from 'drizzle-orm';
import { 
  pricing, 
  serializePricing,
  deserializePricing,
  validatePricingObject, 
  generatePricingId,
  isValidPricingType,
  isValidPricingStatus,
  isPricingCurrentlyValid,
  getEffectivePriceForQuantity,
  getBulkPricingTier,
  calculateDiscountPercentage,
  isValidMoney,
  isValidTaxInfo
} from '../../db/schema/pricing';
import { getDb } from '../../db';
import type { 
  Pricing, 
  BulkPricingTier, 
  SegmentPricing, 
  TaxInfo,
  Money
} from '@/lib/types';

// Get database instance
const db = getDb();

// =====================================================
// Core CRUD Operations
// =====================================================

/**
 * Create a new pricing record
 */
export async function createPricing(pricingData: Partial<Pricing>): Promise<Pricing> {
  // Generate ID if not provided
  if (!pricingData.id) {
    pricingData.id = generatePricingId(
      pricingData.product_id || 'UNKNOWN',
      pricingData.type,
      pricingData.campaign_id || pricingData.customer_segment_id
    );
  }

  // Validate the pricing object
  const validationErrors = validatePricingObject(pricingData);
  if (validationErrors.length > 0) {
    throw new Error(`Pricing validation failed: ${validationErrors.join(', ')}`);
  }

  // Set timestamps
  const now = new Date().toISOString();
  const pricingToCreate: Pricing = {
    ...pricingData,
    created_at: pricingData.created_at || now,
    updated_at: pricingData.updated_at || now
  } as Pricing;

  // Transform for database storage
  const dbRecord = serializePricing(pricingToCreate);
  const [inserted] = await db.insert(pricing).values(dbRecord).returning();
  
  return deserializePricing(inserted);
}

/**
 * Update an existing pricing record
 */
export async function updatePricing(
  id: string, 
  updates: Partial<Pricing>
): Promise<Pricing | null> {
  // Set updated timestamp
  const updatedData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Validate updates if they include critical fields
  if (updates.list_price || updates.sale_price || updates.product_id) {
    const existing = await getPricingById(id);
    if (!existing) return null;
    
    const merged = { ...existing, ...updatedData };
    const validationErrors = validatePricingObject(merged);
    if (validationErrors.length > 0) {
      throw new Error(`Pricing validation failed: ${validationErrors.join(', ')}`);
    }
  }

  // Transform for database storage
  const dbUpdates = serializePricing(updatedData as Pricing);
  const [updated] = await db
    .update(pricing)
    .set(dbUpdates)
    .where(eq(pricing.id, id))
    .returning();

  return updated ? deserializePricing(updated) : null;
}

/**
 * Delete a pricing record (soft delete by setting status)
 */
export async function deletePricing(id: string): Promise<boolean> {
  const result = await db
    .update(pricing)
    .set({ 
      status: 'expired',
      updated_at: new Date().toISOString()
    })
    .where(eq(pricing.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Get pricing by ID
 */
export async function getPricingById(id: string): Promise<Pricing | null> {
  const [result] = await db
    .select()
    .from(pricing)
    .where(eq(pricing.id, id))
    .limit(1);

  return result ? deserializePricing(result) : null;
}

// =====================================================
// Product Pricing Operations
// =====================================================

/**
 * Get all pricing for a specific product
 */
export async function getPricingForProduct(
  productId: string,
  options: {
    status?: Pricing['status'][];
    type?: Pricing['type'][];
    validAt?: Date;
    includeExpired?: boolean;
  } = {}
): Promise<Pricing[]> {
  const conditions = [eq(pricing.product_id, productId)];

  // Filter by status
  if (options.status && options.status.length > 0) {
    const validStatuses = options.status.filter(s => s !== undefined);
    if (validStatuses.length > 0) {
      conditions.push(inArray(pricing.status, validStatuses));
    }
  } else if (!options.includeExpired) {
    conditions.push(sql`${pricing.status} != 'expired'`);
  }

  // Filter by type
  if (options.type && options.type.length > 0) {
    const validTypes = options.type.filter(t => t !== undefined);
    if (validTypes.length > 0) {
      conditions.push(inArray(pricing.type, validTypes));
    }
  }

  // Filter by validity date
  if (options.validAt) {
    const dateStr = options.validAt.toISOString();
    conditions.push(
      and(
        or(isNull(pricing.valid_from), lte(pricing.valid_from, dateStr)),
        or(isNull(pricing.valid_to), gte(pricing.valid_to, dateStr))
      )!
    );
  }

  const results = await db
    .select()
    .from(pricing)
    .where(and(...conditions))
    .orderBy(desc(pricing.created_at));
    
  return results.map(deserializePricing);
}

/**
 * Get effective pricing for a product considering context
 */
export async function getEffectivePricing(
  productId: string,
  context: {
    customerSegmentId?: string;
    channelId?: string;
    regionId?: string;
    campaignId?: string;
    quantity?: number;
    date?: Date;
  } = {}
): Promise<Pricing | null> {
  const validAt = context.date || new Date();
  const dateStr = validAt.toISOString();

  const baseConditions = [
    eq(pricing.product_id, productId),
    eq(pricing.status, 'active'),
    or(isNull(pricing.valid_from), lte(pricing.valid_from, dateStr)),
    or(isNull(pricing.valid_to), gte(pricing.valid_to, dateStr))
  ];

  // Try context-specific pricing first (campaign, then segment, then channel, then region)
  if (context.campaignId) {
    const [campaignResult] = await db
      .select()
      .from(pricing)
      .where(and(...baseConditions, eq(pricing.campaign_id, context.campaignId)))
      .orderBy(desc(pricing.created_at))
      .limit(1);
    if (campaignResult) {
  return deserializePricing(campaignResult);
    }
  }

  if (context.customerSegmentId) {
    const [segmentResult] = await db
      .select()
      .from(pricing)
      .where(and(...baseConditions, eq(pricing.customer_segment_id, context.customerSegmentId)))
      .orderBy(desc(pricing.created_at))
      .limit(1);
    if (segmentResult) {
  return deserializePricing(segmentResult);
    }
  }

  if (context.channelId) {
    const [channelResult] = await db
      .select()
      .from(pricing)
      .where(and(...baseConditions, eq(pricing.channel_id, context.channelId)))
      .orderBy(desc(pricing.created_at))
      .limit(1);
    if (channelResult) {
  return deserializePricing(channelResult);
    }
  }

  if (context.regionId) {
    const [regionResult] = await db
      .select()
      .from(pricing)
      .where(and(...baseConditions, eq(pricing.region_id, context.regionId)))
      .orderBy(desc(pricing.created_at))
      .limit(1);
    if (regionResult) {
  return deserializePricing(regionResult);
    }
  }

  // Fall back to default pricing
  const [defaultResult] = await db
    .select()
    .from(pricing)
    .where(
      and(
        ...baseConditions,
        isNull(pricing.campaign_id),
        isNull(pricing.customer_segment_id),
        isNull(pricing.channel_id),
        isNull(pricing.region_id)
      )
    )
    .orderBy(desc(pricing.created_at))
    .limit(1);

  return defaultResult ? deserializePricing(defaultResult) : null;
}

// =====================================================
// Campaign Pricing Operations
// =====================================================

/**
 * Get all pricing for a specific campaign
 */
export async function getCampaignPricing(
  campaignId: string,
  options: { status?: Pricing['status'][] } = {}
): Promise<Pricing[]> {
  const conditions = [eq(pricing.campaign_id, campaignId)];

  if (options.status && options.status.length > 0) {
    const validStatuses = options.status.filter(s => s !== undefined);
    if (validStatuses.length > 0) {
      conditions.push(inArray(pricing.status, validStatuses));
    }
  }

  const results = await db
    .select()
    .from(pricing)
    .where(and(...conditions))
    .orderBy(asc(pricing.product_id));
    
  return results.map(deserializePricing);
}

/**
 * Create bulk campaign pricing
 */
export async function createCampaignPricing(
  campaignId: string,
  productPricing: Array<{
    product_id: string;
    list_price: Money;
    sale_price: Money;
    valid_from?: string;
    valid_to?: string;
    minimum_quantity?: number;
  }>,
  commonSettings: {
    pricelist_id?: string;
    catalog_id?: string;
    tax?: TaxInfo;
    extensions?: Record<string, any>;
  } = {}
): Promise<Pricing[]> {
  const pricingRecords = productPricing.map(product => ({
    product_id: product.product_id,
    list_price: product.list_price,
    sale_price: product.sale_price,
    type: 'retail' as const,
    status: 'active' as const,
    campaign_id: campaignId,
    valid_from: product.valid_from,
    valid_to: product.valid_to,
    minimum_quantity: product.minimum_quantity || 1,
    ...commonSettings
  }));

  const created: Pricing[] = [];
  for (const record of pricingRecords) {
    created.push(await createPricing(record));
  }

  return created;
}

// =====================================================
// Customer Segment Pricing Operations
// =====================================================

/**
 * Get pricing for a customer segment
 */
export async function getSegmentPricing(
  customerSegmentId: string,
  options: {
    productIds?: string[];
    status?: Pricing['status'][];
  } = {}
): Promise<Pricing[]> {
  const conditions = [eq(pricing.customer_segment_id, customerSegmentId)];

  if (options.productIds && options.productIds.length > 0) {
    conditions.push(inArray(pricing.product_id, options.productIds));
  }

  if (options.status && options.status.length > 0) {
    const validStatuses = options.status.filter(s => s !== undefined);
    if (validStatuses.length > 0) {
      conditions.push(inArray(pricing.status, validStatuses));
    }
  }

  const results = await db
    .select()
    .from(pricing)
    .where(and(...conditions))
    .orderBy(asc(pricing.product_id));
    
  return results.map(deserializePricing);
}

// =====================================================
// Bulk Pricing Operations
// =====================================================

/**
 * Get bulk pricing tier for quantity
 */
export async function getBulkPricingForQuantity(
  productId: string,
  quantity: number
): Promise<{ pricing: Pricing; effectivePrice: Money } | null> {
  const [bulkPricing] = await db
    .select()
    .from(pricing)
    .where(
      and(
        eq(pricing.product_id, productId),
        eq(pricing.type, 'bulk'),
        eq(pricing.status, 'active')
      )
    )
    .limit(1);

  if (!bulkPricing) return null;

  const pricingObj = deserializePricing(bulkPricing);
  const effectivePrice = getEffectivePriceForQuantity(pricingObj, quantity);

  return { pricing: pricingObj, effectivePrice };
}

// =====================================================
// Search Operations
// =====================================================

/**
 * Search pricing by various criteria
 */
export async function searchPricing(options: {
  productIds?: string[];
  campaignIds?: string[];
  customerSegmentIds?: string[];
  channelIds?: string[];
  regionIds?: string[];
  pricelistIds?: string[];
  catalogIds?: string[];
  status?: Pricing['status'][];
  type?: Pricing['type'][];
  validAt?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'product_id';
  orderDirection?: 'asc' | 'desc';
}): Promise<Pricing[]> {
  const conditions = [];

  // Product filters
  if (options.productIds && options.productIds.length > 0) {
    conditions.push(inArray(pricing.product_id, options.productIds));
  }

  // Campaign filters
  if (options.campaignIds && options.campaignIds.length > 0) {
    conditions.push(inArray(pricing.campaign_id, options.campaignIds));
  }

  // Customer segment filters
  if (options.customerSegmentIds && options.customerSegmentIds.length > 0) {
    conditions.push(inArray(pricing.customer_segment_id, options.customerSegmentIds));
  }

  // Channel filters
  if (options.channelIds && options.channelIds.length > 0) {
    conditions.push(inArray(pricing.channel_id, options.channelIds));
  }

  // Region filters
  if (options.regionIds && options.regionIds.length > 0) {
    conditions.push(inArray(pricing.region_id, options.regionIds));
  }

  // Price list filters
  if (options.pricelistIds && options.pricelistIds.length > 0) {
    conditions.push(inArray(pricing.pricelist_id, options.pricelistIds));
  }

  // Catalog filters
  if (options.catalogIds && options.catalogIds.length > 0) {
    conditions.push(inArray(pricing.catalog_id, options.catalogIds));
  }

  // Status filters
  if (options.status && options.status.length > 0) {
    const validStatuses = options.status.filter(s => s !== undefined);
    if (validStatuses.length > 0) {
      conditions.push(inArray(pricing.status, validStatuses));
    }
  }

  // Type filters
  if (options.type && options.type.length > 0) {
    const validTypes = options.type.filter(t => t !== undefined);
    if (validTypes.length > 0) {
      conditions.push(inArray(pricing.type, validTypes));
    }
  }

  // Validity date filter
  if (options.validAt) {
    const dateStr = options.validAt.toISOString();
    conditions.push(
      and(
        or(isNull(pricing.valid_from), lte(pricing.valid_from, dateStr)),
        or(isNull(pricing.valid_to), gte(pricing.valid_to, dateStr))
      )
    );
  }

  // Build and execute query
  const results = await db
    .select()
    .from(pricing)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      options.orderDirection === 'asc' 
        ? asc(pricing[options.orderBy || 'created_at'])
        : desc(pricing[options.orderBy || 'created_at'])
    )
    .limit(options.limit || 1000)
    .offset(options.offset || 0);

  return results.map(deserializePricing);
}

/**
 * Get pricing statistics
 */
export async function getPricingStatistics(): Promise<{
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  with_campaigns: number;
  with_segments: number;
  with_bulk_pricing: number;
  active_campaigns: number;
  expired_pricing: number;
}> {
  // Get total count
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing);
  const total = totalResult?.count || 0;

  // Get counts by status
  const statusResults = await db
    .select({
      status: pricing.status,
      count: sql<number>`count(*)`
    })
    .from(pricing)
    .groupBy(pricing.status);

  const by_status = statusResults.reduce((acc, row) => {
    acc[row.status || 'unknown'] = row.count;
    return acc;
  }, {} as Record<string, number>);

  // Get counts by type
  const typeResults = await db
    .select({
      type: pricing.type,
      count: sql<number>`count(*)`
    })
    .from(pricing)
    .groupBy(pricing.type);

  const by_type = typeResults.reduce((acc, row) => {
    acc[row.type || 'unknown'] = row.count;
    return acc;
  }, {} as Record<string, number>);

  // Get campaign count
  const [campaignResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing)
    .where(isNotNull(pricing.campaign_id));
  const with_campaigns = campaignResult?.count || 0;

  // Get segment count
  const [segmentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing)
    .where(isNotNull(pricing.customer_segment_id));
  const with_segments = segmentResult?.count || 0;

  // Get bulk pricing count
  const [bulkResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing)
    .where(eq(pricing.type, 'bulk'));
  const with_bulk_pricing = bulkResult?.count || 0;

  // Get active campaign pricing count
  const [activeCampaignResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing)
    .where(
      and(
        isNotNull(pricing.campaign_id),
        eq(pricing.status, 'active')
      )
    );
  const active_campaigns = activeCampaignResult?.count || 0;

  // Get expired pricing count
  const [expiredResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pricing)
    .where(eq(pricing.status, 'expired'));
  const expired_pricing = expiredResult?.count || 0;

  return {
    total,
    by_status,
    by_type,
    with_campaigns,
    with_segments,
    with_bulk_pricing,
    active_campaigns,
    expired_pricing
  };
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Calculate effective price with tax
 */
export function calculateEffectivePriceWithTax(
  pricing: Pricing,
  quantity: number = 1
): { basePrice: Money; taxAmount: Money; totalPrice: Money } | null {
  if (!pricing.tax) {
    return {
      basePrice: pricing.sale_price,
      taxAmount: { amount: 0, currency: pricing.sale_price.currency },
      totalPrice: pricing.sale_price
    };
  }

  const baseAmount = pricing.sale_price.amount * quantity;
  const currency = pricing.sale_price.currency;

  if (pricing.tax.included) {
    // Tax is included in the price
    const taxRate = pricing.tax.rate || 0;
    const taxAmount = baseAmount * taxRate / (1 + taxRate);
    const priceWithoutTax = baseAmount - taxAmount;

    return {
      basePrice: { amount: priceWithoutTax, currency },
      taxAmount: { amount: taxAmount, currency },
      totalPrice: { amount: baseAmount, currency }
    };
  } else {
    // Tax is added to the price
    const taxRate = pricing.tax.rate || 0;
    const taxAmount = baseAmount * taxRate;
    const totalAmount = baseAmount + taxAmount;

    return {
      basePrice: { amount: baseAmount, currency },
      taxAmount: { amount: taxAmount, currency },
      totalPrice: { amount: totalAmount, currency }
    };
  }
}

// Export utility functions from schema
export {
  // Schema utilities (re-exported from schema)
  isValidPricingType,
  isValidPricingStatus,
  isPricingCurrentlyValid,
  getEffectivePriceForQuantity,
  getBulkPricingTier,
  calculateDiscountPercentage,
  isValidMoney,
  isValidTaxInfo,
  generatePricingId,
  validatePricingObject
};
