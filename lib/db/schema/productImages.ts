import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { products } from './products';

export const productImages = sqliteTable('product_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  imageUrl: text('image_url').notNull(),
});
