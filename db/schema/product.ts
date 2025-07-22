import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Categories
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey().notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  heroImageUrl: text('hero_image_url'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

// Products
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  primaryImageUrl: text('primary_image_url'),
  active: integer('active', { mode: 'boolean' }).default(true),
  availability: text('availability').notNull(), // 'available' or 'coming_soon'
  onSale: integer('on_sale', { mode: 'boolean' }).default(false),
});

// Product alternate images
export const productImages = sqliteTable('product_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  imageUrl: text('image_url').notNull(),
});

// Product-category many-to-many
export const productCategories = sqliteTable('product_categories', {
  productId: integer('product_id').notNull().references(() => products.id),
  categoryId: integer('category_id').notNull().references(() => categories.id),
});

// Prices
export const productPrices = sqliteTable('product_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  price: integer('price').notNull(),
  currency: text('currency').notNull().default('USD'),
});

// Sale prices
export const productSalePrices = sqliteTable('product_sale_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  sale_price: integer('sale_price').notNull(),
  currency: text('currency').notNull().default('USD'),
});

// Inventory
export const productInventory = sqliteTable('product_inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  quantityInStock: integer('quantity_in_stock').notNull().default(0),
});