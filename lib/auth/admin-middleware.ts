import { NextRequest } from "next/server";

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export async function checkAdminPermissions(_request: NextRequest): Promise<AdminAuthResult> {
  try {
    // TODO: TEMPORARY - Authentication disabled for development
    console.log("⚠️ WARNING: Admin authentication is DISABLED for development");
    return { success: true, userId: "dev-admin" };

    // DISABLED CODE - will re-enable later
    /*
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
    */

  } catch (error) {
    console.error("Admin auth error:", error);
    return { success: true, userId: "dev-admin" }; // Still allow access even on error
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