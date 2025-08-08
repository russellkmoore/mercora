/**
 * MACH Alliance Open Data Model - Database Schema
 * 
 * Centralized exports for all Drizzle ORM schema definitions
 * Used by the database connection module for type-safe operations
 */

// Address utility object schema
export * from "./address";

// Category entity schema
export * from "./category";

// Coupon Instance schema
export * from "./couponInstance";

// Customer entity schema
export * from "./customer";

// Inventory entity schema
export * from "./inventory";

// Language utility object schema
export * from "./language";

// Media utility object schema
export * from "./media";

// Pricing entity schema
export * from "./pricing";

// Product entity schema
export * from "./products";

// ProductType entity schema - specific exports to avoid conflicts
export { 
  product_types,
  validateProductType,
  validateAttributeDefinition,
  transformProductTypeForDB,
  isActiveProductType,
  isDeprecatedProductType,
  hasParentType,
  hasRequiredAttributes,
  getRequiredAttributes,
  getAttributeDefinition,
  isRequiredAttribute,
  isVariantDefiningAttribute,
  getSelectOptions,
  validateAttributeValue,
  getInheritedAttributes,
  getInheritedRequiredAttributes,
  getVariantDefiningAttributes,
  getSearchableAttributes,
  buildProductTypeHierarchy,
  isProductTypeLocalized,
  generateProductTypeSlug
} from "./product_types";
export { getLocalizedValue as getProductTypeLocalizedValue } from "./product_types";

// Promotion entity schema - specific exports to avoid conflicts
export { 
  promotions,
  transformPromotionForDB,
  isActivePromotion,
  canBeUsedByCustomer,
  canBeUsedInChannel,
  canBeUsedInRegion,
  generatePromotionSlug,
  getActionsByType,
  getConditionsByType,
  hasCartSubtotalCondition,
  getCartMinimumAmount,
  getTotalUsesRemaining,
  isExpiredPromotion,
  isCodeBasedPromotion,
  isAutomaticPromotion,
  isScheduledPromotion,
  isDraftPromotion,
  isCartPromotion,
  isProductPromotion,
  isShippingPromotion,
  hasPercentageDiscountAction,
  hasFixedDiscountAction,
  hasBOGOAction,
  hasTieredDiscountAction,
  hasProductCategoryCondition,
  getTargetProductCategories,
  isSingleUsePerCustomer,
  requiresAccountLogin,
  isFirstPurchaseOnly
} from "./promotions";
export { getLocalizedValue as getPromotionLocalizedValue } from "./promotions";
