/**
 * Discount Code Validation API Endpoint
 * 
 * Validates promotion codes and returns discount information
 * following MACH Alliance promotion standards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listPromotions, listCouponInstances } from '@/lib/models';
import type { Promotion, CouponInstance } from '@/lib/types';

interface DiscountValidationRequest {
  code: string;
  cartSubtotal?: number;
  cartItems?: Array<{
    productId: string;
    categories: string[];
    quantity: number;
    price: number;
  }>;
}

interface DiscountValidationResponse {
  valid: boolean;
  promotion?: {
    id: string;
    type: 'cart' | 'product' | 'shipping';
    displayName: string;
    description: string;
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DiscountValidationRequest = await request.json();
    const { code, cartSubtotal = 0, cartItems = [] } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Discount code is required' },
        { status: 400 }
      );
    }

    // Find coupon instance by code
    const couponInstances = await listCouponInstances();
    const couponInstance = couponInstances.find(
      (c: CouponInstance) => c.code.toUpperCase() === code.toUpperCase() && c.status === 'active'
    );

    if (!couponInstance) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired discount code'
      });
    }

    // Find associated promotion
    const promotions = await listPromotions();
    const promotion = promotions.find(
      (p: Promotion) => p.id === couponInstance.promotion_id && p.status === 'active'
    );

    if (!promotion) {
      return NextResponse.json({
        valid: false,
        error: 'Promotion not found or expired'
      });
    }

    // Validate promotion conditions
    const isValidPromotion = validatePromotionConditions(promotion, cartSubtotal, cartItems);
    if (!isValidPromotion.valid) {
      return NextResponse.json({
        valid: false,
        error: isValidPromotion.error || 'Promotion conditions not met'
      });
    }

    // Calculate discount amount
    const discountCalculation = calculateDiscountAmount(promotion, cartSubtotal, cartItems);

    const response: DiscountValidationResponse = {
      valid: true,
      promotion: {
        id: promotion.id,
        type: promotion.type,
        displayName: typeof promotion.name === 'string' ? promotion.name : promotion.name.en,
        description: typeof promotion.description === 'string' ? promotion.description || '' : promotion.description?.en || '',
        discountAmount: discountCalculation.amount,
        discountType: discountCalculation.type,
        discountValue: discountCalculation.value
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error validating discount code:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate promotion conditions against cart state
 */
function validatePromotionConditions(
  promotion: Promotion,
  cartSubtotal: number,
  cartItems: Array<{ productId: string; categories: string[]; quantity: number; price: number; }>
): { valid: boolean; error?: string } {
  if (!promotion.rules.conditions || promotion.rules.conditions.length === 0) {
    return { valid: true };
  }

  for (const condition of promotion.rules.conditions) {
    switch (condition.type) {
      case 'cart_subtotal':
        if (condition.operator === 'gte') {
          const minAmount = condition.value?.amount || 0;
          if (cartSubtotal < minAmount) {
            return {
              valid: false,
              error: `Minimum order of $${(minAmount / 100).toFixed(2)} required`
            };
          }
        }
        break;

      case 'product_category':
        if (condition.operator === 'in') {
          const requiredCategories = Array.isArray(condition.value) ? condition.value : [condition.value];
          const hasRequiredCategory = cartItems.some(item =>
            item.categories.some(cat => requiredCategories.includes(cat))
          );
          if (!hasRequiredCategory) {
            return {
              valid: false,
              error: 'This discount requires specific products in your cart'
            };
          }
        }
        break;

      default:
        // Skip unknown condition types for now
        break;
    }
  }

  return { valid: true };
}

/**
 * Calculate discount amount based on promotion rules
 */
function calculateDiscountAmount(
  promotion: Promotion,
  cartSubtotal: number,
  cartItems: Array<{ productId: string; categories: string[]; quantity: number; price: number; }>
): { amount: number; type: 'percentage' | 'fixed'; value: number } {
  const action = promotion.rules.actions[0]; // Take first action for simplicity
  
  switch (action.type) {
    case 'percentage_discount':
      const percentageValue = action.value as number;
      return {
        amount: Math.round(cartSubtotal * (percentageValue / 100)),
        type: 'percentage',
        value: percentageValue
      };

    case 'fixed_discount':
      const fixedValue = (action.value as any)?.amount || action.value;
      return {
        amount: Math.min(fixedValue, cartSubtotal), // Don't exceed cart total
        type: 'fixed',
        value: fixedValue
      };

    case 'shipping_percentage_discount':
      const shippingPercentage = action.value as number;
      // For shipping discounts, we'll return a placeholder amount
      // The actual calculation will happen in the frontend when shipping is known
      return {
        amount: shippingPercentage === 100 ? 999999 : 0, // Special case for free shipping
        type: 'percentage',
        value: shippingPercentage
      };

    case 'shipping_fixed_discount':
      const shippingFixed = (action.value as any)?.amount || action.value;
      return {
        amount: shippingFixed,
        type: 'fixed',
        value: shippingFixed
      };

    default:
      return {
        amount: 0,
        type: 'fixed',
        value: 0
      };
  }
}