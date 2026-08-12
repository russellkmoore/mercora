import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const email_preferences = sqliteTable("email_preferences", {
  email: text("email").notNull(),
  category: text("category", { enum: ["all_non_transactional", "review_reminders"] }).notNull(),
  suppressed_at: text("suppressed_at").notNull(),
  source: text("source", { enum: ["unsubscribe", "account"] }).notNull().default("unsubscribe"),
}, (table) => ({
  pk: primaryKey({ columns: [table.email, table.category] }),
  categoryEmail: index("idx_email_preferences_category_email").on(table.category, table.email),
}));
