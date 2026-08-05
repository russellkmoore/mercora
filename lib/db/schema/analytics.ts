/**
 * === Analytics Cache Schema ===
 *
 * Stores pre-generated Admin BI dashboard payloads so the expensive
 * data-collection + Workers AI analysis does not run on every request.
 *
 * One row per time range ("7d" | "30d" | "90d"). Rows are refreshed by a
 * scheduled (cron) handler and by the admin "Refresh" button, both of which
 * call the same generator in `lib/analytics/generate-insights.ts`.
 *
 * Stored in D1 (not R2/KV) because the payload contains sensitive business
 * data (revenue, order counts) that must not live in the public media bucket.
 */

import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const analytics_cache = sqliteTable("analytics_cache", {
  // Time range key: "7d" | "30d" | "90d"
  range: text("range").primaryKey(),
  // Full BI response object (insights, alerts, recommendations, metrics, trends)
  payload: text("payload", { mode: "json" }).notNull(),
  // When this row was last regenerated
  generated_at: text("generated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type AnalyticsCacheRow = typeof analytics_cache.$inferSelect;
