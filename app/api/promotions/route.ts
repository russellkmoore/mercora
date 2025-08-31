/**
 * Promotions API Endpoint
 * 
 * Handles CRUD operations for promotions and coupon instances
 * following MACH Alliance promotion standards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPromotions, listCouponInstances } from '@/lib/models';
import { createCouponInstance, hardDeleteCouponInstance, updateCouponInstance } from '@/lib/models/mach/couponInstance';
import { getDbAsync } from '@/lib/db';
import { promotions } from '@/lib/db/schema/promotions';
import { eq } from 'drizzle-orm';
import type { Promotion, CouponInstance } from '@/lib/types';

type InsertPromotion = typeof promotions.$inferInsert;

interface AdminPromotion {
  id: string;
  code: string;
  name: string;
  description: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  minimumAmount?: number;
  maxUses?: number;
  currentUses: number;
  validFrom: string;
  validTo: string;
  status: "active" | "inactive" | "expired";
  categories?: string[];
  products?: string[];
}

/**
 * Convert MACH Promotion to Admin format
 */
function convertToAdminFormat(promotion: Promotion, couponInstance?: CouponInstance): AdminPromotion {
  const displayName = typeof promotion.name === 'string' ? promotion.name : promotion.name.en || 'Unnamed Promotion';
  const description = typeof promotion.description === 'string' ? promotion.description || '' : promotion.description?.en || '';
  
  // Determine discount type and value from rules
  let type: "percentage" | "fixed_amount" | "free_shipping" = "percentage";
  let value = 0;
  
  if (promotion.rules.actions && promotion.rules.actions.length > 0) {
    const action = promotion.rules.actions[0];
    
    switch (action.type) {
      case 'percentage_discount':
      case 'item_percentage_discount':
        type = "percentage";
        value = action.value as number;
        break;
      case 'fixed_discount':
        type = "fixed_amount";
        value = typeof action.value === 'object' && action.value?.amount 
          ? action.value.amount / 100 // Convert cents to dollars
          : (action.value as number) / 100;
        break;
      case 'shipping_percentage_discount':
        if (action.value === 100) {
          type = "free_shipping";
          value = 0;
        } else {
          type = "percentage";
          value = action.value as number;
        }
        break;
      case 'shipping_fixed_discount':
        type = "fixed_amount";
        value = typeof action.value === 'object' && action.value?.amount 
          ? action.value.amount / 100
          : (action.value as number) / 100;
        break;
    }
  }
  
  // Get minimum amount from conditions
  let minimumAmount: number | undefined;
  if (promotion.rules.conditions) {
    for (const condition of promotion.rules.conditions) {
      if (condition.type === 'cart_subtotal' && condition.operator === 'gte') {
        minimumAmount = typeof condition.value === 'object' && condition.value?.amount 
          ? condition.value.amount / 100
          : (condition.value as number) / 100;
        break;
      }
    }
  }
  
  return {
    id: promotion.id,
    code: couponInstance?.code || promotion.codes?.single_code || '',
    name: displayName,
    description,
    type,
    value,
    minimumAmount,
    maxUses: promotion.usage_limits?.total_uses,
    currentUses: couponInstance?.usage_count || 0,
    validFrom: promotion.valid_from || new Date().toISOString(),
    validTo: promotion.valid_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: promotion.status === 'active' ? 'active' : 'inactive'
  };
}

/**
 * Convert Admin format to MACH Promotion
 */
function convertFromAdminFormat(admin: Partial<AdminPromotion>): { promotion: Partial<Promotion>, coupon: any } {
  const promotionId = admin.id || `promo_${Date.now()}`;
  
  // Build rules based on admin format
  const rules: any = {
    actions: [],
    conditions: []
  };
  
  // Add action based on type
  switch (admin.type) {
    case 'percentage':
      rules.actions.push({
        type: 'percentage_discount',
        value: admin.value || 0,
        apply_to: 'cart_subtotal'
      });
      break;
    case 'fixed_amount':
      rules.actions.push({
        type: 'fixed_discount',
        value: (admin.value || 0) * 100, // Convert dollars to cents
        apply_to: 'cart_subtotal'
      });
      break;
    case 'free_shipping':
      rules.actions.push({
        type: 'shipping_percentage_discount',
        value: 100,
        apply_to: 'shipping_cost'
      });
      break;
  }
  
  // Add minimum amount condition if specified
  if (admin.minimumAmount && admin.minimumAmount > 0) {
    rules.conditions.push({
      type: 'cart_subtotal',
      operator: 'gte',
      value: admin.minimumAmount * 100 // Convert dollars to cents
    });
  }
  
  const promotion: Partial<Promotion> = {
    id: promotionId,
    name: { en: admin.name || 'Unnamed Promotion' },
    type: admin.type === 'free_shipping' ? 'shipping' : 'cart',
    rules,
    status: admin.status === 'active' ? 'active' : 'paused',
    description: { en: admin.description || '' },
    slug: admin.code?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `promo-${Date.now()}`,
    valid_from: admin.validFrom,
    valid_to: admin.validTo,
    activation_method: 'code',
    codes: {
      generation_type: 'single',
      single_code: admin.code || `CODE${Date.now()}`
    },
    usage_limits: admin.maxUses ? {
      total_uses: admin.maxUses,
      uses_remaining: admin.maxUses - (admin.currentUses || 0),
      per_customer: 1
    } : undefined,
    eligibility: {
      customer_types: ['all'],
      channels: ['web', 'mobile'],
      regions: ['US']
    },
    priority: 100,
    stackable: true
  };
  
  const coupon = {
    promotion_id: promotionId,
    code: admin.code || `CODE${Date.now()}`,
    status: admin.status === 'active' ? 'active' : 'disabled',
    usage_count: admin.currentUses || 0,
    usage_limit: admin.maxUses,
    valid_from: admin.validFrom,
    valid_to: admin.validTo
  };
  
  return { promotion, coupon };
}

/**
 * GET /api/promotions - List all promotions
 */
export async function GET(request: NextRequest) {
  try {
    const promotions = await listPromotions();
    const couponInstances = await listCouponInstances();
    
    // Convert to admin format
    const adminPromotions = promotions.map(promotion => {
      const couponInstance = couponInstances.find(c => c.promotion_id === promotion.id);
      return convertToAdminFormat(promotion, couponInstance);
    });
    
    return NextResponse.json(adminPromotions);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch promotions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promotions - Create a new promotion
 */
export async function POST(request: NextRequest) {
  try {
    const adminPromotion: Partial<AdminPromotion> = await request.json();
    
    if (!adminPromotion.name?.trim() || !adminPromotion.code?.trim()) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }
    
    const { promotion, coupon } = convertFromAdminFormat(adminPromotion);
    
    const db = await getDbAsync();
    
    // Insert promotion directly into database
    const insertData: InsertPromotion = {
      id: promotion.id!,
      name: promotion.name!,
      type: promotion.type!,
      rules: promotion.rules!,
      status: promotion.status!,
      description: promotion.description!,
      slug: promotion.slug!,
      external_references: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      valid_from: promotion.valid_from!,
      valid_to: promotion.valid_to!,
      activation_method: promotion.activation_method!,
      codes: promotion.codes!,
      usage_limits: promotion.usage_limits,
      eligibility: promotion.eligibility!,
      priority: promotion.priority!,
      stackable: promotion.stackable ? 1 : 0,
      extensions: {}
    };
    
    const [createdPromotionRecord] = await db.insert(promotions).values(insertData).returning();
    
    if (!createdPromotionRecord) {
      throw new Error('Failed to create promotion');
    }
    
    // Create coupon instance
    const createdCoupon = await createCouponInstance(coupon);
    
    // Convert back to admin format
    const createdPromotion: Promotion = {
      id: createdPromotionRecord.id,
      name: createdPromotionRecord.name,
      type: createdPromotionRecord.type as any,
      rules: createdPromotionRecord.rules,
      status: createdPromotionRecord.status as any,
      description: createdPromotionRecord.description || undefined,
      slug: createdPromotionRecord.slug!,
      valid_from: createdPromotionRecord.valid_from!,
      valid_to: createdPromotionRecord.valid_to!,
      activation_method: createdPromotionRecord.activation_method as any,
      codes: createdPromotionRecord.codes || undefined,
      usage_limits: createdPromotionRecord.usage_limits || undefined,
      eligibility: createdPromotionRecord.eligibility || undefined,
      priority: createdPromotionRecord.priority!,
      stackable: createdPromotionRecord.stackable === 1
    };
    
    const adminFormat = convertToAdminFormat(createdPromotion, createdCoupon);
    
    return NextResponse.json(adminFormat, { status: 201 });
  } catch (error) {
    console.error('Error creating promotion:', error);
    return NextResponse.json(
      { error: 'Failed to create promotion' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/promotions - Update a promotion
 */
export async function PUT(request: NextRequest) {
  try {
    const adminPromotion: AdminPromotion = await request.json();
    
    if (!adminPromotion.id || !adminPromotion.name?.trim() || !adminPromotion.code?.trim()) {
      return NextResponse.json(
        { error: 'ID, name, and code are required' },
        { status: 400 }
      );
    }
    
    const { promotion, coupon } = convertFromAdminFormat(adminPromotion);
    
    const db = await getDbAsync();
    
    // Update promotion directly in database
    const updateData: Partial<InsertPromotion> = {
      name: promotion.name!,
      type: promotion.type!,
      rules: promotion.rules!,
      status: promotion.status!,
      description: promotion.description!,
      slug: promotion.slug!,
      updated_at: new Date().toISOString(),
      valid_from: promotion.valid_from!,
      valid_to: promotion.valid_to!,
      activation_method: promotion.activation_method!,
      codes: promotion.codes!,
      usage_limits: promotion.usage_limits,
      eligibility: promotion.eligibility!,
      priority: promotion.priority!,
      stackable: promotion.stackable ? 1 : 0
    };
    
    const [updatedPromotionRecord] = await db.update(promotions)
      .set(updateData)
      .where(eq(promotions.id, adminPromotion.id))
      .returning();
    
    if (!updatedPromotionRecord) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      );
    }
    
    // Find and update coupon instance
    const couponInstances = await listCouponInstances();
    const existingCoupon = couponInstances.find(c => c.promotion_id === adminPromotion.id);
    
    let updatedCoupon: CouponInstance | undefined;
    if (existingCoupon) {
      updatedCoupon = await updateCouponInstance(existingCoupon.id, coupon) || undefined;
    }
    
    // Convert back to admin format
    const updatedPromotion: Promotion = {
      id: updatedPromotionRecord.id,
      name: updatedPromotionRecord.name,
      type: updatedPromotionRecord.type as any,
      rules: updatedPromotionRecord.rules,
      status: updatedPromotionRecord.status as any,
      description: updatedPromotionRecord.description || undefined,
      slug: updatedPromotionRecord.slug!,
      valid_from: updatedPromotionRecord.valid_from!,
      valid_to: updatedPromotionRecord.valid_to!,
      activation_method: updatedPromotionRecord.activation_method as any,
      codes: updatedPromotionRecord.codes || undefined,
      usage_limits: updatedPromotionRecord.usage_limits || undefined,
      eligibility: updatedPromotionRecord.eligibility || undefined,
      priority: updatedPromotionRecord.priority!,
      stackable: updatedPromotionRecord.stackable === 1
    };
    
    const adminFormat = convertToAdminFormat(updatedPromotion, updatedCoupon);
    
    return NextResponse.json(adminFormat);
  } catch (error) {
    console.error('Error updating promotion:', error);
    return NextResponse.json(
      { error: 'Failed to update promotion' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/promotions - Delete a promotion
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Promotion ID is required' },
        { status: 400 }
      );
    }
    
    const db = await getDbAsync();
    
    // Delete associated coupon instances first
    const couponInstances = await listCouponInstances();
    const relatedCoupons = couponInstances.filter(c => c.promotion_id === id);
    
    for (const coupon of relatedCoupons) {
      await hardDeleteCouponInstance(coupon.id);
    }
    
    // Delete promotion directly from database
    const result = await db.delete(promotions).where(eq(promotions.id, id));
    
    if (!result.success || result.meta.changes === 0) {
      return NextResponse.json(
        { error: 'Promotion not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      { error: 'Failed to delete promotion' },
      { status: 500 }
    );
  }
}