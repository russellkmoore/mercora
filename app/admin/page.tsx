/**
 * === Admin Dashboard Component ===
 *
 * The main admin dashboard providing comprehensive business insights and
 * AI-powered analytics. Features real-time metrics, order statistics,
 * and actionable business intelligence for platform management.
 *
 * === Features ===
 * - **Real-time Analytics**: Live business metrics and KPIs
 * - **AI Business Intelligence**: Natural language insights using Llama 3.1 8B
 * - **Order Management**: Order status distribution and processing metrics
 * - **Product Analytics**: Stock levels, active products, and inventory alerts
 * - **Financial Insights**: Revenue tracking and performance indicators
 * - **Quick Actions**: Direct links to management sections
 * - **Alert System**: Low stock warnings and business notifications
 *
 * === AI Analytics System ===
 * - **Natural Language Insights**: AI-generated business recommendations
 * - **Trend Analysis**: Order patterns and performance trends
 * - **Predictive Alerts**: Inventory and business alerts
 * - **Timeframe Analysis**: Week, month, quarter business intelligence
 * - **Actionable Recommendations**: Data-driven business suggestions
 *
 * === Technical Implementation ===
 * - **Client Component**: Interactive dashboard with real-time updates
 * - **State Management**: React hooks for analytics and dashboard data
 * - **API Integration**: Fetches data from admin analytics endpoint
 * - **Error Handling**: Graceful degradation for API failures
 * - **Performance**: Efficient data fetching with loading states
 *
 * === Dashboard Sections ===
 * - **Analytics Overview**: Revenue, orders, and key metrics
 * - **AI Insights**: Business intelligence and recommendations
 * - **Order Statistics**: Status breakdown and processing pipeline
 * - **Product Management**: Inventory levels and product status
 * - **Quick Access**: Navigation to admin management pages
 *
 * === Data Sources ===
 * - `/api/admin/analytics` - AI-powered business intelligence
 * - Database queries for real-time metrics
 * - Order and product status aggregations
 *
 * @returns JSX element with complete admin dashboard interface
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Package, Users,
  ShoppingCart, AlertTriangle,
  Calendar, Clock, DollarSign, Brain, Lightbulb
} from "lucide-react";
import Link from "next/link";
import { marked } from "marked";

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  draftProducts: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  lowStockAlerts: number;
}

interface AIAnalytics {
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
    timeframe: string;
    analysisDate: string;
  };
  loading: boolean;
  error?: string;
}


export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    draftProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    lowStockAlerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  const [aiAnalytics, setAiAnalytics] = useState<AIAnalytics>({
    insights: "",
    alerts: [],
    recommendations: [],
    metrics: {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      activeProducts: 0,
      lowStockProducts: 0,
      conversionRate: "0%",
    },
    trends: {
      orderTrends: "",
      topCategories: [],
      timeframe: "week",
      analysisDate: "",
    },
    loading: false,
    error: undefined,
  });

  const fetchDashboardStats = useCallback(async () => {
    try {
      // Calculate time range filter
      const now = new Date();
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      // Fetch products data
      const productsResponse = await fetch("/api/products?limit=1000");
      let totalProducts = 0;
      let activeProducts = 0;
      let inactiveProducts = 0;
      let draftProducts = 0;
      let lowStockAlerts = 0;
      
      if (productsResponse.ok) {
        const productsResult: any = await productsResponse.json();
        const products = productsResult.data || [];
        totalProducts = productsResult.meta?.total || products.length;
        activeProducts = products.filter((p: any) => p.status === 'active').length;
        inactiveProducts = products.filter((p: any) => p.status === 'inactive').length;
        draftProducts = products.filter((p: any) => p.status === 'draft').length;
        
        // Count products with low stock (quantity < 10) - check variants
        lowStockAlerts = products.reduce((count: number, p: any) => {
          const variants = p.variants || [];
          const lowStockVariants = variants.filter((v: any) => {
            const inventory = v.inventory;
            const quantity = inventory?.quantity || 0;
            return quantity > 0 && quantity < 10; // In stock but low
          });
          return count + lowStockVariants.length;
        }, 0);
      }

      // Fetch orders data
      const ordersResponse = await fetch("/api/orders?admin=true&limit=1000");
      let totalOrders = 0;
      let pendingOrders = 0;
      let processingOrders = 0;
      let shippedOrders = 0;
      let deliveredOrders = 0;
      let cancelledOrders = 0;
      let totalRevenue = 0;
      
      if (ordersResponse.ok) {
        const ordersResult: any = await ordersResponse.json();
        const allOrders = ordersResult.data || [];
        
        // Filter orders by time range
        const filteredOrders = allOrders.filter((o: any) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= startDate;
        });
        
        totalOrders = filteredOrders.length;
        pendingOrders = filteredOrders.filter((o: any) => o.status === 'pending').length;
        processingOrders = filteredOrders.filter((o: any) => o.status === 'processing').length;
        shippedOrders = filteredOrders.filter((o: any) => o.status === 'shipped').length;
        deliveredOrders = filteredOrders.filter((o: any) => o.status === 'delivered').length;
        cancelledOrders = filteredOrders.filter((o: any) => o.status === 'cancelled').length;
        
        // Calculate total revenue from delivered orders in time range
        totalRevenue = filteredOrders
          .filter((o: any) => o.status === 'delivered')
          .reduce((sum: number, order: any) => {
            const amount = order.total_amount?.amount || 0;
            return sum + amount;
          }, 0);
      }

      setStats({
        totalProducts,
        activeProducts,
        inactiveProducts,
        draftProducts,
        totalOrders,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        totalCustomers: 0, // No customer API yet
        lowStockAlerts
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats({
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        draftProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        lowStockAlerts: 0
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const fetchAIAnalytics = useCallback(async (timeframe: "day" | "week" | "month" | "quarter" = "week") => {
    setAiAnalytics(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      const response = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: "Analyze current business performance and trends",
          timeframe,
          focus: "all"
        }),
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.success) {
        setAiAnalytics({
          insights: data.insights || "",
          alerts: data.alerts || [],
          recommendations: data.recommendations || [],
          metrics: data.metrics || {
            totalRevenue: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            activeProducts: 0,
            lowStockProducts: 0,
            conversionRate: "0%",
          },
          trends: data.trends || {
            orderTrends: "",
            topCategories: [],
            timeframe,
            analysisDate: new Date().toISOString(),
          },
          loading: false,
          error: undefined,
        });
      } else {
        throw new Error(data.error || "Analytics request failed");
      }
    } catch (error) {
      console.error("Error fetching AI analytics:", error);
      setAiAnalytics(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
      }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchAIAnalytics();
  }, [timeRange, fetchDashboardStats, fetchAIAnalytics]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome to Voltique Admin</h1>
          <p className="text-gray-400 mt-2">
            Manage your outdoor gear store with AI-powered insights and automation
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Time Range:</span>
            <div className="flex rounded-lg bg-neutral-800 p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Revenue ({timeRange})</p>
              <p className="text-2xl font-bold text-green-400">
                ${(stats.totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">From delivered orders</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Orders ({timeRange})</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pendingOrders} pending, {stats.processingOrders} processing</p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Products</p>
              <p className="text-2xl font-bold text-orange-400">
                {stats.activeProducts}/{stats.totalProducts}
              </p>
              <p className="text-xs text-gray-500 mt-1">{stats.inactiveProducts} inactive, {stats.draftProducts} draft</p>
            </div>
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-red-400">{stats.lowStockAlerts}</p>
              <p className="text-xs text-gray-500 mt-1">Items with &lt;10 quantity</p>
            </div>
            <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* AI Business Insights */}
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-purple-900/20 to-blue-800/20 border-purple-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI Business Intelligence</h3>
                <p className="text-sm text-gray-400">Powered by advanced analytics</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => fetchAIAnalytics("week")}
                disabled={aiAnalytics.loading}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
              >
                {aiAnalytics.loading ? "Analyzing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {aiAnalytics.loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">AI is analyzing your business data...</div>
            </div>
          ) : aiAnalytics.error ? (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">Error: {aiAnalytics.error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AI Insights */}
              <div className="lg:col-span-2">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <Lightbulb className="w-4 h-4 mr-2 text-yellow-400" />
                  AI Analysis
                </h4>
                <div className="bg-neutral-800/50 rounded-lg p-4">
                  <div
                    className="text-gray-300 text-sm prose prose-sm prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: aiAnalytics.insights ? marked(aiAnalytics.insights) : ''
                    }}
                  />
                </div>
              </div>

              {/* Alerts and Recommendations */}
              <div className="space-y-4">
                {/* Smart Alerts */}
                {aiAnalytics.alerts.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
                      Smart Alerts
                    </h4>
                    <div className="space-y-2">
                      {aiAnalytics.alerts.map((alert, index) => (
                        <div key={index} className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                          <p className="text-red-300 text-xs">{alert}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {aiAnalytics.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-white font-medium mb-3 flex items-center">
                      <Lightbulb className="w-4 h-4 mr-2 text-green-400" />
                      Opportunities
                    </h4>
                    <div className="space-y-2">
                      {aiAnalytics.recommendations.map((rec, index) => (
                        <div key={index} className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                          <p className="text-green-300 text-xs">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Order Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Distribution */}
        <Card className="bg-neutral-800 border-neutral-700 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Order Status Distribution</h3>
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">Pending</p>
                <div className="w-full bg-neutral-700 rounded-full h-3 mt-1">
                  <div className="bg-yellow-400 h-3 rounded-full" style={{width: `${stats.totalOrders > 0 ? (stats.pendingOrders / stats.totalOrders) * 100 : 0}%`}}></div>
                </div>
              </div>
              <span className="text-sm text-gray-400 ml-3">{stats.pendingOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">Processing</p>
                <div className="w-full bg-neutral-700 rounded-full h-3 mt-1">
                  <div className="bg-blue-400 h-3 rounded-full" style={{width: `${stats.totalOrders > 0 ? (stats.processingOrders / stats.totalOrders) * 100 : 0}%`}}></div>
                </div>
              </div>
              <span className="text-sm text-gray-400 ml-3">{stats.processingOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">Shipped</p>
                <div className="w-full bg-neutral-700 rounded-full h-3 mt-1">
                  <div className="bg-orange-400 h-3 rounded-full" style={{width: `${stats.totalOrders > 0 ? (stats.shippedOrders / stats.totalOrders) * 100 : 0}%`}}></div>
                </div>
              </div>
              <span className="text-sm text-gray-400 ml-3">{stats.shippedOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">Delivered</p>
                <div className="w-full bg-neutral-700 rounded-full h-3 mt-1">
                  <div className="bg-green-400 h-3 rounded-full" style={{width: `${stats.totalOrders > 0 ? (stats.deliveredOrders / stats.totalOrders) * 100 : 0}%`}}></div>
                </div>
              </div>
              <span className="text-sm text-gray-400 ml-3">{stats.deliveredOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300">Cancelled</p>
                <div className="w-full bg-neutral-700 rounded-full h-3 mt-1">
                  <div className="bg-red-400 h-3 rounded-full" style={{width: `${stats.totalOrders > 0 ? (stats.cancelledOrders / stats.totalOrders) * 100 : 0}%`}}></div>
                </div>
              </div>
              <span className="text-sm text-gray-400 ml-3">{stats.cancelledOrders}</span>
            </div>
          </div>
        </Card>

        {/* Product Status Breakdown */}
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Product Status</h3>
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-300">Active</span>
              </div>
              <span className="text-lg font-semibold text-green-400">{stats.activeProducts}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-300">Inactive</span>
              </div>
              <span className="text-lg font-semibold text-gray-400">{stats.inactiveProducts}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="text-sm text-gray-300">Draft</span>
              </div>
              <span className="text-lg font-semibold text-yellow-400">{stats.draftProducts}</span>
            </div>
            <div className="pt-2 border-t border-neutral-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Total Products</span>
                <span className="text-xl font-bold text-white">{stats.totalProducts}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue & Performance Trends */}
      <Card className="bg-neutral-800 border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Financial Overview ({timeRange})</h3>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Total Revenue</span>
              <span className="text-white font-semibold">
                ${(stats.totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (stats.totalRevenue / 10000))}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">Target: $100.00</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Average Order Value</span>
              <span className="text-white font-semibold">
                ${stats.totalOrders > 0 ? ((stats.totalRevenue / stats.totalOrders) / 100).toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ 
                  width: `${Math.min(100, stats.totalOrders > 0 ? ((stats.totalRevenue / stats.totalOrders) / 100) * 2 : 0)}%` 
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">Target: $50.00</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Completion Rate</span>
              <span className="text-white font-semibold">
                {stats.totalOrders > 0 ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full" 
                style={{ 
                  width: `${stats.totalOrders > 0 ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100) : 0}%` 
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">Target: 95%</p>
          </div>
        </div>
      </Card>

      {/* Alerts & Notifications */}
      {stats.lowStockAlerts > 0 && (
        <Card className="bg-orange-900/20 border-orange-500/30 p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-400 mb-2">Inventory Alert</h3>
              <p className="text-gray-300 text-sm mb-3">
                {stats.lowStockAlerts} products are running low on inventory and may need restocking soon.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
              >
                <Link href="/admin/products">Review Inventory</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
