"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Package, FileText, Percent, Users, 
  ShoppingCart, TrendingUp, AlertTriangle, Bot,
  Calendar, Clock, DollarSign
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  activePromotions: number;
  knowledgeArticles: number;
  lowStockAlerts: number;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    activePromotions: 0,
    knowledgeArticles: 0,
    lowStockAlerts: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Replace with actual API calls
      // Mock data for now
      setStats({
        totalProducts: 47,
        activeProducts: 42,
        totalOrders: 1834,
        totalRevenue: 89425,
        totalCustomers: 456,
        activePromotions: 3,
        knowledgeArticles: 8,
        lowStockAlerts: 5
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const quickActions: QuickAction[] = [
    {
      title: "Add Product",
      description: "Create a new product with AI assistance",
      href: "/admin/products",
      icon: <Package className="w-5 h-5" />,
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "New Knowledge Article",
      description: "Write a new help article for customers",
      href: "/admin/knowledge",
      icon: <FileText className="w-5 h-5" />,
      color: "bg-green-600 hover:bg-green-700"
    },
    {
      title: "Create Promotion",
      description: "Set up discount codes and campaigns",
      href: "/admin/promotions",
      icon: <Percent className="w-5 h-5" />,
      color: "bg-purple-600 hover:bg-purple-700"
    },
    {
      title: "Ask Volt AI",
      description: "Get insights about your store performance",
      href: "#",
      icon: <Bot className="w-5 h-5" />,
      color: "bg-orange-600 hover:bg-orange-700"
    }
  ];

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
      <div>
        <h1 className="text-3xl font-bold text-white">Welcome to Voltique Admin</h1>
        <p className="text-gray-400 mt-2">
          Manage your outdoor gear store with AI-powered insights and automation
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-green-400">
                ${stats.totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-green-500 mt-1">↑ 12% from last month</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalOrders}</p>
              <p className="text-xs text-blue-500 mt-1">↑ 8% from last month</p>
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
              <p className="text-xs text-gray-500 mt-1">{stats.totalProducts - stats.activeProducts} inactive</p>
            </div>
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Customers</p>
              <p className="text-2xl font-bold text-purple-400">{stats.totalCustomers}</p>
              <p className="text-xs text-purple-500 mt-1">↑ 15% from last month</p>
            </div>
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <Card className="bg-neutral-800 border-neutral-700 p-6 hover:bg-neutral-750 transition-colors cursor-pointer">
                <div className="flex items-start space-x-4">
                  <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center text-white`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm">{action.title}</h3>
                    <p className="text-gray-400 text-xs mt-1">{action.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">System Status</h3>
            <Badge variant="default" className="bg-green-600 text-white">
              All Systems Operational
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Website Performance</span>
              <Badge variant="default" className="bg-green-600 text-white text-xs">Excellent</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">AI Assistant (Volt)</span>
              <Badge variant="default" className="bg-green-600 text-white text-xs">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Payment Processing</span>
              <Badge variant="default" className="bg-green-600 text-white text-xs">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Vector Database</span>
              <Badge variant="default" className="bg-green-600 text-white text-xs">Synced</Badge>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <Button variant="ghost" size="sm" className="text-orange-500">
              View All
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm">New order #1847 received</p>
                <p className="text-gray-500 text-xs">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm">Product "Solar Panel Kit" updated</p>
                <p className="text-gray-500 text-xs">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm">Volt AI knowledge base reindexed</p>
                <p className="text-gray-500 text-xs">1 hour ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-gray-300 text-sm">Promotion "SUMMER20" created</p>
                <p className="text-gray-500 text-xs">3 hours ago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

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
              <Link href="/admin/products">
                <Button variant="outline" size="sm" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black">
                  Review Inventory
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* AI Assistant Card */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border-orange-500/30 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              Volt AI Assistant
            </h3>
            <p className="text-gray-300 text-sm">
              Your AI-powered assistant is ready to help with inventory insights, customer analysis, 
              and content optimization. Ask questions about your store performance or get help with tasks.
            </p>
          </div>
          <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black">
            Ask Volt AI
          </Button>
        </div>
      </Card>
    </div>
  );
}