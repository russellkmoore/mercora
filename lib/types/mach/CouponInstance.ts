/**
 * MACH Alliance Open Data Model - Coupon Instance
 * Based on official specification: https://github.com/machalliance/standards/blob/main/models/entities/promotion/coupon-instance.md
 *
 * This interface ensures 100% compliance with MACH Alliance standards
 * for interoperability across headless commerce platforms.
 *
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 */

import type { Money } from '../';

/**
 * MACH Alliance Open Data Model - Coupon Instance Entity v1.0
 * 
 * A unified coupon instance model that represents individual coupon codes and
 * their usage tracking across both B2B and B2C commerce scenarios.
 */
export interface MACHCouponInstance {
  // Core identification - REQUIRED
  id: string;
  code: string; // The actual coupon code string used by customers
  promotion_id: string; // Reference to parent Promotion entity

  // Status and type - OPTIONAL
  status?: "active" | "used" | "expired" | "disabled" | "reserved";
  type?: "single_use" | "multi_use" | "unlimited";
  external_references?: Record<string, string>;

  // Timestamps - OPTIONAL
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601

  // Assignment and validity - OPTIONAL
  assigned_to?: string; // Customer ID or segment this coupon is assigned to
  valid_from?: string; // ISO 8601 start timestamp for coupon availability
  valid_to?: string; // ISO 8601 end timestamp for coupon expiration

  // Usage tracking - OPTIONAL
  usage_count?: number; // Number of times this coupon has been used
  usage_limit?: number; // Maximum allowed uses for this specific instance
  last_used_at?: string; // ISO 8601 timestamp of last redemption
  last_used_by?: string; // Customer ID of last user

  // Generation tracking - OPTIONAL
  generation_batch?: string; // Batch identifier for bulk-generated coupons

  // Extensions for custom data - OPTIONAL
  extensions?: Record<string, any>;
}

/**
 * Usage record for audit trail (optional tracking)
 */
export interface MACHUsageRecord {
  timestamp: string; // ISO 8601 when the coupon was used
  customer_id?: string; // Who used the coupon
  order_id?: string; // Order where coupon was applied
  discount_amount?: Money; // Actual discount given
  channel?: string; // Where the coupon was used (web, mobile, store)
}

// Type guards for coupon instance discrimination

export function isSingleUseCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.type === "single_use" || coupon.type === undefined;
}

export function isMultiUseCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.type === "multi_use";
}

export function isUnlimitedUseCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.type === "unlimited";
}

export function isActiveCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.status === "active" || coupon.status === undefined;
}

export function isUsedCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.status === "used";
}

export function isExpiredCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.status === "expired";
}

export function isAssignedCoupon(coupon: MACHCouponInstance): boolean {
  return coupon.assigned_to !== undefined && coupon.assigned_to !== null;
}

export function isCouponValid(coupon: MACHCouponInstance, date?: Date): boolean {
  const checkDate = date || new Date();
  const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
  const validTo = coupon.valid_to ? new Date(coupon.valid_to) : null;
  
  if (validFrom && checkDate < validFrom) return false;
  if (validTo && checkDate > validTo) return false;
  
  return isActiveCoupon(coupon);
}

export function canCouponBeUsed(coupon: MACHCouponInstance): boolean {
  if (!isActiveCoupon(coupon)) return false;
  if (!isCouponValid(coupon)) return false;
  
  if (coupon.usage_limit && coupon.usage_count) {
    return coupon.usage_count < coupon.usage_limit;
  }
  
  return true;
}

// Sample objects for reference

/**
 * Sample single-use coupon
 */
export const sampleSingleUseCoupon: MACHCouponInstance = {
  id: "COUP-INST-001",
  code: "WELCOME10-ABC123",
  promotion_id: "PROMO-WELCOME-001",
  status: "active",
  type: "single_use",
  external_references: {
    campaign: "CAMPAIGN-WELCOME-2024",
    email_send: "email-send-abc123"
  },
  created_at: "2024-07-01T10:30:00Z",
  updated_at: "2024-07-01T10:30:00Z",
  assigned_to: "CUST-001",
  valid_from: "2024-07-01T10:30:00Z",
  valid_to: "2024-08-01T23:59:59Z",
  usage_count: 0,
  usage_limit: 1,
  generation_batch: "BATCH-WELCOME-070124",
  extensions: {
    personalization: {
      customer_segment: "new_customer",
      delivery_method: "email",
      template_variant: "welcome_a"
    },
    attribution: {
      acquisition_channel: "organic_search",
      campaign_source: "google",
      referrer: "https://google.com/search"
    },
    fraud: {
      generation_ip: "192.168.1.1",
      validation_required: false,
      risk_score: 0.1
    }
  }
};

/**
 * Sample multi-use coupon with limits
 */
export const sampleMultiUseCoupon: MACHCouponInstance = {
  id: "COUP-INST-002",
  code: "SAVE20NOW",
  promotion_id: "PROMO-SAVE20-001",
  status: "active",
  type: "multi_use",
  external_references: {
    campaign: "CAMPAIGN-FLASH-SALE",
    social_post: "post-twitter-001"
  },
  created_at: "2024-07-15T08:00:00Z",
  updated_at: "2024-07-16T14:22:00Z",
  valid_from: "2024-07-15T08:00:00Z",
  valid_to: "2024-07-17T23:59:59Z",
  usage_count: 47,
  usage_limit: 500,
  last_used_at: "2024-07-16T14:22:00Z",
  last_used_by: "CUST-423",
  generation_batch: "BATCH-FLASH-071524",
  extensions: {
    social: {
      platform: "twitter",
      post_id: "tweet-12345",
      influencer: "fashion_blogger_jen",
      reach: 15000
    },
    performance: {
      conversion_rate: 0.15,
      average_order_value: {
        amount: 89.50,
        currency: "USD"
      },
      total_revenue: {
        amount: 4207.50,
        currency: "USD"
      }
    },
    velocity: {
      uses_per_hour: 2.3,
      peak_usage_time: "2024-07-16T13:00:00Z",
      projected_depletion: "2024-07-25T18:00:00Z"
    }
  }
};

/**
 * Sample personalized coupon
 */
export const samplePersonalizedCoupon: MACHCouponInstance = {
  id: "COUP-INST-003",
  code: "BIRTHDAY25-EMMA",
  promotion_id: "PROMO-BIRTHDAY-001",
  status: "active",
  type: "single_use",
  external_references: {
    campaign: "CAMPAIGN-BIRTHDAY-2024",
    crm_trigger: "birthday-automation-001",
    customer: "CUST-EMMA-001"
  },
  created_at: "2024-06-20T00:00:00Z",
  updated_at: "2024-06-20T00:00:00Z",
  assigned_to: "CUST-EMMA-001",
  valid_from: "2024-06-20T00:00:00Z",
  valid_to: "2024-07-20T23:59:59Z",
  usage_count: 0,
  usage_limit: 1,
  generation_batch: "BATCH-BIRTHDAY-062024",
  extensions: {
    personalization: {
      customer_name: "Emma",
      customer_tier: "gold",
      preferred_categories: ["apparel", "accessories"],
      purchase_history_months: 18,
      average_order_value: {
        amount: 125.00,
        currency: "USD"
      }
    },
    lifecycle: {
      trigger_event: "birthday",
      customer_journey_stage: "retention",
      days_since_last_purchase: 45,
      loyalty_points_balance: 850
    },
    delivery: {
      channel: "email",
      send_time: "2024-06-20T09:00:00Z",
      timezone: "America/New_York",
      opened: true,
      clicked: false
    }
  }
};

/**
 * Sample bulk generated coupon
 */
export const sampleBulkGeneratedCoupon: MACHCouponInstance = {
  id: "COUP-INST-004",
  code: "BULK2024-XY9K2M",
  promotion_id: "PROMO-BULK-DISCOUNT-001",
  status: "active",
  type: "single_use",
  external_references: {
    campaign: "CAMPAIGN-PARTNERSHIP-RETAILER",
    partner: "PARTNER-RETAILER-001",
    distribution: "bulk-export-001"
  },
  created_at: "2024-05-01T00:00:00Z",
  updated_at: "2024-05-01T00:00:00Z",
  valid_from: "2024-08-01T00:00:00Z",
  valid_to: "2024-12-31T23:59:59Z",
  usage_count: 0,
  usage_limit: 1,
  generation_batch: "BATCH-PARTNER-050124",
  extensions: {
    bulk_generation: {
      batch_size: 50000,
      batch_sequence: 23847,
      algorithm: "secure_random",
      code_pattern: "BULK2024-{6_alphanumeric}",
      generation_duration_ms: 245
    },
    distribution: {
      partner_name: "Retail Partner Inc",
      distribution_method: "csv_export",
      export_date: "2024-05-15T00:00:00Z",
      file_reference: "bulk_coupons_050124.csv",
      encryption: "AES256"
    },
    compliance: {
      data_classification: "restricted",
      retention_period_days: 2555,
      geographic_restrictions: ["EU", "CA"],
      audit_required: true
    }
  }
};

/**
 * Sample referral coupon
 */
export const sampleReferralCoupon: MACHCouponInstance = {
  id: "COUP-INST-006",
  code: "FRIEND20-EMMA-REF",
  promotion_id: "PROMO-REFERRAL-001",
  status: "active",
  type: "single_use",
  external_references: {
    campaign: "CAMPAIGN-REFERRAL-PROGRAM",
    referrer: "CUST-EMMA-001",
    referee: "PROSPECT-NEW-456"
  },
  created_at: "2024-07-10T14:20:00Z",
  updated_at: "2024-07-10T14:20:00Z",
  assigned_to: "PROSPECT-NEW-456",
  valid_from: "2024-07-10T14:20:00Z",
  valid_to: "2024-08-10T23:59:59Z",
  usage_count: 0,
  usage_limit: 1,
  generation_batch: "BATCH-REFERRAL-071024",
  extensions: {
    referral: {
      referrer_customer_id: "CUST-EMMA-001",
      referrer_name: "Emma Larsen",
      referrer_email: "emma@example.com",
      referee_email: "friend@example.com",
      referral_method: "email_share",
      referrer_reward: {
        type: "store_credit",
        amount: 10.00,
        currency: "USD"
      }
    },
    social_sharing: {
      share_url: "https://shop.example.com/ref/emma-friend20",
      utm_source: "referral",
      utm_medium: "email",
      utm_campaign: "friend_referral",
      social_platforms_shared: ["email"]
    },
    conversion_tracking: {
      referrer_qualified: false,
      referee_converted: false,
      conversion_value: null,
      referrer_credited: false,
      qualification_requirements: "first_purchase_min_50"
    }
  }
};
