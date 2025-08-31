import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  userId?: string;
  isDevMode?: boolean;
}

export async function checkAdminPermissions(request: NextRequest): Promise<AdminAuthResult> {
  try {
    // Check for development mode bypass token first
    const devToken = request.headers.get("x-dev-admin") || 
                    request.nextUrl.searchParams.get("dev");
    
    if (devToken === "mercora-dev-bypass" && process.env.NODE_ENV === "development") {
      console.log("⚠️ DEV MODE: Admin authentication bypassed with dev token");
      return { success: true, userId: "dev-admin", isDevMode: true };
    }

    // Check for API token-based auth (for server-to-server calls)
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "") ||
                     request.nextUrl.searchParams.get("token");
    
    if (authToken) {
      // Use admin vectorize token for server-to-server admin API calls
      const adminToken = process.env.ADMIN_VECTORIZE_TOKEN;
      
      if (adminToken && authToken === adminToken) {
        return { success: true, userId: "admin-service" };
      }
    }

    // Check Clerk authentication for browser-based requests
    try {
      const { userId, sessionClaims } = await auth();
      
      if (!userId) {
        return { success: false, error: "Authentication required. Please sign in." };
      }

      // For now, allow any authenticated user to be admin in development
      // In production, you should check specific user IDs or roles
      if (process.env.NODE_ENV === "development") {
        console.log(`✅ DEV MODE: User ${userId} granted admin access`);
        return { success: true, userId };
      }

      // Production admin check - check for admin role in metadata
      const userRole = (sessionClaims as any)?.metadata?.role;
      const adminUsers = process.env.ADMIN_USER_IDS?.split(",") || [];
      
      if (userRole === "admin" || adminUsers.includes(userId)) {
        return { success: true, userId };
      }

      return { 
        success: false, 
        error: "Admin access required. Contact administrator to request access." 
      };

    } catch (clerkError) {
      console.error("Clerk auth error:", clerkError);
      return { 
        success: false, 
        error: "Authentication service error. Please try again." 
      };
    }

  } catch (error) {
    console.error("Admin auth error:", error);
    return { 
      success: false, 
      error: "Authentication error. Please try again." 
    };
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