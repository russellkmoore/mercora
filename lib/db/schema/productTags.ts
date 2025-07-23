import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { products } from "./products";

export const productTags = sqliteTable("product_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  tag: text("tag").notNull(),
});
