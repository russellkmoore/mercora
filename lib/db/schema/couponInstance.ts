import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { MACHCouponInstance } from '../../types/mach/CouponInstance.js';

// Extract enum types from the MACH interface
type MACHCouponInstanceStatus = "active" | "used" | "expired" | "disabled" | "reserved";
type MACHCouponInstanceType = "single_use" | "multi_use" | "unlimited";

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

// Transform functions to/from MACH format
export function transformToMACHCouponInstance(dbCouponInstance: SelectCouponInstance): MACHCouponInstance {
  return {
    id: dbCouponInstance.id,
    code: dbCouponInstance.code,
    promotion_id: dbCouponInstance.promotionId,
    status: (dbCouponInstance.status as MACHCouponInstanceStatus) || 'active',
    type: (dbCouponInstance.type as MACHCouponInstanceType) || 'single_use',
    external_references: dbCouponInstance.externalReferences || {},
    created_at: dbCouponInstance.createdAt || undefined,
    updated_at: dbCouponInstance.updatedAt || undefined,
    assigned_to: dbCouponInstance.assignedTo || undefined,
    valid_from: dbCouponInstance.validFrom || undefined,
    valid_to: dbCouponInstance.validTo || undefined,
    usage_count: dbCouponInstance.usageCount,
    usage_limit: dbCouponInstance.usageLimit || undefined,
    last_used_at: dbCouponInstance.lastUsedAt || undefined,
    last_used_by: dbCouponInstance.lastUsedBy || undefined,
    generation_batch: dbCouponInstance.generationBatch || undefined,
    extensions: dbCouponInstance.extensions || {},
  };
}

export function transformFromMACHCouponInstance(machCouponInstance: MACHCouponInstance): InsertCouponInstance {
  return {
    id: machCouponInstance.id,
    code: machCouponInstance.code,
    promotionId: machCouponInstance.promotion_id,
    status: machCouponInstance.status,
    type: machCouponInstance.type,
    externalReferences: machCouponInstance.external_references,
    createdAt: machCouponInstance.created_at,
    updatedAt: machCouponInstance.updated_at,
    assignedTo: machCouponInstance.assigned_to,
    validFrom: machCouponInstance.valid_from,
    validTo: machCouponInstance.valid_to,
    usageCount: machCouponInstance.usage_count || 0,
    usageLimit: machCouponInstance.usage_limit,
    lastUsedAt: machCouponInstance.last_used_at,
    lastUsedBy: machCouponInstance.last_used_by,
    generationBatch: machCouponInstance.generation_batch,
    extensions: machCouponInstance.extensions,
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

export function isCouponInstanceExpired(couponInstance: MACHCouponInstance): boolean {
  if (!couponInstance.valid_to) return false;
  return new Date(couponInstance.valid_to) < new Date();
}

export function isCouponInstanceActive(couponInstance: MACHCouponInstance): boolean {
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

export function canCouponInstanceBeUsedBy(couponInstance: MACHCouponInstance, customerId: string): boolean {
  if (!isCouponInstanceActive(couponInstance)) return false;
  
  // Check assignment
  if (couponInstance.assigned_to && couponInstance.assigned_to !== customerId) {
    // Could be assigned to a segment - this would require segment membership check
    // For now, we'll assume direct customer assignment
    return false;
  }
  
  return true;
}
