import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const email_deliveries = sqliteTable("email_deliveries", {
  idempotency_key: text("idempotency_key").primaryKey(),
  provider: text("provider", { enum: ["cloudflare", "resend"] }).notNull(),
  status: text("status", { enum: ["pending", "processing", "succeeded", "failed", "needs_review"] }).notNull(),
  claim_token: text("claim_token"),
  lease_expires_at: text("lease_expires_at"),
  provider_message_id: text("provider_message_id"),
  error_code: text("error_code"),
  last_error: text("last_error"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  completed_at: text("completed_at"),
}, (table) => ({
  retry: index("idx_email_deliveries_retry").on(table.status, table.lease_expires_at, table.updated_at),
}));
