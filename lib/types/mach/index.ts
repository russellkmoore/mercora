/**
 * MACH Alliance Open Data Model Types
 * 
 * Mercora - First MACH Alliance Open Data Model Compliant Platform
 * 
 * These TypeScript interfaces implement the official MACH Alliance
 * Open Data Model specifications, ensuring 100% compliance and interoperability.
 */

// Core MACH entities (officially specified)
export * from './Product';
export * from './ProductType';
export * from './Category';
export * from './Customer';
export * from './Inventory';
export * from './Pricing';
export * from './Promotion';
export * from './CouponInstance';

// MACH utility objects
export * from './Address';
export * from './Media';
export * from './Language';

// Re-export commonly used types for convenience
export type { MACHProduct as Product } from './Product';
export type { MACHProductVariant as ProductVariant } from './Product';
export type { MACHProductOption as ProductOption } from './Product';
export type { MACHOptionValue as OptionValue } from './Product';
export type { MACHWeight as Weight } from './Product';
export type { MACHDimensions as Dimensions } from './Product';
export type { MACHSEO as SEO } from './Product';
export type { MACHRating as Rating } from './Product';
export type { MACHProductInventory as ProductInventory } from './Product';
export type { MACHProductType as ProductType } from './ProductType';
export type { MACHAttributeDefinition as AttributeDefinition } from './ProductType';
export type { MACHAttributeValidation as AttributeValidation } from './ProductType';
export type { MACHAttributeOption as AttributeOption } from './ProductType';
export type { MACHCustomer as Customer } from './Customer';
export type { MACHInventory as Inventory } from './Inventory';
export type { MACHInventoryQuantities as InventoryQuantities } from './Inventory';
export type { MACHPricing as Pricing } from './Pricing';
export type { MACHTaxInfo as TaxInfo } from './Pricing';
export type { MACHSegmentPricing as SegmentPricing } from './Pricing';
export type { MACHBulkPricingTier as BulkPricingTier } from './Pricing';
export type { MACHPromotionRules as PromotionRules } from './Promotion';
export type { MACHCondition as Condition } from './Promotion';
export type { MACHAction as Action } from './Promotion';
export type { MACHPromotionCodes as PromotionCodes } from './Promotion';
export type { MACHUsageLimits as UsageLimits } from './Promotion';
export type { MACHEligibility as Eligibility } from './Promotion';
export type { MACHDiscountTier as DiscountTier } from './Promotion';
export type { MACHPromotion as Promotion } from './Promotion';
export type { MACHCouponInstance as CouponInstance } from './CouponInstance';
export type { MACHAddress as Address } from './Address';
export type { MACHCoordinates as Coordinates } from './Address';
export type { MACHAddressValidation as AddressValidation } from './Address';
export type { MACHAddressCorrection as AddressCorrection } from './Address';
export type { MACHMedia as Media } from './Media';
export type { MACHFile as File } from './Media';
export type { MACHMediaVariant as MediaVariant } from './Media';
export type { MACHFocalPoint as FocalPoint } from './Media';
export type { MACHAccessibility as Accessibility } from './Media';
export type { MACHLanguage as Language } from './Language';
export type { MACHLocaleFormatting as LocaleFormatting } from './Language';
export type { MACHNumberFormatting as NumberFormatting } from './Language';
export type { MACHCurrencyFormatting as CurrencyFormatting } from './Language';
export type { MACHCategory as Category } from './Category';
export type { MACHCategoryReference as CategoryReference } from './Category';
export type { MACHApiResponse as ApiResponse } from './APIResponse';
