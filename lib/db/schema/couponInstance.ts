import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { CouponInstance } from '@/lib/types';

// Extract enum types from the MACH interface
type CouponInstanceStatus = "active" | "used" | "expired" | "disabled" | "reserved";
type CouponInstanceType = "single_use" | "multi_use" | "unlimited";

export const couponInstances = sqliteTable('coupon_instances', {
  // Core identification - MUST fields
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  promotionId: text('promotion_id').notNull(),

  // Status and type - SHOULD fields
  status: text('status', { 
    enum: ['active', 'used', 'expired', 'disabled', 'reserved'] 
  }).default('active'),
  type: text('type', { 
    enum: ['single_use', 'multi_use', 'unlimited'] 
  }).default('single_use'),

  // External references - SHOULD (stored as JSON)
  externalReferences: text('external_references', { mode: 'json' }).$type<Record<string, string>>(),

  // Timestamps - SHOULD fields
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),

  // Assignment and validity - RECOMMENDED/COULD fields
  assignedTo: text('assigned_to'), // Customer ID or segment
  validFrom: text('valid_from'), // ISO 8601 timestamp
  validTo: text('valid_to'), // ISO 8601 timestamp

  // Usage tracking - SHOULD/RECOMMENDED fields
  usageCount: integer('usage_count').default(0).notNull(),
  usageLimit: integer('usage_limit'),
  lastUsedAt: text('last_used_at'), // ISO 8601 timestamp
  lastUsedBy: text('last_used_by'), // Customer ID

  // Generation tracking - COULD field
  generationBatch: text('generation_batch'),

  // Extensions - RECOMMENDED (stored as JSON)
  extensions: text('extensions', { mode: 'json' }).$type<Record<string, any>>(),
});

// Type definitions for database operations
export type InsertCouponInstance = typeof couponInstances.$inferInsert;
export type SelectCouponInstance = typeof couponInstances.$inferSelect;

// Helper: convert DB record to MACH CouponInstance
export function deserializeCouponInstance(record: SelectCouponInstance): CouponInstance {
  return {
    id: record.id,
    code: record.code,
    promotion_id: record.promotionId,
    status: record.status as CouponInstanceStatus || 'active',
    type: record.type as CouponInstanceType || 'single_use',
    external_references: record.externalReferences || {},
    created_at: record.createdAt || undefined,
    updated_at: record.updatedAt || undefined,
    assigned_to: record.assignedTo || undefined,
    valid_from: record.validFrom || undefined,
    valid_to: record.validTo || undefined,
    usage_count: record.usageCount,
    usage_limit: record.usageLimit || undefined,
    last_used_at: record.lastUsedAt || undefined,
    last_used_by: record.lastUsedBy || undefined,
    generation_batch: record.generationBatch || undefined,
    extensions: record.extensions || {},
  };
}

// Helper: convert MACH CouponInstance to DB insert format
export function serializeCouponInstance(coupon: CouponInstance): InsertCouponInstance {
  return {
    id: coupon.id,
    code: coupon.code,
    promotionId: coupon.promotion_id,
    status: coupon.status,
    type: coupon.type,
    externalReferences: coupon.external_references,
    createdAt: coupon.created_at,
    updatedAt: coupon.updated_at,
    assignedTo: coupon.assigned_to,
    validFrom: coupon.valid_from,
    validTo: coupon.valid_to,
    usageCount: coupon.usage_count || 0,
    usageLimit: coupon.usage_limit,
    lastUsedAt: coupon.last_used_at,
    lastUsedBy: coupon.last_used_by,
    generationBatch: coupon.generation_batch,
    extensions: coupon.extensions,
  };
}

// Utility functions for common operations
export function createCouponInstanceCode(prefix: string, length: number = 8): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${prefix}-${code}`;
}

export function isCouponInstanceExpired(couponInstance: CouponInstance): boolean {
  if (!couponInstance.valid_to) return false;
  return new Date(couponInstance.valid_to) < new Date();
}

export function isCouponInstanceActive(couponInstance: CouponInstance): boolean {
  const now = new Date();
  
  // Check status
  if (couponInstance.status !== 'active') return false;
  
  // Check validity window
  if (couponInstance.valid_from && new Date(couponInstance.valid_from) > now) return false;
  if (couponInstance.valid_to && new Date(couponInstance.valid_to) < now) return false;
  
  // Check usage limits
  if (couponInstance.type === 'single_use' && (couponInstance.usage_count || 0) > 0) return false;
  if (couponInstance.usage_limit && (couponInstance.usage_count || 0) >= couponInstance.usage_limit) return false;
  
  return true;
}

export function canCouponInstanceBeUsedBy(couponInstance: CouponInstance, customerId: string): boolean {
  if (!isCouponInstanceActive(couponInstance)) return false;
  
  // Check assignment
  if (couponInstance.assigned_to && couponInstance.assigned_to !== customerId) {
    // Could be assigned to a segment - this would require segment membership check
    // For now, we'll assume direct customer assignment
    return false;
  }
  
  return true;
}
