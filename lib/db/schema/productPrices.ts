import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { products } from './products';

export const productPrices = sqliteTable('product_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  price: integer('price').notNull(),
  currency: text('currency').notNull().default('USD'),
});
