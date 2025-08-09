/**
 * MACH Alliance Open Data Model - CouponInstance Model
 * 
 * Business logic and CRUD operations for coupon instance management
 * following the MACH Alliance CouponInstance specification.
 * 
 * Based on official specification:
 * https://github.com/machalliance/standards/blob/main/models/entities/promotion/coupon-instance.md
 */

import { getDbAsync } from "@/lib/db";
import { couponInstances, transformToMACHCouponInstance, transformFromMACHCouponInstance } from "@/lib/db/schema/couponInstance";
import { eq, desc, asc, like, or, and, inArray, isNull, isNotNull, sql, gte, lte } from "drizzle-orm";
import type { MACHCouponInstance, MACHUsageRecord } from "@/lib/types/mach/CouponInstance";

// CouponInstance creation input type
export interface CreateCouponInstanceInput {
  // Required fields
  id?: string; // Will be auto-generated if not provided
  code: string; // The actual coupon code string
  promotion_id: string; // Reference to parent Promotion entity
  
  // Optional status and type
  status?: "active" | "used" | "expired" | "disabled" | "reserved";
  type?: "single_use" | "multi_use" | "unlimited";
  external_references?: Record<string, string>; // Cross-system IDs
  
  // Assignment and validity
  assigned_to?: string; // Customer ID or segment
  valid_from?: string; // ISO 8601 start timestamp
  valid_to?: string; // ISO 8601 end timestamp
  
  // Usage tracking
  usage_count?: number; // Number of times used
  usage_limit?: number; // Maximum allowed uses
  last_used_at?: string; // ISO 8601 timestamp of last redemption
  last_used_by?: string; // Customer ID of last user
  
  // Generation tracking
  generation_batch?: string; // Batch identifier for bulk generation
  
  // Extensions
  extensions?: Record<string, any>;
}

// CouponInstance update input type
export interface UpdateCouponInstanceInput extends Partial<CreateCouponInstanceInput> {
  id: string;
}

// CouponInstance filter options
export interface CouponInstanceFilters {
  status?: "active" | "used" | "expired" | "disabled" | "reserved" | ("active" | "used" | "expired" | "disabled" | "reserved")[];
  type?: "single_use" | "multi_use" | "unlimited" | ("single_use" | "multi_use" | "unlimited")[];
  promotion_id?: string | string[]; // Filter by parent promotion
  assigned_to?: string | string[]; // Filter by assignment
  code?: string; // Exact code match
  code_pattern?: string; // Pattern matching for codes
  valid_from_after?: string; // Valid from after date
  valid_from_before?: string; // Valid from before date
  valid_to_after?: string; // Valid to after date
  valid_to_before?: string; // Valid to before date
  is_valid?: boolean; // Currently valid (active status + date range)
  is_expired?: boolean; // Currently expired
  is_used?: boolean; // Has been used
  can_be_used?: boolean; // Can currently be used
  usage_count_min?: number; // Minimum usage count
  usage_count_max?: number; // Maximum usage count
  has_usage_limit?: boolean; // Has usage limit set
  generation_batch?: string | string[]; // Filter by generation batch
  last_used_after?: string; // Last used after date
  last_used_before?: string; // Last used before date
  last_used_by?: string | string[]; // Filter by last user
  search?: string; // General text search
  limit?: number;
  offset?: number;
  sortBy?: 'code' | 'created_at' | 'updated_at' | 'valid_from' | 'valid_to' | 'usage_count' | 'last_used_at';
  sortOrder?: 'asc' | 'desc';
}

// Bulk generation options
export interface BulkGenerationOptions {
  promotion_id: string;
  count: number; // Number of coupons to generate
  code_prefix?: string; // Prefix for generated codes
  code_length?: number; // Length of random part (default: 8)
  type?: "single_use" | "multi_use" | "unlimited";
  usage_limit?: number; // Usage limit for each coupon
  valid_from?: string; // ISO 8601 start timestamp
  valid_to?: string; // ISO 8601 end timestamp
  assigned_to?: string; // Bulk assignment
  batch_id?: string; // Custom batch ID
  extensions?: Record<string, any>; // Shared extensions for all coupons
}

// Coupon validation result
export interface CouponValidationResult {
  isValid: boolean;
  canBeUsed: boolean;
  errors: string[];
  warnings: string[];
  coupon?: MACHCouponInstance;
  usageInfo?: {
    timesUsed: number;
    remainingUses: number | 'unlimited';
    lastUsedAt?: string;
    lastUsedBy?: string;
  };
}

// Usage tracking result
export interface CouponUsageResult {
  success: boolean;
  coupon: MACHCouponInstance;
  usageRecord?: MACHUsageRecord;
  error?: string;
}

/**
 * Generate a unique coupon instance ID
 */
function generateCouponInstanceId(): string {
  return `coupi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a random coupon code
 */
function generateCouponCode(prefix = 'COUPON', length = 8): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${prefix}-${code}`;
}

/**
 * Generate batch ID for bulk generation
 */
function generateBatchId(prefix = 'BATCH'): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

/**
 * Validate coupon instance data according to MACH Alliance standards
 */
export function validateCouponInstance(coupon: Partial<MACHCouponInstance>): CouponValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required field validation
  if (!coupon.id) {
    errors.push("id is required");
  }
  
  if (!coupon.code) {
    errors.push("code is required");
  } else if (!/^[A-Z0-9-]+$/.test(coupon.code)) {
    warnings.push("code should only contain uppercase letters, numbers, and hyphens");
  }
  
  if (!coupon.promotion_id) {
    errors.push("promotion_id is required");
  }
  
  // Usage validation
  if (coupon.usage_count !== undefined && coupon.usage_count < 0) {
    errors.push("usage_count must be non-negative");
  }
  
  if (coupon.usage_limit !== undefined && coupon.usage_limit < 1) {
    errors.push("usage_limit must be at least 1");
  }
  
  if (coupon.usage_count && coupon.usage_limit && coupon.usage_count > coupon.usage_limit) {
    errors.push("usage_count cannot exceed usage_limit");
  }
  
  // Date validation
  if (coupon.valid_from && coupon.valid_to) {
    const from = new Date(coupon.valid_from);
    const to = new Date(coupon.valid_to);
    if (from >= to) {
      errors.push("valid_from must be before valid_to");
    }
  }
  
  // Type-specific validation
  if (coupon.type === 'single_use' && coupon.usage_limit && coupon.usage_limit > 1) {
    warnings.push("single_use coupons typically have usage_limit of 1");
  }
  
  const now = new Date();
  const isValid = errors.length === 0;
  const canBeUsed = isValid && 
    (coupon.status === 'active' || coupon.status === undefined) &&
    (!coupon.valid_from || new Date(coupon.valid_from) <= now) &&
    (!coupon.valid_to || new Date(coupon.valid_to) > now) &&
    (!coupon.usage_limit || (coupon.usage_count || 0) < coupon.usage_limit);
  
  return {
    isValid,
    canBeUsed,
    errors,
    warnings,
    usageInfo: coupon.usage_count !== undefined ? {
      timesUsed: coupon.usage_count,
      remainingUses: coupon.usage_limit ? coupon.usage_limit - coupon.usage_count : 'unlimited',
      lastUsedAt: coupon.last_used_at,
      lastUsedBy: coupon.last_used_by
    } : undefined
  };
}

/**
 * Create a new coupon instance
 */
export async function createCouponInstance(input: CreateCouponInstanceInput): Promise<MACHCouponInstance> {
  const id = input.id || generateCouponInstanceId();
  const now = new Date().toISOString();
  
  const machCouponInstance: MACHCouponInstance = {
    id,
    code: input.code,
    promotion_id: input.promotion_id,
    status: input.status ?? "active",
    type: input.type ?? "single_use",
    external_references: input.external_references,
    created_at: now,
    updated_at: now,
    assigned_to: input.assigned_to,
    valid_from: input.valid_from,
    valid_to: input.valid_to,
    usage_count: input.usage_count ?? 0,
    usage_limit: input.usage_limit,
    last_used_at: input.last_used_at,
    last_used_by: input.last_used_by,
    generation_batch: input.generation_batch,
    extensions: input.extensions,
  };
  
  // Validate before creating
  const validation = validateCouponInstance(machCouponInstance);
  if (!validation.isValid) {
    throw new Error(`CouponInstance validation failed: ${validation.errors.join(', ')}`);
  }
  
  const db = await getDbAsync();
  const record = transformFromMACHCouponInstance(machCouponInstance);
  const [created] = await db.insert(couponInstances).values(record).returning();
  return transformToMACHCouponInstance(created);
}

/**
 * Get a coupon instance by ID
 */
export async function getCouponInstance(id: string): Promise<MACHCouponInstance | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(couponInstances)
    .where(eq(couponInstances.id, id))
    .limit(1);
    
  if (!record) return null;
  return transformToMACHCouponInstance(record);
}

/**
 * Get a coupon instance by code
 */
export async function getCouponInstanceByCode(code: string): Promise<MACHCouponInstance | null> {
  const db = await getDbAsync();
  
  const [record] = await db
    .select()
    .from(couponInstances)
    .where(eq(couponInstances.code, code))
    .limit(1);
    
  if (!record) return null;
  return transformToMACHCouponInstance(record);
}

/**
 * List coupon instances with filtering and pagination
 */
export async function listCouponInstances(filters: CouponInstanceFilters = {}): Promise<MACHCouponInstance[]> {
  const db = await getDbAsync();
  
  let query = db.select().from(couponInstances);
  
  // Build where conditions
  const conditions: any[] = [];
  
  // Status filter
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(couponInstances.status, filters.status));
    } else {
      conditions.push(eq(couponInstances.status, filters.status));
    }
  }
  
  // Type filter
  if (filters.type) {
    if (Array.isArray(filters.type)) {
      conditions.push(inArray(couponInstances.type, filters.type));
    } else {
      conditions.push(eq(couponInstances.type, filters.type));
    }
  }
  
  // Promotion filter
  if (filters.promotion_id) {
    if (Array.isArray(filters.promotion_id)) {
      conditions.push(inArray(couponInstances.promotionId, filters.promotion_id));
    } else {
      conditions.push(eq(couponInstances.promotionId, filters.promotion_id));
    }
  }
  
  // Assignment filter
  if (filters.assigned_to) {
    if (Array.isArray(filters.assigned_to)) {
      conditions.push(inArray(couponInstances.assignedTo, filters.assigned_to));
    } else {
      conditions.push(eq(couponInstances.assignedTo, filters.assigned_to));
    }
  }
  
  // Code filters
  if (filters.code) {
    conditions.push(eq(couponInstances.code, filters.code));
  }
  
  if (filters.code_pattern) {
    conditions.push(like(couponInstances.code, filters.code_pattern));
  }
  
  // Date range filters
  if (filters.valid_from_after) {
    conditions.push(gte(couponInstances.validFrom, filters.valid_from_after));
  }
  if (filters.valid_from_before) {
    conditions.push(lte(couponInstances.validFrom, filters.valid_from_before));
  }
  if (filters.valid_to_after) {
    conditions.push(gte(couponInstances.validTo, filters.valid_to_after));
  }
  if (filters.valid_to_before) {
    conditions.push(lte(couponInstances.validTo, filters.valid_to_before));
  }
  
  // Usage count filters
  if (filters.usage_count_min !== undefined) {
    conditions.push(gte(couponInstances.usageCount, filters.usage_count_min));
  }
  if (filters.usage_count_max !== undefined) {
    conditions.push(lte(couponInstances.usageCount, filters.usage_count_max));
  }
  
  // Usage limit filter
  if (filters.has_usage_limit !== undefined) {
    if (filters.has_usage_limit) {
      conditions.push(isNotNull(couponInstances.usageLimit));
    } else {
      conditions.push(isNull(couponInstances.usageLimit));
    }
  }
  
  // Generation batch filter
  if (filters.generation_batch) {
    if (Array.isArray(filters.generation_batch)) {
      conditions.push(inArray(couponInstances.generationBatch, filters.generation_batch));
    } else {
      conditions.push(eq(couponInstances.generationBatch, filters.generation_batch));
    }
  }
  
  // Last used filters
  if (filters.last_used_after) {
    conditions.push(gte(couponInstances.lastUsedAt, filters.last_used_after));
  }
  if (filters.last_used_before) {
    conditions.push(lte(couponInstances.lastUsedAt, filters.last_used_before));
  }
  if (filters.last_used_by) {
    if (Array.isArray(filters.last_used_by)) {
      conditions.push(inArray(couponInstances.lastUsedBy, filters.last_used_by));
    } else {
      conditions.push(eq(couponInstances.lastUsedBy, filters.last_used_by));
    }
  }
  
  // Complex status filters
  if (filters.is_valid !== undefined || filters.is_expired !== undefined || filters.is_used !== undefined) {
    const now = new Date().toISOString();
    
    if (filters.is_valid) {
      conditions.push(
        and(
          eq(couponInstances.status, "active"),
          or(isNull(couponInstances.validFrom), lte(couponInstances.validFrom, now)),
          or(isNull(couponInstances.validTo), gte(couponInstances.validTo, now))
        )
      );
    }
    
    if (filters.is_expired) {
      conditions.push(
        or(
          eq(couponInstances.status, "expired"),
          and(
            isNotNull(couponInstances.validTo),
            sql`${couponInstances.validTo} < ${now}`
          )
        )
      );
    }
    
    if (filters.is_used) {
      conditions.push(
        or(
          eq(couponInstances.status, "used"),
          sql`${couponInstances.usageCount} > 0`
        )
      );
    }
  }
  
  // Search filter
  if (filters.search) {
    conditions.push(
      or(
        like(couponInstances.code, `%${filters.search}%`),
        like(couponInstances.promotionId, `%${filters.search}%`),
        like(couponInstances.assignedTo, `%${filters.search}%`),
        like(couponInstances.generationBatch, `%${filters.search}%`)
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  // Add sorting
  const sortField = filters.sortBy || 'created_at';
  const sortDir = filters.sortOrder || 'desc';
  
  switch (sortField) {
    case 'code':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.code) : desc(couponInstances.code)) as typeof query;
      break;
    case 'created_at':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.createdAt) : desc(couponInstances.createdAt)) as typeof query;
      break;
    case 'updated_at':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.updatedAt) : desc(couponInstances.updatedAt)) as typeof query;
      break;
    case 'valid_from':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.validFrom) : desc(couponInstances.validFrom)) as typeof query;
      break;
    case 'valid_to':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.validTo) : desc(couponInstances.validTo)) as typeof query;
      break;
    case 'usage_count':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.usageCount) : desc(couponInstances.usageCount)) as typeof query;
      break;
    case 'last_used_at':
      query = query.orderBy(sortDir === 'asc' ? asc(couponInstances.lastUsedAt) : desc(couponInstances.lastUsedAt)) as typeof query;
      break;
    default:
      query = query.orderBy(desc(couponInstances.createdAt)) as typeof query;
  }
  
  // Add pagination
  if (filters.limit) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters.offset) {
    query = query.offset(filters.offset) as typeof query;
  }
  
  const records = await query;
  return records.map(record => transformToMACHCouponInstance(record));
}

/**
 * Get coupon instances count with filters
 */
export async function getCouponInstancesCount(filters: Omit<CouponInstanceFilters, 'limit' | 'offset' | 'sortBy' | 'sortOrder'> = {}): Promise<number> {
  const coupons = await listCouponInstances(filters);
  return coupons.length;
}

/**
 * Update an existing coupon instance
 */
export async function updateCouponInstance(id: string, input: Partial<CreateCouponInstanceInput>): Promise<MACHCouponInstance | null> {
  const db = await getDbAsync();
  
  // Get existing coupon first
  const existing = await getCouponInstance(id);
  if (!existing) return null;
  
  // Create updated coupon object
  const updated: MACHCouponInstance = {
    ...existing,
    ...input,
    id, // Ensure ID stays the same
    updated_at: new Date().toISOString(),
  };
  
  // Validate before updating
  const validation = validateCouponInstance(updated);
  if (!validation.isValid) {
    throw new Error(`CouponInstance validation failed: ${validation.errors.join(', ')}`);
  }
  
  const record = transformFromMACHCouponInstance(updated);
  await db.update(couponInstances).set(record).where(eq(couponInstances.id, id));
  
  return getCouponInstance(id);
}

/**
 * Delete a coupon instance (soft delete by setting status to disabled)
 */
export async function deleteCouponInstance(id: string): Promise<boolean> {
  const result = await updateCouponInstance(id, { status: "disabled" });
  return !!result;
}

/**
 * Hard delete a coupon instance (permanent removal)
 */
export async function hardDeleteCouponInstance(id: string): Promise<boolean> {
  const db = await getDbAsync();
  
  await db.delete(couponInstances).where(eq(couponInstances.id, id));
  return true;
}

/**
 * Validate a coupon code for usage
 */
export async function validateCouponCode(code: string, customerId?: string): Promise<CouponValidationResult> {
  const coupon = await getCouponInstanceByCode(code);
  
  if (!coupon) {
    return {
      isValid: false,
      canBeUsed: false,
      errors: ['Coupon code not found'],
      warnings: []
    };
  }
  
  const validation = validateCouponInstance(coupon);
  
  // Additional customer-specific validation
  if (customerId && coupon.assigned_to && coupon.assigned_to !== customerId) {
    validation.errors.push('Coupon is assigned to a different customer');
    validation.canBeUsed = false;
  }
  
  return {
    ...validation,
    coupon
  };
}

/**
 * Use a coupon (record usage and update counts)
 */
export async function useCoupon(code: string, customerId: string, orderId?: string, discountAmount?: any, channel?: string): Promise<CouponUsageResult> {
  const validation = await validateCouponCode(code, customerId);
  
  if (!validation.canBeUsed || !validation.coupon) {
    return {
      success: false,
      coupon: validation.coupon!,
      error: validation.errors.join(', ')
    };
  }
  
  const coupon = validation.coupon;
  const now = new Date().toISOString();
  const newUsageCount = (coupon.usage_count || 0) + 1;
  
  // Determine new status
  let newStatus = coupon.status;
  if (coupon.type === 'single_use' || (coupon.usage_limit && newUsageCount >= coupon.usage_limit)) {
    newStatus = 'used';
  }
  
  // Update coupon instance
  const updatedCoupon = await updateCouponInstance(coupon.id, {
    status: newStatus,
    usage_count: newUsageCount,
    last_used_at: now,
    last_used_by: customerId
  });
  
  if (!updatedCoupon) {
    return {
      success: false,
      coupon,
      error: 'Failed to update coupon usage'
    };
  }
  
  // Create usage record
  const usageRecord: MACHUsageRecord = {
    timestamp: now,
    customer_id: customerId,
    order_id: orderId,
    discount_amount: discountAmount,
    channel: channel
  };
  
  return {
    success: true,
    coupon: updatedCoupon,
    usageRecord
  };
}

/**
 * Generate bulk coupon instances
 */
export async function generateBulkCouponInstances(options: BulkGenerationOptions): Promise<MACHCouponInstance[]> {
  const {
    promotion_id,
    count,
    code_prefix = 'BULK',
    code_length = 8,
    type = 'single_use',
    usage_limit,
    valid_from,
    valid_to,
    assigned_to,
    batch_id,
    extensions
  } = options;
  
  if (count <= 0 || count > 10000) {
    throw new Error('Bulk generation count must be between 1 and 10,000');
  }
  
  const batchId = batch_id || generateBatchId(code_prefix);
  const generatedCoupons: MACHCouponInstance[] = [];
  
  for (let i = 0; i < count; i++) {
    const code = generateCouponCode(code_prefix, code_length);
    
    const coupon = await createCouponInstance({
      code,
      promotion_id,
      type,
      usage_limit,
      valid_from,
      valid_to,
      assigned_to,
      generation_batch: batchId,
      extensions: {
        ...extensions,
        bulk_generation: {
          batch_size: count,
          batch_sequence: i + 1,
          algorithm: 'secure_random',
          code_pattern: `${code_prefix}-{${code_length}_alphanumeric}`,
          generation_timestamp: new Date().toISOString()
        }
      }
    });
    
    generatedCoupons.push(coupon);
  }
  
  return generatedCoupons;
}

/**
 * Get coupon instances by promotion
 */
export async function getCouponInstancesByPromotion(promotionId: string): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ promotion_id: promotionId });
}

/**
 * Get coupon instances by customer
 */
export async function getCouponInstancesByCustomer(customerId: string): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ assigned_to: customerId });
}

/**
 * Get active coupon instances
 */
export async function getActiveCouponInstances(): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ status: "active", is_valid: true });
}

/**
 * Get used coupon instances
 */
export async function getUsedCouponInstances(): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ status: "used" });
}

/**
 * Get expired coupon instances
 */
export async function getExpiredCouponInstances(): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ is_expired: true });
}

/**
 * Get coupon instances by generation batch
 */
export async function getCouponInstancesByBatch(batchId: string): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ generation_batch: batchId });
}

/**
 * Search coupon instances by text
 */
export async function searchCouponInstances(searchTerm: string, limit?: number): Promise<MACHCouponInstance[]> {
  return listCouponInstances({ 
    search: searchTerm, 
    limit: limit || 50 
  });
}

/**
 * Get coupon instance usage statistics
 */
export async function getCouponInstanceStats(couponId: string): Promise<{
  coupon: MACHCouponInstance;
  totalUses: number;
  remainingUses: number | 'unlimited';
  isExpired: boolean;
  isActive: boolean;
  canBeUsed: boolean;
}> {
  const coupon = await getCouponInstance(couponId);
  if (!coupon) {
    throw new Error('Coupon instance not found');
  }
  
  const validation = validateCouponInstance(coupon);
  
  return {
    coupon,
    totalUses: coupon.usage_count || 0,
    remainingUses: coupon.usage_limit ? 
      Math.max(0, coupon.usage_limit - (coupon.usage_count || 0)) : 
      'unlimited',
    isExpired: coupon.status === 'expired' || (coupon.valid_to ? new Date(coupon.valid_to) < new Date() : false),
    isActive: coupon.status === 'active',
    canBeUsed: validation.canBeUsed
  };
}

/**
 * Expire coupon instances that are past their valid_to date
 */
export async function expireOldCouponInstances(): Promise<number> {
  const now = new Date().toISOString();
  const expiredCoupons = await listCouponInstances({
    status: "active",
    valid_to_before: now
  });
  
  let expiredCount = 0;
  
  for (const coupon of expiredCoupons) {
    await updateCouponInstance(coupon.id, { status: "expired" });
    expiredCount++;
  }
  
  return expiredCount;
}
