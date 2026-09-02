import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isUserAdmin, isUserSuperAdmin, updateAdminLastLogin } from "../models/admin";
import { timingSafeEqual } from "./crypto";
import { hasSameOrigin } from "./same-origin";
import { assertDeploymentPosture } from "./deployment-guard";

const ORIGIN_REQUIRED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  userId?: string;
  isDevMode?: boolean;
  isServiceToken?: boolean;
}

export async function checkAdminPermissions(request: NextRequest): Promise<AdminAuthResult> {
  try {
    const posture = assertDeploymentPosture();
    if (posture.tripped) {
      return { success: false, error: posture.message };
    }

    // Check for development mode bypass token first
    const devToken = request.headers.get("x-dev-admin");
    
    if (devToken === "mercora-dev-bypass" && process.env.NODE_ENV === "development") {
      console.log("⚠️ DEV MODE: Admin authentication bypassed with dev token");
      return { success: true, userId: "dev-admin", isDevMode: true };
    }

    // Header-only: URL credentials leak through logs, browser history, and Referer.
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "") ||
                     request.headers.get("x-api-key");
    
    if (authToken) {
      // Use admin vectorize token for server-to-server admin API calls
      const adminToken = process.env.ADMIN_VECTORIZE_TOKEN;
      
      if (adminToken && (await timingSafeEqual(authToken, adminToken))) {
        return { success: true, userId: "admin-service", isServiceToken: true };
      }
    }

    // Header-only dev/service identities are not browser-cookie requests. Any
    // mutating Clerk/cookie request must come from this request's exact origin.
    if (ORIGIN_REQUIRED_METHODS.has(request.method.toUpperCase()) && !hasSameOrigin(request)) {
      return {
        success: false,
        error: "Request origin validation failed.",
      };
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

      // Check admin status in database
      const isAdmin = await isUserAdmin(userId);
      
      if (isAdmin) {
        // Update last login timestamp
        updateAdminLastLogin(userId).catch(console.error);
        return { success: true, userId };
      }

      // Fallback: Check for admin role in Clerk metadata (for backward compatibility)
      const userRole = (sessionClaims as any)?.metadata?.role;
      if (userRole === "admin") {
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

/** Service credentials and development bypasses cannot authorize stored code. */
export async function isSuperAdminActor(result: AdminAuthResult): Promise<boolean> {
  if (!result.success || !result.userId || result.isServiceToken || result.isDevMode) {
    return false;
  }
  return isUserSuperAdmin(result.userId);
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
