/**
 * === Enhanced User Context Hook ===
 * 
 * Comprehensive user data gathering for personalized AI interactions.
 * Combines Clerk user data with order history and preferences.
 */

import { useUser } from "@clerk/nextjs";
import { useState, useEffect, useMemo } from "react";
import type { Order } from "@/lib/types";

export interface EnhancedUserContext {
  // Basic user info from Clerk
  userId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  
  // Enhanced Clerk profile data
  username?: string;
  imageUrl?: string;
  createdAt?: Date;
  lastSignInAt?: Date;
  profileComplete: boolean;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  
  // Derived user insights
  accountAge: number; // Days since account creation
  customerLifecycle: 'new' | 'active' | 'returning' | 'dormant' | 'champion';
  engagementLevel: 'low' | 'medium' | 'high';
  
  // Location insights
  primaryLocation?: {
    country: string;
    region?: string;
    city?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  locationPattern: 'single' | 'multiple' | 'unknown';
  seasonalContext?: {
    hemisphere: 'northern' | 'southern' | 'tropical';
    currentSeason: 'spring' | 'summer' | 'fall' | 'winter';
  };
  
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
        
        // Fetch user's order history (using consolidated orders API)
        const ordersResponse = await fetch(`/api/orders?userId=${user.id}`);
        if (ordersResponse.ok) {
          const response = await ordersResponse.json() as { data?: Order[] };
          const userOrders: Order[] = response.data || [];
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

    const totalOrderValue = orders.reduce((sum, order) => {
      const orderValue = order.total_amount?.amount || 0;
      return sum + orderValue;
    }, 0);
    const averageOrderValue = totalOrderValue / orders.length;
    
    // Extract product IDs from recent orders (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentOrders = orders.filter(order => 
      order.created_at && new Date(order.created_at) >= threeMonthsAgo
    );
    
    const recentPurchases = recentOrders
      .flatMap(order => 
        (order.items || []).map(item => 
          String(item.product_id || item.id)
        )
      )
      .slice(0, 10); // Last 10 products
    
    // Category analysis would require product data - simplified for now
    const favoriteCategories: string[] = []; // TODO: Implement with product category mapping
    
    // Price range analysis
    const orderValues = orders.map(order => order.total_amount?.amount || 0).filter(val => val > 0);
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

  // Calculate additional user insights from Clerk data
  const accountAge = user?.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const daysSinceLastSignIn = user?.lastSignInAt ? Math.floor((Date.now() - user.lastSignInAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Determine customer lifecycle stage
  const customerLifecycle = determineCustomerLifecycle(orders, accountAge, daysSinceLastSignIn, userInsights.totalOrderValue);
  
  // Calculate engagement level
  const engagementLevel = calculateEngagementLevel(user, orders, daysSinceLastSignIn);
  
  // Extract location insights from order history
  const locationInsights = extractLocationInsights(orders);
  
  return {
    // Basic Clerk user data
    userId: user?.id,
    firstName: user?.firstName || undefined,
    lastName: user?.lastName || undefined,
    fullName: user?.fullName || undefined,
    email: user?.primaryEmailAddress?.emailAddress || undefined,
    
    // Enhanced Clerk profile data
    username: user?.username || undefined,
    imageUrl: user?.imageUrl || undefined,
    createdAt: user?.createdAt || undefined,
    lastSignInAt: user?.lastSignInAt || undefined,
    profileComplete: !!(user?.firstName && user?.lastName && user?.primaryEmailAddress),
    emailVerified: user?.primaryEmailAddress?.verification?.status === 'verified',
    phoneNumber: user?.primaryPhoneNumber?.phoneNumber || undefined,
    phoneVerified: user?.primaryPhoneNumber?.verification?.status === 'verified',
    
    // Derived insights
    accountAge,
    customerLifecycle,
    engagementLevel,
    
    // Location insights
    ...locationInsights,
    
    // Order data
    orders,
    
    // Calculated insights from orders
    ...userInsights,
    
    // Loading states
    isLoading: isLoading || !isLoaded,
    error,
  };
}

// Helper functions for user insights
function determineCustomerLifecycle(
  orders: Order[], 
  accountAge: number, 
  daysSinceLastSignIn: number, 
  totalSpent: number
): 'new' | 'active' | 'returning' | 'dormant' | 'champion' {
  if (accountAge <= 7) return 'new';
  if (totalSpent > 2000 && orders.length >= 5) return 'champion';
  if (daysSinceLastSignIn > 90) return 'dormant';
  if (orders.length > 2 && daysSinceLastSignIn <= 30) return 'active';
  return 'returning';
}

function calculateEngagementLevel(
  user: any, 
  orders: Order[], 
  daysSinceLastSignIn: number
): 'low' | 'medium' | 'high' {
  let score = 0;
  
  // Recent activity
  if (daysSinceLastSignIn <= 7) score += 3;
  else if (daysSinceLastSignIn <= 30) score += 2;
  else if (daysSinceLastSignIn <= 90) score += 1;
  
  // Profile completeness
  if (user?.firstName && user?.lastName) score += 1;
  if (user?.primaryEmailAddress?.verification?.status === 'verified') score += 1;
  if (user?.primaryPhoneNumber?.verification?.status === 'verified') score += 1;
  
  // Purchase activity
  const recentOrders = orders.filter(order => {
    if (!order.created_at) return false;
    const orderDate = new Date(order.created_at);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return orderDate >= threeMonthsAgo;
  });
  
  if (recentOrders.length >= 3) score += 3;
  else if (recentOrders.length >= 1) score += 2;
  
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function extractLocationInsights(orders: Order[]) {
  if (orders.length === 0) {
    return {
      locationPattern: 'unknown' as const,
      primaryLocation: undefined,
      seasonalContext: undefined,
    };
  }

  // Extract all shipping addresses
  const addresses = orders
    .map(order => order.shipping_address)
    .filter(addr => addr && addr.country)
    .slice(0, 10); // Analyze last 10 orders for location patterns

  if (addresses.length === 0) {
    return {
      locationPattern: 'unknown' as const,
      primaryLocation: undefined,
      seasonalContext: undefined,
    };
  }

  // Find most common location
  const locationCounts = addresses.reduce((acc, addr) => {
    if (!addr || !addr.country) return acc;
    const key = `${addr.country}-${addr.region || ''}-${addr.city || ''}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostCommonLocation = Object.entries(locationCounts)
    .sort(([,a], [,b]) => b - a)[0];

  if (!mostCommonLocation) {
    return {
      locationPattern: 'unknown' as const,
      primaryLocation: undefined,
      seasonalContext: undefined,
    };
  }

  const [locationKey] = mostCommonLocation;
  const [country, region, city] = locationKey.split('-');

  // Find the most recent address for this location for coordinates
  const recentAddress = addresses
    .reverse() // Most recent first
    .find(addr => 
      addr && addr.country === country && 
      (addr.region || '') === region && 
      (addr.city || '') === city
    );

  const primaryLocation = {
    country: country || 'Unknown',
    region: region || undefined,
    city: city || undefined,
    coordinates: recentAddress?.coordinates ? {
      latitude: recentAddress.coordinates.latitude,
      longitude: recentAddress.coordinates.longitude,
    } : undefined,
  };

  // Determine location pattern
  const uniqueCountries = new Set(addresses.filter((addr): addr is NonNullable<typeof addr> => addr?.country != null).map(addr => addr.country)).size;
  const locationPattern = uniqueCountries > 1 ? 'multiple' : 'single';

  // Determine seasonal context based on primary location
  const seasonalContext = getSeasonalContext(country);

  return {
    primaryLocation,
    locationPattern: locationPattern as 'single' | 'multiple',
    seasonalContext,
  };
}

function getSeasonalContext(country: string) {
  const now = new Date();
  const month = now.getMonth(); // 0-11

  // Hemisphere mapping (simplified)
  const southernHemisphere = ['AU', 'NZ', 'BR', 'AR', 'CL', 'ZA', 'UY', 'PY'];
  const tropicalCountries = ['SG', 'MY', 'ID', 'TH', 'VN', 'PH', 'IN', 'LK'];

  if (tropicalCountries.includes(country)) {
    return {
      hemisphere: 'tropical' as const,
      currentSeason: 'summer' as const, // Tropical regions are generally warm year-round
    };
  }

  const isNorthern = !southernHemisphere.includes(country);
  
  let season: 'spring' | 'summer' | 'fall' | 'winter';
  
  if (isNorthern) {
    // Northern hemisphere
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';
  } else {
    // Southern hemisphere (opposite seasons)
    if (month >= 2 && month <= 4) season = 'fall';
    else if (month >= 5 && month <= 7) season = 'winter';
    else if (month >= 8 && month <= 10) season = 'spring';
    else season = 'summer';
  }

  return {
    hemisphere: isNorthern ? ('northern' as const) : ('southern' as const),
    currentSeason: season,
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
  
  // Basic user info with enhanced personalization
  if (context.firstName) {
    parts.push(`User: ${context.firstName}`);
  }
  
  // Account and engagement insights
  if (context.accountAge > 0) {
    parts.push(`Account age: ${context.accountAge} days`);
    parts.push(`Lifecycle: ${context.customerLifecycle}`);
    parts.push(`Engagement: ${context.engagementLevel}`);
  }
  
  // Profile completeness insights
  const profileInsights = [];
  if (context.emailVerified) profileInsights.push('email verified');
  if (context.phoneVerified) profileInsights.push('phone verified');
  if (!context.profileComplete) profileInsights.push('profile incomplete');
  if (profileInsights.length > 0) {
    parts.push(`Profile: ${profileInsights.join(', ')}`);
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
  
  // Recent activity insights
  if (context.lastSignInAt) {
    const daysSince = Math.floor((Date.now() - context.lastSignInAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) {
      parts.push("Active today");
    } else if (daysSince === 1) {
      parts.push("Last active yesterday");
    } else if (daysSince <= 7) {
      parts.push(`Last active ${daysSince} days ago`);
    } else if (daysSince > 30) {
      parts.push("Returning after extended absence");
    }
  }
  
  // Location insights
  if (context.primaryLocation) {
    const loc = context.primaryLocation;
    let locationStr = `Location: ${loc.country}`;
    if (loc.region) locationStr += `, ${loc.region}`;
    if (loc.city) locationStr += `, ${loc.city}`;
    parts.push(locationStr);
    
    if (context.locationPattern === 'multiple') {
      parts.push("Ships to multiple locations");
    }
    
    if (context.seasonalContext) {
      const season = context.seasonalContext.currentSeason;
      parts.push(`Current season: ${season}`);
    }
  }
  
  return parts.join(' | ');
}
