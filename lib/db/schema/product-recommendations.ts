import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const product_recommendations = sqliteTable(
  "product_recommendations",
  {
    source_product_id: text("source_product_id").notNull(),
    recommended_product_id: text("recommended_product_id").notNull(),
    rank: integer("rank").notNull(),
    score: real("score"),
    reason: text("reason"),
    generated_at: text("generated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [primaryKey({ columns: [table.source_product_id, table.recommended_product_id] })],
);
