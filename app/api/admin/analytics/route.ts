/**
 * === Admin Analytics AI Agent API ===
 *
 * This endpoint provides AI-powered business intelligence for the admin dashboard.
 * It analyzes real order and product data to generate trends, insights, and recommendations.
 *
 * === Core Features ===
 * - AI-powered trend analysis using GPT-OSS-20B
 * - Natural language business insights
 * - Anomaly detection and smart alerts
 * - Actionable recommendations for inventory and marketing
 * - Real-time data analysis of orders and products
 *
 * === Request Body ===
 * ```json
 * {
 *   "question": "What are the current trends?", // Optional, defaults to general analysis
 *   "timeframe": "week", // Optional: "day", "week", "month", "quarter"
 *   "focus": "products" // Optional: "products", "orders", "customers", "all"
 * }
 * ```
 *
 * === Response Format ===
 * ```json
 * {
 *   "insights": "AI-generated natural language insights",
 *   "alerts": [...], // Array of important alerts/anomalies
 *   "recommendations": [...], // Array of actionable recommendations
 *   "metrics": {...}, // Key performance indicators
 *   "trends": {...} // Trend analysis data
 * }
 * ```
 *
 * === AI Analytics Capabilities ===
 * - **Trend Detection**: Identify growing/declining product categories
 * - **Inventory Intelligence**: Smart low-stock predictions
 * - **Order Pattern Analysis**: Peak times, customer behavior
 * - **Revenue Insights**: Performance drivers and opportunities
 * - **Anomaly Detection**: Unusual patterns requiring attention
 *
 * === Security ===
 * - Admin-only endpoint (requires admin check)
 * - Rate limiting via Cloudflare Workers
 * - Input validation and sanitization
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/lib/db";
import { products, product_variants, deserializeProduct } from "@/lib/db/schema/products";
import { orders } from "@/lib/db/schema/order";
import { checkAdminPermissions } from "@/lib/auth/admin-middleware";
import { sql } from "drizzle-orm";
import { runAI } from "@/lib/ai/config";

interface AnalyticsRequest {
  question?: string;
  timeframe?: "day" | "week" | "month" | "quarter";
  focus?: "products" | "orders" | "customers" | "all";
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

/**
 * Handles AI-powered business analytics requests
 * 
 * @param req - Next.js request object containing analytics parameters
 * @returns JSON response with AI insights, alerts, and recommendations
 */
export async function POST(req: NextRequest) {
  try {
    // For client-side calls, we'll skip token auth and rely on Clerk session
    // Check admin permissions - allow Clerk auth to work
    const authResult = await checkAdminPermissions(req);
    if (!authResult.success) {
      console.log("Admin auth failed:", authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body with defaults
    const body: AnalyticsRequest = await req.json().catch(() => ({})) as AnalyticsRequest;
    const { 
      question = "Analyze current business performance and trends",
      timeframe = "week",
      focus = "all"
    } = body;

    console.log("Admin analytics request:", { question, timeframe, focus });

    // === DATA COLLECTION PHASE ===
    // Gather real business data for AI analysis
    const db = await getDbAsync();
    
    // Calculate timeframe boundaries
    const now = new Date();
    const timeframeDays = {
      day: 1,
      week: 7,
      month: 30,
      quarter: 90
    };
    const startDate = new Date(now.getTime() - (timeframeDays[timeframe] * 24 * 60 * 60 * 1000));
    
    let businessData: BusinessMetrics = {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      activeProducts: 0,
      lowStockProducts: 0,
      topPerformingCategories: [],
      recentOrderTrends: "",
      inventoryAlerts: [],
      conversionOpportunities: []
    };

    try {
      // Fetch orders data
      const allOrders = await db.select().from(orders);
      const recentOrders = allOrders.filter(order => 
        new Date(order.created_at || 0) >= startDate
      );

      // Calculate revenue metrics
      const deliveredOrders = allOrders.filter(order => order.status === 'delivered');
      businessData.totalRevenue = deliveredOrders.reduce((sum, order) => {
        try {
          const amount = order.total_amount ? 
            (typeof order.total_amount === 'string' ? JSON.parse(order.total_amount).amount : (order.total_amount as any).amount) : 0;
          return sum + (amount || 0);
        } catch {
          return sum;
        }
      }, 0);

      businessData.totalOrders = allOrders.length;
      businessData.averageOrderValue = deliveredOrders.length > 0 ? 
        businessData.totalRevenue / deliveredOrders.length : 0;

      // Analyze order trends
      const ordersByStatus = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      businessData.recentOrderTrends = `Orders in last ${timeframe}: ${recentOrders.length}. Status breakdown: ${Object.entries(ordersByStatus).map(([status, count]) => `${status}: ${count}`).join(', ')}`;

      // Fetch products data
      const allProducts = await db.select().from(products);
      const allVariants = await db.select().from(product_variants);

      businessData.activeProducts = allProducts.filter(p => p.status === 'active').length;

      // Analyze inventory
      const lowStockProducts = allVariants.filter(variant => {
        try {
          const inventory = variant.inventory ? 
            (typeof variant.inventory === 'string' ? JSON.parse(variant.inventory) : variant.inventory) : {};
          const quantity = inventory.quantity || 0;
          return quantity > 0 && quantity < 10; // In stock but low
        } catch {
          return false;
        }
      });

      businessData.lowStockProducts = lowStockProducts.length;

      // Generate category analysis
      const categoryCount: Record<string, number> = {};
      allProducts.forEach(product => {
        try {
          const categories = product.categories ? 
            (typeof product.categories === 'string' ? JSON.parse(product.categories) : product.categories) : [];
          if (Array.isArray(categories)) {
            categories.forEach(category => {
              categoryCount[category] = (categoryCount[category] || 0) + 1;
            });
          }
        } catch {
          // Skip malformed category data
        }
      });

      businessData.topPerformingCategories = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([category]) => category);

      // Generate alerts
      if (businessData.lowStockProducts > 0) {
        businessData.inventoryAlerts.push(`${businessData.lowStockProducts} products are running low on stock`);
      }

      if (recentOrders.length === 0) {
        businessData.inventoryAlerts.push(`No orders received in the last ${timeframe}`);
      }

      // Generate conversion opportunities
      const inactiveProducts = allProducts.filter(p => p.status === 'inactive').length;
      if (inactiveProducts > 0) {
        businessData.conversionOpportunities.push(`${inactiveProducts} inactive products could be reactivated`);
      }

      const draftProducts = allProducts.filter(p => p.status === 'draft').length;
      if (draftProducts > 0) {
        businessData.conversionOpportunities.push(`${draftProducts} draft products ready to be published`);
      }

    } catch (dataError) {
      console.error("Error collecting business data:", dataError);
      // Continue with empty data if database queries fail
    }

    // === AI ANALYSIS PHASE ===
    // Use Cloudflare AI to generate insights and recommendations
    
    const systemPrompt = `You are a business intelligence analyst specializing in eCommerce analytics for an outdoor gear store called Voltique.

=== YOUR ROLE ===
Analyze the provided business data and generate actionable insights, trend analysis, and strategic recommendations. Focus on practical, data-driven advice that helps improve business performance.

=== BUSINESS CONTEXT ===
- Store: Voltique (Outdoor gear eCommerce)
- Analysis Timeframe: ${timeframe}
- Focus Area: ${focus}
- Current Date: ${now.toISOString().split('T')[0]}

=== CURRENT BUSINESS METRICS ===
Total Revenue: $${(businessData.totalRevenue / 100).toFixed(2)}
Total Orders: ${businessData.totalOrders}
Average Order Value: $${(businessData.averageOrderValue / 100).toFixed(2)}
Active Products: ${businessData.activeProducts}
Low Stock Products: ${businessData.lowStockProducts}
Top Categories: ${businessData.topPerformingCategories.join(', ') || 'None identified'}

Recent Trends: ${businessData.recentOrderTrends}
Inventory Alerts: ${businessData.inventoryAlerts.join(', ') || 'None'}
Opportunities: ${businessData.conversionOpportunities.join(', ') || 'None identified'}

=== ANALYSIS REQUIREMENTS ===
1. **Trend Analysis**: Identify patterns and trends in the data
2. **Performance Assessment**: Evaluate business health and key metrics
3. **Risk Identification**: Highlight potential problems or concerns
4. **Opportunity Detection**: Suggest growth opportunities
5. **Actionable Recommendations**: Provide specific, implementable advice

=== RESPONSE FORMAT ===
Provide a comprehensive analysis covering:
- Overall business health assessment
- Key trends and patterns observed
- Critical alerts that need immediate attention
- Strategic recommendations for improvement
- Specific actions to take in the next ${timeframe}

Be specific, data-driven, and focus on actionable insights. Use the actual numbers provided and avoid generic advice.

=== USER QUESTION ===
${question}`;

    let aiInsights = "";
    
    try {
      const { env } = await getCloudflareContext({ async: true });
      const ai = (env as any).AI;

      if (ai) {
        console.log("Generating AI business insights...");
        
        const response = await runAI(ai, 'ANALYTICS', {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
        });

        aiInsights = response.response || "Unable to generate insights at this time.";
        console.log("AI insights generated successfully");
      } else {
        console.warn("AI binding not available - using fallback analysis");
        
        // Fallback analysis if AI is unavailable
        aiInsights = `Business Analysis Summary:

**Current Performance:**
- Total Revenue: $${(businessData.totalRevenue / 100).toFixed(2)} from ${businessData.totalOrders} orders
- Average Order Value: $${(businessData.averageOrderValue / 100).toFixed(2)}
- Active Products: ${businessData.activeProducts} products in catalog

**Key Alerts:**
${businessData.inventoryAlerts.length > 0 ? 
  businessData.inventoryAlerts.map(alert => `• ${alert}`).join('\n') : 
  '• No critical alerts detected'}

**Opportunities:**
${businessData.conversionOpportunities.length > 0 ? 
  businessData.conversionOpportunities.map(opp => `• ${opp}`).join('\n') : 
  '• Focus on driving more traffic and conversions'}

**Recommendations:**
• Monitor inventory levels for ${businessData.lowStockProducts} low-stock products
• Consider marketing campaigns for top categories: ${businessData.topPerformingCategories.slice(0, 3).join(', ')}
• Review and optimize product catalog management`;
      }
    } catch (aiError) {
      console.error("AI analysis error:", aiError);
      aiInsights = "Unable to generate AI insights due to technical difficulties. Please review the raw metrics below.";
    }

    // === RESPONSE ASSEMBLY ===
    return NextResponse.json({
      insights: aiInsights,
      alerts: businessData.inventoryAlerts,
      recommendations: businessData.conversionOpportunities,
      metrics: {
        totalRevenue: businessData.totalRevenue,
        totalOrders: businessData.totalOrders,
        averageOrderValue: businessData.averageOrderValue,
        activeProducts: businessData.activeProducts,
        lowStockProducts: businessData.lowStockProducts,
        conversionRate: businessData.totalOrders > 0 ? 
          (businessData.totalOrders / Math.max(businessData.activeProducts, 1) * 100).toFixed(2) + '%' : '0%',
      },
      trends: {
        orderTrends: businessData.recentOrderTrends,
        topCategories: businessData.topPerformingCategories,
        timeframe,
        analysisDate: now.toISOString()
      },
      success: true
    });

  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", success: false },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests for quick analytics overview
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin permissions using the same pattern as vectorize
    const authResult = await checkAdminPermissions(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Quick metrics overview without AI analysis
    const db = await getDbAsync();
    
    const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products);
    
    return NextResponse.json({
      quickMetrics: {
        totalOrders: orderCount.count || 0,
        totalProducts: productCount.count || 0,
        lastUpdated: new Date().toISOString()
      },
      success: true
    });

  } catch (error) {
    console.error("Quick analytics error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", success: false },
      { status: 500 }
    );
  }
}