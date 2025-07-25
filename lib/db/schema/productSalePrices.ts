import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { products } from "./products";

export const productSalePrices = sqliteTable("product_sale_prices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  sale_price: integer("sale_price").notNull(),
  currency: text("currency").notNull().default("USD"),
});
