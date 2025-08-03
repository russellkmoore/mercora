/**
 * === Enhanced User Context Hook ===
 * 
 * Comprehensive user data gathering for personalized AI interactions.
 * Combines Clerk user data with order history and preferences.
 */

import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useMemo } from "react";
import type { Order } from "@/lib/types/order";

export interface EnhancedUserContext {
  // Basic user info from Clerk
  userId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  
  // Order history and preferences
  orders: Order[];
  totalOrderValue: number;
  favoriteCategories: string[];
  recentPurchases: string[]; // Product IDs
  averageOrderValue: number;
  
  // User behavior insights
  isFirstTimeUser: boolean;
  isVipCustomer: boolean; // Based on order history
  preferredPriceRange: { min: number; max: number } | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to gather comprehensive user context for AI personalization
 */
export function useEnhancedUserContext(): EnhancedUserContext {
  const { user, isLoaded } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's order history
  useEffect(() => {
    async function fetchUserData() {
      if (!user?.id || !isLoaded) return;

      try {
        setIsLoading(true);
        
        // Fetch user's order history
        const ordersResponse = await fetch(`/api/user-orders?userId=${user.id}`);
        if (ordersResponse.ok) {
          const userOrders: Order[] = await ordersResponse.json();
          setOrders(userOrders);
        }
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user context:', err);
        setError('Failed to load user data');
        setOrders([]); // Fallback to empty array
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [user?.id, isLoaded]);

  // Calculate user insights from order history
  const userInsights = useMemo(() => {
    if (!orders.length) {
      return {
        totalOrderValue: 0,
        favoriteCategories: [],
        recentPurchases: [],
        averageOrderValue: 0,
        isFirstTimeUser: true,
        isVipCustomer: false,
        preferredPriceRange: null,
      };
    }

    const totalOrderValue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrderValue / orders.length;
    
    // Extract product IDs from recent orders (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentOrders = orders.filter(order => 
      new Date(order.createdAt) >= threeMonthsAgo
    );
    
    const recentPurchases = recentOrders
      .flatMap(order => order.items.map(item => String(item.productId)))
      .slice(0, 10); // Last 10 products
    
    // Category analysis would require product data - simplified for now
    const favoriteCategories: string[] = []; // TODO: Implement with product category mapping
    
    // Price range analysis
    const orderValues = orders.map(order => order.total);
    const preferredPriceRange = orderValues.length > 0 ? {
      min: Math.min(...orderValues),
      max: Math.max(...orderValues)
    } : null;

    return {
      totalOrderValue,
      favoriteCategories,
      recentPurchases,
      averageOrderValue,
      isFirstTimeUser: false,
      isVipCustomer: totalOrderValue > 1000, // $1000+ total spending
      preferredPriceRange,
    };
  }, [orders]);

  return {
    // Clerk user data
    userId: user?.id,
    firstName: user?.firstName || undefined,
    lastName: user?.lastName || undefined,
    fullName: user?.fullName || undefined,
    email: user?.primaryEmailAddress?.emailAddress || undefined,
    
    // Order data
    orders,
    
    // Calculated insights
    ...userInsights,
    
    // Loading states
    isLoading: isLoading || !isLoaded,
    error,
  };
}

/**
 * Format user context for AI agent consumption
 */
export function formatUserContextForAI(context: EnhancedUserContext): string {
  if (context.isLoading) {
    return "User data is loading...";
  }

  const parts = [];
  
  // Basic user info
  if (context.firstName) {
    parts.push(`User: ${context.firstName}`);
  }
  
  // Purchase behavior
  if (context.orders.length > 0) {
    parts.push(`${context.orders.length} previous orders`);
    parts.push(`Total spent: $${context.totalOrderValue.toFixed(2)}`);
    parts.push(`Average order: $${context.averageOrderValue.toFixed(2)}`);
    
    if (context.isVipCustomer) {
      parts.push("VIP Customer");
    }
    
    if (context.recentPurchases.length > 0) {
      parts.push(`Recent purchases: ${context.recentPurchases.slice(0, 3).join(', ')}`);
    }
  } else {
    parts.push("First-time customer");
  }
  
  return parts.join(' | ');
}
