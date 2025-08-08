/**
 * MACH Alliance Promotion Entity - Database Schema
 * Drizzle ORM schema for MACH compliant Promotion entity
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { 
  MACHPromotion,
  MACHPromotionRules,
  MACHCondition,
  MACHAction,
  MACHPromotionCodes,
  MACHUsageLimits,
  MACHEligibility,
  MACHDiscountTier
} from '../../types/mach/Promotion.js';

// Main promotions table
export const promotions = sqliteTable('promotions', {
  id: text('id').primaryKey(),
  name: text('name', { mode: 'json' }).$type<string | Record<string, string>>().notNull(),
  type: text('type', { enum: ['cart', 'product', 'shipping'] }).notNull(),
  rules: text('rules', { mode: 'json' }).$type<MACHPromotionRules>().notNull(),
  status: text('status', { enum: ['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'] }).default('draft'),
  description: text('description', { mode: 'json' }).$type<string | Record<string, string>>(),
  slug: text('slug'),
  external_references: text('external_references', { mode: 'json' }).$type<Record<string, string>>(),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
  valid_from: text('valid_from'),
  valid_to: text('valid_to'),
  activation_method: text('activation_method', { enum: ['automatic', 'code', 'customer_specific', 'link'] }).default('automatic'),
  codes: text('codes', { mode: 'json' }).$type<MACHPromotionCodes>(),
  usage_limits: text('usage_limits', { mode: 'json' }).$type<MACHUsageLimits>(),
  eligibility: text('eligibility', { mode: 'json' }).$type<MACHEligibility>(),
  priority: integer('priority').default(100),
  stackable: integer('stackable').default(0),
  extensions: text('extensions', { mode: 'json' }).$type<Record<string, any>>()
});

/**
 * Schema validation and transformation utilities
 */

export function validatePromotion(data: any): data is MACHPromotion {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    (typeof data.name === 'string' || (typeof data.name === 'object' && data.name !== null)) &&
    typeof data.type === 'string' &&
    ['cart', 'product', 'shipping'].includes(data.type) &&
    typeof data.rules === 'object' &&
    data.rules !== null &&
    Array.isArray(data.rules.actions) &&
    data.rules.actions.length > 0
  );
}

export function validatePromotionRules(data: any): data is MACHPromotionRules {
  return (
    typeof data === 'object' &&
    Array.isArray(data.actions) &&
    data.actions.length > 0 &&
    data.actions.every((action: any) => validateAction(action)) &&
    (!data.conditions || (Array.isArray(data.conditions) && data.conditions.every((condition: any) => validateCondition(condition))))
  );
}

export function validateCondition(data: any): data is MACHCondition {
  const validTypes = [
    'cart_minimum', 'cart_subtotal', 'cart_quantity',
    'product_category', 'product_sku', 'product_brand',
    'customer_segment', 'customer_type', 'first_purchase',
    'shipping_method', 'shipping_zone',
    'payment_method', 'coupon_code',
    'date_range', 'time_range', 'day_of_week'
  ];

  const validOperators = ['equals', 'not_equals', 'in', 'not_in', 'gte', 'gt', 'lte', 'lt', 'contains'];

  return (
    typeof data === 'object' &&
    validTypes.includes(data.type) &&
    validOperators.includes(data.operator) &&
    data.value !== undefined
  );
}

export function validateAction(data: any): data is MACHAction {
  const validTypes = [
    'percentage_discount', 'fixed_discount', 'fixed_price',
    'item_percentage_discount', 'item_fixed_discount',
    'shipping_percentage_discount', 'shipping_fixed_discount',
    'bogo_discount', 'gift_item', 'tiered_discount'
  ];

  return (
    typeof data === 'object' &&
    validTypes.includes(data.type)
  );
}

export function transformPromotionForDB(promotion: MACHPromotion) {
  return {
    ...promotion,
    stackable: promotion.stackable ? 1 : 0,
    created_at: promotion.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Promotion utility functions
 */

export function isActivePromotion(promotion: MACHPromotion): boolean {
  return promotion.status === 'active' || promotion.status === undefined;
}

export function isScheduledPromotion(promotion: MACHPromotion): boolean {
  return promotion.status === 'scheduled';
}

export function isDraftPromotion(promotion: MACHPromotion): boolean {
  return promotion.status === 'draft';
}

export function isExpiredPromotion(promotion: MACHPromotion): boolean {
  return promotion.status === 'expired';
}

export function isCartPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === 'cart';
}

export function isProductPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === 'product';
}

export function isShippingPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === 'shipping';
}

export function isCodeBasedPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === 'code';
}

export function isAutomaticPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === 'automatic' || promotion.activation_method === undefined;
}

export function isCustomerSpecificPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === 'customer_specific';
}

export function isLinkBasedPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === 'link';
}

export function isStackablePromotion(promotion: MACHPromotion): boolean {
  return promotion.stackable === true;
}

export function isPromotionValid(promotion: MACHPromotion, date?: Date): boolean {
  const checkDate = date || new Date();
  const validFrom = promotion.valid_from ? new Date(promotion.valid_from) : null;
  const validTo = promotion.valid_to ? new Date(promotion.valid_to) : null;
  
  if (validFrom && checkDate < validFrom) return false;
  if (validTo && checkDate > validTo) return false;
  
  return isActivePromotion(promotion);
}

export function hasUsageLimits(promotion: MACHPromotion): boolean {
  return promotion.usage_limits !== undefined && promotion.usage_limits !== null;
}

export function hasEligibilityRestrictions(promotion: MACHPromotion): boolean {
  return promotion.eligibility !== undefined && promotion.eligibility !== null;
}

export function hasConditions(promotion: MACHPromotion): boolean {
  return promotion.rules.conditions !== undefined && 
         promotion.rules.conditions !== null && 
         promotion.rules.conditions.length > 0;
}

export function getPromotionPriority(promotion: MACHPromotion): number {
  return promotion.priority || 100;
}

export function isHighPriorityPromotion(promotion: MACHPromotion, threshold: number = 500): boolean {
  return getPromotionPriority(promotion) >= threshold;
}

export function getTotalUsesRemaining(promotion: MACHPromotion): number | null {
  if (!promotion.usage_limits || !promotion.usage_limits.uses_remaining) {
    return null;
  }
  return promotion.usage_limits.uses_remaining;
}

export function canBeUsedByCustomer(
  promotion: MACHPromotion, 
  customerType: string, 
  customerSegments?: string[]
): boolean {
  if (!promotion.eligibility) return true;

  // Check customer type eligibility
  if (promotion.eligibility.customer_types) {
    if (!promotion.eligibility.customer_types.includes('all') && 
        !promotion.eligibility.customer_types.includes(customerType as any)) {
      return false;
    }
  }

  // Check customer segment eligibility
  if (promotion.eligibility.customer_segments && customerSegments) {
    const hasEligibleSegment = promotion.eligibility.customer_segments.some(
      segment => customerSegments.includes(segment)
    );
    if (!hasEligibleSegment) return false;
  }

  return true;
}

export function canBeUsedInChannel(promotion: MACHPromotion, channel: string): boolean {
  if (!promotion.eligibility || !promotion.eligibility.channels) {
    return true;
  }
  return promotion.eligibility.channels.includes(channel as any);
}

export function canBeUsedInRegion(promotion: MACHPromotion, region: string): boolean {
  if (!promotion.eligibility) return true;

  // Check excluded regions first
  if (promotion.eligibility.exclude_regions && 
      promotion.eligibility.exclude_regions.includes(region)) {
    return false;
  }

  // Check eligible regions
  if (promotion.eligibility.regions) {
    if (promotion.eligibility.regions.includes('global')) {
      return true;
    }
    return promotion.eligibility.regions.includes(region);
  }

  return true;
}

export function getActionsByType(promotion: MACHPromotion, actionType: string): MACHAction[] {
  return promotion.rules.actions.filter(action => action.type === actionType);
}

export function getConditionsByType(promotion: MACHPromotion, conditionType: string): MACHCondition[] {
  if (!promotion.rules.conditions) return [];
  return promotion.rules.conditions.filter(condition => condition.type === conditionType);
}

export function hasPercentageDiscountAction(promotion: MACHPromotion): boolean {
  return promotion.rules.actions.some(action => 
    action.type === 'percentage_discount' || 
    action.type === 'item_percentage_discount' ||
    action.type === 'shipping_percentage_discount'
  );
}

export function hasFixedDiscountAction(promotion: MACHPromotion): boolean {
  return promotion.rules.actions.some(action => 
    action.type === 'fixed_discount' || 
    action.type === 'item_fixed_discount' ||
    action.type === 'shipping_fixed_discount'
  );
}

export function hasBOGOAction(promotion: MACHPromotion): boolean {
  return promotion.rules.actions.some(action => action.type === 'bogo_discount');
}

export function hasTieredDiscountAction(promotion: MACHPromotion): boolean {
  return promotion.rules.actions.some(action => action.type === 'tiered_discount');
}

export function hasCartSubtotalCondition(promotion: MACHPromotion): boolean {
  return getConditionsByType(promotion, 'cart_subtotal').length > 0;
}

export function hasProductCategoryCondition(promotion: MACHPromotion): boolean {
  return getConditionsByType(promotion, 'product_category').length > 0;
}

export function getCartMinimumAmount(promotion: MACHPromotion): number | null {
  const cartConditions = getConditionsByType(promotion, 'cart_subtotal');
  const minimumCondition = cartConditions.find(condition => 
    condition.operator === 'gte' || condition.operator === 'gt'
  );
  
  if (minimumCondition && typeof minimumCondition.value === 'object' && minimumCondition.value.amount) {
    return minimumCondition.value.amount;
  }
  
  return null;
}

export function getTargetProductCategories(promotion: MACHPromotion): string[] {
  const categoryConditions = getConditionsByType(promotion, 'product_category');
  const categories: string[] = [];
  
  for (const condition of categoryConditions) {
    if (condition.operator === 'equals' && typeof condition.value === 'string') {
      categories.push(condition.value);
    } else if (condition.operator === 'in' && Array.isArray(condition.value)) {
      categories.push(...condition.value);
    }
  }
  
  return categories;
}

export function isSingleUsePerCustomer(promotion: MACHPromotion): boolean {
  return promotion.usage_limits?.per_customer === 1;
}

export function requiresAccountLogin(promotion: MACHPromotion): boolean {
  return promotion.eligibility?.requires_account === true;
}

export function isFirstPurchaseOnly(promotion: MACHPromotion): boolean {
  const firstPurchaseConditions = getConditionsByType(promotion, 'first_purchase');
  return firstPurchaseConditions.some(condition => 
    condition.operator === 'equals' && condition.value === true
  );
}

export function getLocalizedValue(
  value: string | Record<string, string> | undefined,
  locale: string = 'en-US'
): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value[locale] || value[Object.keys(value)[0]];
}

export function isPromotionLocalized(promotion: MACHPromotion): boolean {
  return typeof promotion.name === 'object' || typeof promotion.description === 'object';
}

export function generatePromotionSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculatePromotionScore(promotion: MACHPromotion): number {
  let score = 0;
  
  // Base score for type
  if (promotion.type === 'cart') score += 10;
  else if (promotion.type === 'product') score += 8;
  else if (promotion.type === 'shipping') score += 6;
  
  // Priority weight
  score += (promotion.priority || 100) / 10;
  
  // Status weight
  if (promotion.status === 'active') score += 20;
  else if (promotion.status === 'scheduled') score += 15;
  else if (promotion.status === 'draft') score += 5;
  
  // Stackability bonus
  if (promotion.stackable) score += 5;
  
  // Complexity bonus (more conditions = higher score for sophisticated targeting)
  if (promotion.rules.conditions) {
    score += promotion.rules.conditions.length * 2;
  }
  
  // Multi-action bonus
  score += promotion.rules.actions.length * 1.5;
  
  return Math.round(score);
}

export function getPromotionValidityWindow(promotion: MACHPromotion): {
  start: Date | null;
  end: Date | null;
  isCurrentlyValid: boolean;
  daysUntilStart?: number;
  daysUntilEnd?: number;
} {
  const now = new Date();
  const start = promotion.valid_from ? new Date(promotion.valid_from) : null;
  const end = promotion.valid_to ? new Date(promotion.valid_to) : null;
  
  const isCurrentlyValid = isPromotionValid(promotion, now);
  
  let daysUntilStart: number | undefined;
  let daysUntilEnd: number | undefined;
  
  if (start && now < start) {
    daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  if (end && now < end) {
    daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return {
    start,
    end,
    isCurrentlyValid,
    daysUntilStart,
    daysUntilEnd
  };
}
