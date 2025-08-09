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
export type { MACHProductType as ProductType } from './ProductType';
export type { MACHCustomer as Customer } from './Customer';
export type { MACHInventory as Inventory } from './Inventory';
export type { MACHPricing as Pricing } from './Pricing';
export type { MACHPromotion as Promotion } from './Promotion';
export type { MACHCouponInstance as CouponInstance } from './CouponInstance';
export type { MACHAddress as Address } from './Address';
export type { MACHMedia as Media } from './Media';
export type { MACHLanguage as Language } from './Language';
export type { MACHCategory as Category } from './Category';

