import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  heroImageUrl: text("hero_image_url"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
