import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { products } from "./products";

export const productInventory = sqliteTable("product_inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantityInStock: integer("quantity_in_stock").notNull().default(0),
});
