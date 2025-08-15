/**
 * MACH Alliance Product Entity - Database Schema
 * Drizzle ORM schema for MACH compliant Product and ProductVariant entities
 */

import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import type { 
  Money,
  Media,
  Product, 
  ProductVariant,
  ProductOption,
  OptionValue,
  Weight,
  Dimensions,
  SEO,
  Rating,
  ProductInventory
} from '@/lib/types';

// Main products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name', { mode: 'json' }).$type<string | Record<string, string>>().notNull(),
  description: text('description', { mode: 'json' }).$type<string | Record<string, string>>(),
  type: text('type'),
  status: text('status', { enum: ['active', 'inactive', 'archived', 'draft'] }).default('active'),
  slug: text('slug'),
  brand: text('brand'),
  categories: text('categories', { mode: 'json' }).$type<string[]>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  options: text('options', { mode: 'json' }).$type<ProductOption[]>(),
  default_variant_id: text('default_variant_id'),
  fulfillment_type: text('fulfillment_type', { enum: ['physical', 'digital', 'service'] }).default('physical'),
  tax_category: text('tax_category'),
  primary_image: text('primary_image', { mode: 'json' }).$type<Media>(),
  media: text('media', { mode: 'json' }).$type<Media[]>(),
  seo: text('seo', { mode: 'json' }).$type<SEO>(),
  rating: text('rating', { mode: 'json' }).$type<Rating>(),
  related_products: text('related_products', { mode: 'json' }).$type<string[]>(),
  external_references: text('external_references', { mode: 'json' }).$type<Record<string, string>>(),
  extensions: text('extensions', { mode: 'json' }).$type<Record<string, any>>(),
  created_at: text('created_at'),
  updated_at: text('updated_at')
});

// Product variants table (for separate entities approach)
export const product_variants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  product_id: text('product_id').notNull(),
  sku: text('sku').notNull(),
  status: text('status', { enum: ['active', 'inactive', 'discontinued'] }).default('active'),
  position: integer('position'),
  option_values: text('option_values', { mode: 'json' }).$type<OptionValue[]>().notNull(),
  price: text('price', { mode: 'json' }).$type<Money>().notNull(),
  compare_at_price: text('compare_at_price', { mode: 'json' }).$type<Money>(),
  cost: text('cost', { mode: 'json' }).$type<Money>(),
  weight: text('weight', { mode: 'json' }).$type<Weight>(),
  dimensions: text('dimensions', { mode: 'json' }).$type<Dimensions>(),
  barcode: text('barcode'),
  inventory: text('inventory', { mode: 'json' }).$type<ProductInventory>(),
  tax_category: text('tax_category'),
  shipping_required: integer('shipping_required', { mode: 'boolean' }).default(true),
  media: text('media', { mode: 'json' }).$type<Media[]>(),
  attributes: text('attributes', { mode: 'json' }).$type<Record<string, any>>(),
  created_at: text('created_at'),
  updated_at: text('updated_at')
});

/**
 * Schema validation and transformation utilities
 */

export function validateProduct(data: any): data is Product {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    (typeof data.name === 'string' || (typeof data.name === 'object' && data.name !== null))
  );
}

export function validateProductVariant(data: any): data is ProductVariant {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    typeof data.sku === 'string' &&
    data.sku.length > 0 &&
    Array.isArray(data.option_values) &&
    data.price &&
    typeof data.price.amount === 'number' &&
    typeof data.price.currency === 'string'
  );
}

export function transformProductForDB(product: Product) {
  return {
    ...product,
    created_at: product.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function transformVariantForDB(variant: ProductVariant) {
  return {
    ...variant,
    created_at: variant.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Product utility functions
 */

export function calculateVariantPrice(
  variant: ProductVariant,
  quantity: number = 1
): Money {
  return {
    amount: variant.price.amount * quantity,
    currency: variant.price.currency
  };
}

export function getVariantByOptions(
  variants: ProductVariant[],
  selectedOptions: Record<string, string>
): ProductVariant | undefined {
  return variants.find(variant => {
    return variant.option_values.every(ov => 
      selectedOptions[ov.option_id] === ov.value
    );
  });
}

export function getAvailableOptionValues(
  variants: ProductVariant[],
  optionId: string
): string[] {
  const values = new Set<string>();
  variants.forEach(variant => {
    const optionValue = variant.option_values.find(ov => ov.option_id === optionId);
    if (optionValue) {
      values.add(optionValue.value);
    }
  });
  return Array.from(values);
}

export function isVariantAvailable(variant: ProductVariant): boolean {
  return (
    variant.status === 'active' &&
    (!variant.inventory?.track_inventory || 
     (variant.inventory.quantity && variant.inventory.quantity > 0) ||
     Boolean(variant.inventory.allow_backorder))
  );
}

export function getVariantInventoryLevel(variant: ProductVariant): number {
  if (!variant.inventory?.track_inventory) {
    return Infinity; // Unlimited if not tracking
  }
  
  const quantity = variant.inventory.quantity || 0;
  const backorderQuantity = variant.inventory.allow_backorder 
    ? (variant.inventory.backorder_quantity || 0) 
    : 0;
  
  return quantity + backorderQuantity;
}

export function formatWeight(weight: Weight): string {
  return `${weight.value}${weight.unit}`;
}

export function formatDimensions(dimensions: Dimensions): string {
  return `${dimensions.length}×${dimensions.width}×${dimensions.height} ${dimensions.unit}`;
}

export function calculateShippingWeight(variants: ProductVariant[]): Weight | null {
  const weights = variants
    .filter(v => v.weight)
    .map(v => v.weight!);
  
  if (weights.length === 0) return null;
  
  // Convert all to grams for calculation
  const totalGrams = weights.reduce((total, weight) => {
    let grams = weight.value;
    switch (weight.unit) {
      case 'kg': grams *= 1000; break;
      case 'oz': grams *= 28.3495; break;
      case 'lb': grams *= 453.592; break;
      // 'g' stays as is
    }
    return total + grams;
  }, 0);
  
  return {
    value: Math.round(totalGrams / weights.length),
    unit: 'g'
  };
}

export function isProductLocalized(product: Product): boolean {
  return typeof product.name === 'object' || typeof product.description === 'object';
}

export function getLocalizedValue(
  value: string | Record<string, string> | undefined,
  locale: string = 'en-US'
): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value[locale] || value[Object.keys(value)[0]];
}

export function buildProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSKU(
  baseCode: string,
  optionValues: OptionValue[]
): string {
  const suffix = optionValues
    .map(ov => ov.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .join('-');
  
  return suffix ? `${baseCode}-${suffix}` : baseCode;
}
