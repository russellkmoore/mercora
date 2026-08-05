/**
 * === Admin BI Insights Generator ===
 *
 * Single source of truth for generating the Admin dashboard's business
 * intelligence payload. Collects real order/product data from D1 and runs
 * Cloudflare Workers AI to produce natural-language insights.
 *
 * This module is intentionally context-agnostic: it takes a `CloudflareEnv`
 * and builds its own DB handle, so it works identically from:
 *   - the scheduled (cron) handler in `worker.ts`
 *   - the admin refresh route (`/api/admin/analytics/refresh`)
 *   - the cold-cache fallback in `/api/admin/analytics`
 *
 * The generated payload is cached in D1 (`analytics_cache`) so the expensive
 * AI step does not run on every dashboard load. It is stored in D1 (not the
 * public R2 media bucket) because it contains sensitive revenue/order data.
 */

import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema/";
import { products, product_variants } from "@/lib/db/schema/products";
import { orders } from "@/lib/db/schema/order";
import { analytics_cache } from "@/lib/db/schema/analytics";
import { runAI, extractAIResponse } from "@/lib/ai/config";

/** Supported dashboard time ranges (also the D1 cache keys). */
export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABEL: Record<AnalyticsRange, string> = {
  "7d": "week",
  "30d": "month",
  "90d": "quarter",
};

export interface AnalyticsPayload {
  insights: string;
  alerts: string[];
  recommendations: string[];
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    activeProducts: number;
    lowStockProducts: number;
    conversionRate: string;
  };
  trends: {
    orderTrends: string;
    topCategories: string[];
    range: AnalyticsRange;
    analysisDate: string;
  };
}

interface BusinessMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  activeProducts: number;
  lowStockProducts: number;
  topPerformingCategories: string[];
  recentOrderTrends: string;
  inventoryAlerts: string[];
  conversionOpportunities: string[];
}

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === "string" && (ANALYTICS_RANGES as readonly string[]).includes(value);
}

/**
 * Generate the BI payload for a single time range. Does not touch the cache.
 */
export async function generateBusinessInsights(
  env: CloudflareEnv,
  range: AnalyticsRange
): Promise<AnalyticsPayload> {
  const db = drizzle(env.DB, { schema });

  const now = new Date();
  const startDate = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const rangeLabel = RANGE_LABEL[range];

  const businessData: BusinessMetrics = {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    topPerformingCategories: [],
    recentOrderTrends: "",
    inventoryAlerts: [],
    conversionOpportunities: [],
  };

  try {
    // --- Orders ---
    const allOrders = await db.select().from(orders);
    const recentOrders = allOrders.filter(
      (order) => new Date(order.created_at || 0) >= startDate
    );

    const deliveredOrders = allOrders.filter((order) => order.status === "delivered");
    businessData.totalRevenue = deliveredOrders.reduce((sum, order) => {
      try {
        const amount = order.total_amount
          ? typeof order.total_amount === "string"
            ? JSON.parse(order.total_amount).amount
            : (order.total_amount as any).amount
          : 0;
        return sum + (amount || 0);
      } catch {
        return sum;
      }
    }, 0);

    businessData.totalOrders = allOrders.length;
    businessData.averageOrderValue =
      deliveredOrders.length > 0 ? businessData.totalRevenue / deliveredOrders.length : 0;

    const ordersByStatus = allOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    businessData.recentOrderTrends = `Orders in last ${rangeLabel}: ${recentOrders.length}. Status breakdown: ${Object.entries(
      ordersByStatus
    )
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ")}`;

    // --- Products / inventory ---
    const allProducts = await db.select().from(products);
    const allVariants = await db.select().from(product_variants);

    businessData.activeProducts = allProducts.filter((p) => p.status === "active").length;

    const lowStock = allVariants.filter((variant) => {
      try {
        const inventory = variant.inventory
          ? typeof variant.inventory === "string"
            ? JSON.parse(variant.inventory)
            : variant.inventory
          : {};
        const quantity = inventory.quantity || 0;
        return quantity > 0 && quantity < 10;
      } catch {
        return false;
      }
    });
    businessData.lowStockProducts = lowStock.length;

    const categoryCount: Record<string, number> = {};
    allProducts.forEach((product) => {
      try {
        const categories = product.categories
          ? typeof product.categories === "string"
            ? JSON.parse(product.categories)
            : product.categories
          : [];
        if (Array.isArray(categories)) {
          categories.forEach((category) => {
            categoryCount[category] = (categoryCount[category] || 0) + 1;
          });
        }
      } catch {
        // Skip malformed category data
      }
    });
    businessData.topPerformingCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    if (businessData.lowStockProducts > 0) {
      businessData.inventoryAlerts.push(
        `${businessData.lowStockProducts} products are running low on stock`
      );
    }
    if (recentOrders.length === 0) {
      businessData.inventoryAlerts.push(`No orders received in the last ${rangeLabel}`);
    }

    const inactiveProducts = allProducts.filter((p) => p.status === "inactive").length;
    if (inactiveProducts > 0) {
      businessData.conversionOpportunities.push(
        `${inactiveProducts} inactive products could be reactivated`
      );
    }
    const draftProducts = allProducts.filter((p) => p.status === "draft").length;
    if (draftProducts > 0) {
      businessData.conversionOpportunities.push(
        `${draftProducts} draft products ready to be published`
      );
    }
  } catch (dataError) {
    console.error("[analytics] Error collecting business data:", dataError);
  }

  // --- AI analysis ---
  const question = "Analyze current business performance and trends";
  const systemPrompt = `You are a business intelligence analyst specializing in eCommerce analytics for an outdoor gear store called Voltique.

=== YOUR ROLE ===
Analyze the provided business data and generate actionable insights, trend analysis, and strategic recommendations. Focus on practical, data-driven advice that helps improve business performance.

=== BUSINESS CONTEXT ===
- Store: Voltique (Outdoor gear eCommerce)
- Analysis Timeframe: ${rangeLabel}
- Current Date: ${now.toISOString().split("T")[0]}

=== CURRENT BUSINESS METRICS ===
Total Revenue: $${(businessData.totalRevenue / 100).toFixed(2)}
Total Orders: ${businessData.totalOrders}
Average Order Value: $${(businessData.averageOrderValue / 100).toFixed(2)}
Active Products: ${businessData.activeProducts}
Low Stock Products: ${businessData.lowStockProducts}
Top Categories: ${businessData.topPerformingCategories.join(", ") || "None identified"}

Recent Trends: ${businessData.recentOrderTrends}
Inventory Alerts: ${businessData.inventoryAlerts.join(", ") || "None"}
Opportunities: ${businessData.conversionOpportunities.join(", ") || "None identified"}

=== ANALYSIS REQUIREMENTS ===
1. **Trend Analysis**: Identify patterns and trends in the data
2. **Performance Assessment**: Evaluate business health and key metrics
3. **Risk Identification**: Highlight potential problems or concerns
4. **Opportunity Detection**: Suggest growth opportunities
5. **Actionable Recommendations**: Provide specific, implementable advice

Be specific, data-driven, and focus on actionable insights. Use the actual numbers provided and avoid generic advice.`;

  let aiInsights = "";
  try {
    const ai = (env as any).AI;
    if (ai) {
      const response = await runAI(ai, "ANALYTICS", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      });
      aiInsights = extractAIResponse(response) || "Unable to generate insights at this time.";
    } else {
      aiInsights = fallbackInsights(businessData);
    }
  } catch (aiError) {
    console.error("[analytics] AI analysis error:", aiError);
    aiInsights =
      "Unable to generate AI insights due to technical difficulties. Please review the raw metrics below.";
  }

  return {
    insights: aiInsights,
    alerts: businessData.inventoryAlerts,
    recommendations: businessData.conversionOpportunities,
    metrics: {
      totalRevenue: businessData.totalRevenue,
      totalOrders: businessData.totalOrders,
      averageOrderValue: businessData.averageOrderValue,
      activeProducts: businessData.activeProducts,
      lowStockProducts: businessData.lowStockProducts,
      conversionRate:
        businessData.totalOrders > 0
          ? ((businessData.totalOrders / Math.max(businessData.activeProducts, 1)) * 100).toFixed(2) +
            "%"
          : "0%",
    },
    trends: {
      orderTrends: businessData.recentOrderTrends,
      topCategories: businessData.topPerformingCategories,
      range,
      analysisDate: now.toISOString(),
    },
  };
}

function fallbackInsights(businessData: BusinessMetrics): string {
  return `Business Analysis Summary:

**Current Performance:**
- Total Revenue: $${(businessData.totalRevenue / 100).toFixed(2)} from ${businessData.totalOrders} orders
- Average Order Value: $${(businessData.averageOrderValue / 100).toFixed(2)}
- Active Products: ${businessData.activeProducts} products in catalog

**Key Alerts:**
${
  businessData.inventoryAlerts.length > 0
    ? businessData.inventoryAlerts.map((alert) => `• ${alert}`).join("\n")
    : "• No critical alerts detected"
}

**Opportunities:**
${
  businessData.conversionOpportunities.length > 0
    ? businessData.conversionOpportunities.map((opp) => `• ${opp}`).join("\n")
    : "• Focus on driving more traffic and conversions"
}`;
}

/**
 * Regenerate insights for the given ranges (default: all) and upsert them
 * into the D1 `analytics_cache` table. Returns the fresh payloads by range.
 *
 * Used by the cron scheduled handler and the manual refresh route.
 */
export async function regenerateAnalytics(
  env: CloudflareEnv,
  ranges: readonly AnalyticsRange[] = ANALYTICS_RANGES
): Promise<Record<string, AnalyticsPayload>> {
  const db = drizzle(env.DB, { schema });
  const result: Record<string, AnalyticsPayload> = {};

  for (const range of ranges) {
    const payload = await generateBusinessInsights(env, range);
    const generatedAt = new Date().toISOString();
    await db
      .insert(analytics_cache)
      .values({ range, payload: payload as unknown as any, generated_at: generatedAt })
      .onConflictDoUpdate({
        target: analytics_cache.range,
        set: { payload: payload as unknown as any, generated_at: generatedAt },
      });
    result[range] = payload;
  }

  return result;
}
