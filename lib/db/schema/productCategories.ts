import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { products } from "./products";
import { categories } from "./categories";

export const productCategories = sqliteTable("product_categories", {
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
});
