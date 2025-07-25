import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { products } from "./products";

export const productUseCases = sqliteTable("product_use_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  useCase: text("use_case").notNull(),
});
