import { NextRequest, NextResponse } from "next/server";

export interface AuthResult {
  success: boolean;
  response?: NextResponse;
  tokenInfo?: {
    id: number;
    tokenName: string;
    permissions: string[];
    lastUsedAt: string | null;
  };
}

/**
 * Standard permission sets for different API types
 */
export const PERMISSIONS = {
  // Vectorize operations
  VECTORIZE_READ: ["vectorize:read"],
  VECTORIZE_WRITE: ["vectorize:read", "vectorize:write"],
  
  // Order operations
  ORDERS_READ: ["orders:read"],
  ORDERS_WRITE: ["orders:read", "orders:write"],
  ORDERS_UPDATE: ["orders:read", "orders:write", "orders:update_status"],
  
  // Webhook operations
  WEBHOOKS_RECEIVE: ["webhooks:receive"],
  WEBHOOKS_CARRIER: ["webhooks:receive", "orders:update_tracking"],
  
  // Admin operations
  ADMIN_FULL: ["admin:*"],
};

/**
 * Main authentication function - TEMPORARILY DISABLED FOR DEVELOPMENT
 */
export async function authenticateRequest(
  _request: NextRequest,
  _requiredPermissions: string[] = [],
  _options: {
    updateLastUsed?: boolean;
    allowExpired?: boolean;
  } = {}
): Promise<AuthResult> {
  // TODO: TEMPORARY - Authentication disabled for development
  console.log("⚠️ WARNING: Unified authentication is DISABLED for development");
  return {
    success: true,
    tokenInfo: {
      id: 999,
      tokenName: "dev-bypass-token",
      permissions: ["admin:*"],
      lastUsedAt: new Date().toISOString()
    }
  };
}

/**
 * Convenience function for auth middleware - also disabled
 */
export async function requireAuth(
  request: NextRequest,
  requiredPermissions: string[]
): Promise<NextResponse | null> {
  const authResult = await authenticateRequest(request, requiredPermissions);
  if (!authResult.success) {
    return authResult.response!;
  }
  return null;
}