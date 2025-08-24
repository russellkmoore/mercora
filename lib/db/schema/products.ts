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
  name: text('name').notNull(),
  description: text('description'),
  type: text('type'),
  status: text('status', { enum: ['active', 'inactive', 'archived', 'draft'] }).default('active'),
  slug: text('slug'),
  brand: text('brand'),
  categories: text('categories'),
  tags: text('tags'),
  options: text('options'),
  default_variant_id: text('default_variant_id'),
  fulfillment_type: text('fulfillment_type', { enum: ['physical', 'digital', 'service'] }).default('physical'),
  tax_category: text('tax_category'),
  primary_image: text('primary_image'),
  media: text('media'),
  seo: text('seo'),
  rating: text('rating'),
  related_products: text('related_products'),
  external_references: text('external_references'),
  extensions: text('extensions'),
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

// Helper: parse stringified JSON or return as-is
function parseMaybeJson(val: any) {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// Helper: convert DB record to MACH Product
export function deserializeProduct(record: any): Product {
  return {
    id: record.id,
    name: parseMaybeJson(record.name),
    description: record.description ? parseMaybeJson(record.description) : undefined,
    type: record.type,
    status: record.status,
    slug: record.slug,
    brand: record.brand,
    categories: record.categories ? parseMaybeJson(record.categories) : undefined,
    tags: record.tags ? parseMaybeJson(record.tags) : undefined,
    options: record.options ? parseMaybeJson(record.options) : undefined,
    default_variant_id: record.default_variant_id,
    fulfillment_type: record.fulfillment_type,
    tax_category: record.tax_category,
    primary_image: record.primary_image ? parseMaybeJson(record.primary_image) : undefined,
    media: record.media ? parseMaybeJson(record.media) : undefined,
    seo: record.seo ? parseMaybeJson(record.seo) : undefined,
    rating: record.rating ? parseMaybeJson(record.rating) : undefined,
    related_products: record.related_products ? parseMaybeJson(record.related_products) : undefined,
    external_references: record.external_references ? parseMaybeJson(record.external_references) : undefined,
    extensions: record.extensions ? parseMaybeJson(record.extensions) : undefined,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

// Helper: convert MACH Product to DB insert format
export function serializeProduct(product: Product) {
  return {
    id: product.id,
    name: typeof product.name === 'string' ? product.name : JSON.stringify(product.name),
    description: product.description ? (typeof product.description === 'string' ? product.description : JSON.stringify(product.description)) : undefined,
    type: product.type,
    status: product.status ?? 'active',
    slug: product.slug,
    brand: product.brand,
    categories: product.categories ? JSON.stringify(product.categories) : undefined,
    tags: product.tags ? JSON.stringify(product.tags) : undefined,
    options: product.options ? JSON.stringify(product.options) : undefined,
    default_variant_id: product.default_variant_id,
    fulfillment_type: product.fulfillment_type ?? 'physical',
    tax_category: product.tax_category,
    primary_image: product.primary_image ? JSON.stringify(product.primary_image) : undefined,
    media: product.media ? JSON.stringify(product.media) : undefined,
    seo: product.seo ? JSON.stringify(product.seo) : undefined,
    rating: product.rating ? JSON.stringify(product.rating) : undefined,
    related_products: product.related_products ? JSON.stringify(product.related_products) : undefined,
    external_references: product.external_references ? JSON.stringify(product.external_references) : undefined,
    extensions: product.extensions ? JSON.stringify(product.extensions) : undefined,
    created_at: product.created_at ?? new Date().toISOString(),
    updated_at: product.updated_at ?? new Date().toISOString()
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
