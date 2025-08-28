import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export async function checkAdminPermissions(request: NextRequest): Promise<AdminAuthResult> {
  try {
    // Check for token-based auth first (for API calls)
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "") ||
                     request.nextUrl.searchParams.get("token");
    
    if (authToken) {
      // Use the same token pattern as vectorize endpoint
      const adminToken = process.env.ADMIN_VECTORIZE_TOKEN;
      
      if (adminToken && authToken === adminToken) {
        return { success: true };
      }
    }

    // Check Clerk authentication
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return { success: false, error: "Authentication required" };
    }

    // Check if user has admin role
    const userRole = (sessionClaims as any)?.metadata?.role;
    if (userRole !== "admin") {
      return { success: false, error: "Admin access required" };
    }

    return { success: true, userId };

  } catch (error) {
    console.error("Admin auth error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

export const ADMIN_PERMISSIONS = {
  PRODUCTS: "admin:products",
  ORDERS: "admin:orders", 
  CUSTOMERS: "admin:customers",
  PROMOTIONS: "admin:promotions",
  KNOWLEDGE: "admin:knowledge",
  ANALYTICS: "admin:analytics",
  SETTINGS: "admin:settings"
} as const;