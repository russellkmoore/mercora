/**
 * MACH Alliance Open Data Model - Promotion
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/promotion/promotion.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

import type { Money } from '../money';

/**
 * MACH Alliance Open Data Model - Promotion Entity v1.0
 * 
 * A unified promotion model that supports flexible, rule-based discount strategies
 * across all commerce channels.
 */
export interface MACHPromotion {
  // Core identification - REQUIRED
  id: string;
  name: string | Record<string, string>; // Localizable
  type: "cart" | "product" | "shipping";
  rules: MACHPromotionRules;

  // Status and lifecycle - OPTIONAL
  status?: "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";
  description?: string | Record<string, string>; // Localizable
  slug?: string; // URL-friendly string for routing and SEO
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
  valid_from?: string; // ISO 8601
  valid_to?: string; // ISO 8601

  // Activation and codes - OPTIONAL
  activation_method?: "automatic" | "code" | "customer_specific" | "link";
  codes?: MACHPromotionCodes;

  // Usage and eligibility - OPTIONAL
  usage_limits?: MACHUsageLimits;
  eligibility?: MACHEligibility;

  // Stacking and priority - OPTIONAL
  priority?: number; // 0-1000, higher = higher priority
  stackable?: boolean;

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Promotion rules with conditions and actions
 */
export interface MACHPromotionRules {
  actions: MACHAction[]; // REQUIRED
  conditions?: MACHCondition[]; // OPTIONAL
}

/**
 * Conditions that must be met for the promotion to apply
 */
export interface MACHCondition {
  type: 
    | "cart_minimum" | "cart_subtotal" | "cart_quantity"
    | "product_category" | "product_sku" | "product_brand"
    | "customer_segment" | "customer_type" | "first_purchase"
    | "shipping_method" | "shipping_zone"
    | "payment_method" | "coupon_code"
    | "date_range" | "time_range" | "day_of_week";
  operator: "equals" | "not_equals" | "in" | "not_in" | "gte" | "gt" | "lte" | "lt" | "contains";
  value: any; // Type varies by condition
  field?: string; // Optional field to evaluate
}

/**
 * Actions to take when conditions are met
 */
export interface MACHAction {
  type:
    | "percentage_discount" | "fixed_discount" | "fixed_price"
    | "item_percentage_discount" | "item_fixed_discount"
    | "shipping_percentage_discount" | "shipping_fixed_discount"
    | "bogo_discount" | "gift_item" | "tiered_discount";
  value?: any; // Discount value (percentage or Money object)
  apply_to?: string; // What to apply the discount to
  max_discount?: Money; // Maximum discount amount (for percentage discounts)

  // BOGO specific properties
  buy_quantity?: number;
  get_quantity?: number;
  discount_type?: "percentage" | "fixed" | "free";
  discount_value?: number;
  repeat?: boolean;

  // Tiered discount properties
  tiers?: MACHDiscountTier[];
}

/**
 * Discount tier for tiered promotions
 */
export interface MACHDiscountTier {
  min_value: Money;
  discount_type: "percentage" | "fixed";
  discount_value: number;
}

/**
 * Promotion codes configuration
 */
export interface MACHPromotionCodes {
  generation_type?: "single" | "bulk" | "pattern";
  single_code?: string; // For single-code promotions
  coupon_instances?: string[]; // References to coupon-instance entities
  pattern?: {
    prefix?: string;
    suffix_type?: "numeric" | "alphanumeric" | "uuid";
    length?: number; // 4-20
    case_sensitive?: boolean;
  };
}

/**
 * Usage limits and restrictions
 */
export interface MACHUsageLimits {
  total_uses?: number; // Maximum total uses across all customers
  uses_remaining?: number; // Number of uses remaining
  per_customer?: number; // Maximum uses per customer
  per_customer_period?: "lifetime" | "promotion" | "day" | "week" | "month" | "year";
  per_order?: number; // Maximum applications per order
}

/**
 * Eligibility criteria
 */
export interface MACHEligibility {
  customer_types?: ("all" | "new" | "existing" | "vip" | "loyalty_member")[];
  customer_segments?: string[]; // Specific customer segment IDs
  channels?: ("web" | "mobile" | "store" | "call_center" | "marketplace")[];
  regions?: string[]; // Eligible geographic regions (ISO codes)
  exclude_regions?: string[]; // Excluded geographic regions
  payment_methods?: string[]; // Eligible payment methods
  minimum_age?: number; // Minimum customer age requirement
  requires_account?: boolean; // Whether customer must be logged in
}

// Type guards for promotion discrimination

export function isCartPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === "cart";
}

export function isProductPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === "product";
}

export function isShippingPromotion(promotion: MACHPromotion): boolean {
  return promotion.type === "shipping";
}

export function isActivePromotion(promotion: MACHPromotion): boolean {
  return promotion.status === "active" || promotion.status === undefined;
}

export function isCodeBasedPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === "code";
}

export function isAutomaticPromotion(promotion: MACHPromotion): boolean {
  return promotion.activation_method === "automatic" || promotion.activation_method === undefined;
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

// Sample objects for reference

/**
 * Sample minimal promotion
 */
export const sampleMinimalPromotion: MACHPromotion = {
  id: "PROMO-MIN-001",
  name: "10% Off Everything",
  type: "cart",
  status: "active",
  rules: {
    actions: [
      {
        type: "percentage_discount",
        value: 10,
        apply_to: "cart_subtotal"
      }
    ]
  }
};

/**
 * Sample cart promotion
 */
export const sampleCartPromotion: MACHPromotion = {
  id: "PROMO-CART-001",
  name: "20% Off Orders Over $100",
  description: "Get 20% off your entire order when you spend $100 or more",
  type: "cart",
  status: "active",
  external_references: {
    campaign: "CAMPAIGN-SUMMER-2024",
    cms: "cms-promo-123"
  },
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-15T10:30:00Z",
  valid_from: "2024-07-01T00:00:00Z",
  valid_to: "2024-08-31T23:59:59Z",
  activation_method: "automatic",
  rules: {
    conditions: [
      {
        type: "cart_subtotal",
        operator: "gte",
        value: {
          amount: 100.00,
          currency: "USD"
        }
      }
    ],
    actions: [
      {
        type: "percentage_discount",
        value: 20,
        apply_to: "cart_subtotal"
      }
    ]
  },
  usage_limits: {
    total_uses: 1000,
    uses_remaining: 847,
    per_customer: 1,
    per_customer_period: "promotion"
  },
  eligibility: {
    customer_types: ["all"],
    channels: ["web", "mobile"],
    regions: ["US", "CA"]
  },
  priority: 10,
  stackable: false,
  extensions: {
    marketing: {
      campaign_name: "Summer Sale 2024",
      tracking_pixel: "https://analytics.example.com/promo/SAVE20"
    },
    analytics: {
      conversion_goal: "increase_aov",
      target_aov: {
        amount: 150.00,
        currency: "USD"
      }
    }
  }
};

/**
 * Sample product promotion
 */
export const sampleProductPromotion: MACHPromotion = {
  id: "PROMO-PRODUCT-001",
  name: "30% Off All T-Shirts",
  description: "Save 30% on all t-shirts in our collection",
  type: "product",
  status: "active",
  external_references: {
    campaign: "CAMPAIGN-APPAREL-CLEARANCE",
    merchandising: "merch-rule-456"
  },
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-20T14:15:00Z",
  valid_from: "2024-07-15T00:00:00Z",
  valid_to: "2024-07-31T23:59:59Z",
  activation_method: "automatic",
  rules: {
    conditions: [
      {
        type: "product_category",
        operator: "in",
        value: ["CAT-TSHIRTS", "CAT-POLOS"]
      }
    ],
    actions: [
      {
        type: "item_percentage_discount",
        value: 30,
        apply_to: "product_price"
      }
    ]
  },
  usage_limits: {
    per_customer: 5,
    per_customer_period: "promotion"
  },
  eligibility: {
    customer_types: ["all"],
    channels: ["web", "mobile", "store"],
    regions: ["global"]
  },
  priority: 5,
  stackable: true,
  extensions: {
    merchandising: {
      clearance_event: true,
      inventory_target: "reduce_overstock",
      target_products: ["PROD-001", "PROD-002", "PROD-003"]
    },
    inventory: {
      stock_threshold: 50,
      auto_disable_when_sold: false
    }
  }
};

/**
 * Sample BOGO promotion
 */
export const sampleBOGOPromotion: MACHPromotion = {
  id: "PROMO-BOGO-001",
  name: "Buy One, Get One 50% Off",
  description: "Buy any shoe, get the second one (of equal or lesser value) 50% off",
  type: "product",
  status: "active",
  external_references: {
    campaign: "CAMPAIGN-BOGO-SUMMER",
    merchandising: "bogo-rule-001"
  },
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-18T11:30:00Z",
  valid_from: "2024-07-01T00:00:00Z",
  valid_to: "2024-07-14T23:59:59Z",
  activation_method: "automatic",
  rules: {
    conditions: [
      {
        type: "product_category",
        operator: "equals",
        value: "shoes"
      }
    ],
    actions: [
      {
        type: "bogo_discount",
        buy_quantity: 1,
        get_quantity: 1,
        discount_type: "percentage",
        discount_value: 50,
        apply_to: "cheapest",
        repeat: true
      }
    ]
  },
  usage_limits: {
    total_uses: 2000,
    uses_remaining: 1654,
    per_customer: 3,
    per_customer_period: "promotion"
  },
  eligibility: {
    customer_types: ["all"],
    channels: ["web", "mobile", "store"],
    regions: ["US", "CA", "EU"]
  },
  priority: 8,
  stackable: false,
  extensions: {
    logic: {
      calculation_type: "item_pairing",
      sort_order: "price_desc",
      max_pairs: 3
    },
    display: {
      badge_text: "BOGO 50% OFF",
      highlight_color: "#FF6B35",
      show_savings: true
    }
  }
};

/**
 * Sample tiered cart promotion
 */
export const sampleTieredPromotion: MACHPromotion = {
  id: "PROMO-TIERED-001",
  name: "Spend More, Save More",
  description: "Save up to 20% based on your order total",
  type: "cart",
  status: "active",
  external_references: {
    campaign: "CAMPAIGN-SPEND-MORE-SAVE-MORE",
    analytics: "tier-analysis-001"
  },
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-22T13:45:00Z",
  valid_from: "2024-08-01T00:00:00Z",
  valid_to: "2024-08-31T23:59:59Z",
  activation_method: "automatic",
  rules: {
    conditions: [
      {
        type: "cart_subtotal",
        operator: "gte",
        value: {
          amount: 50.00,
          currency: "USD"
        }
      }
    ],
    actions: [
      {
        type: "tiered_discount",
        tiers: [
          {
            min_value: {
              amount: 50.00,
              currency: "USD"
            },
            discount_type: "percentage",
            discount_value: 10
          },
          {
            min_value: {
              amount: 100.00,
              currency: "USD"
            },
            discount_type: "percentage",
            discount_value: 15
          },
          {
            min_value: {
              amount: 200.00,
              currency: "USD"
            },
            discount_type: "percentage",
            discount_value: 20
          }
        ]
      }
    ]
  },
  usage_limits: {
    per_customer: 2,
    per_customer_period: "month"
  },
  eligibility: {
    customer_types: ["all"],
    channels: ["web", "mobile"],
    regions: ["US"]
  },
  priority: 12,
  stackable: true,
  extensions: {
    gamification: {
      progress_bar: true,
      next_tier_message: "Spend ${amount} more to save {discount}%",
      celebrate_upgrade: true
    },
    psychology: {
      urgency_factor: "limited_time",
      social_proof: "popular_choice"
    }
  }
};
