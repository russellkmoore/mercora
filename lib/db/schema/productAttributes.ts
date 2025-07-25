import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { products } from "./products";

export const productAttributes = sqliteTable("product_attributes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
});
