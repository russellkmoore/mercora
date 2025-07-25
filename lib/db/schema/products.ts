import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  primaryImageUrl: text("primary_image_url"),
  aiNotes: text("ai_notes"),
  availability: text("availability").notNull(),
  onSale: integer("on_sale", { mode: "boolean" }).default(false),
  active: integer("active", { mode: "boolean" }).default(true),
});
