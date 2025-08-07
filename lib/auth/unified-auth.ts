import { NextRequest, NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { apiTokens, getApiTokenByHash, updateApiTokenLastUsed, insertApiToken } from "@/lib/models/auth";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * Unified Authentication Middleware for Admin APIs
 * 
 * Supports multiple authentication methods:
 * 1. Bearer token in Authorization header
 * 2. Token in query parameter (for backward compatibility)
 * 3. X-API-Key header
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = await authenticateRequest(request, ["orders:write", "orders:update_status"]);
 *   if (!authResult.success) {
 *     return authResult.response;
 *   }
 *   
 *   // Your authenticated logic here
 * }
 * ```
 */

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

export interface TokenPermissions {
  vectorize: string[];
  orders: string[];
  webhooks: string[];
  admin: string[];
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
 * Extract token from request using multiple methods
 */
function extractToken(request: NextRequest): string | null {
  // Method 1: Bearer token in Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  // Method 2: X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Method 3: Query parameter (for backward compatibility)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token");
  if (tokenParam) {
    return tokenParam;
  }
  
  return null;
}

/**
 * Hash token using SHA-256 (same method used for storage)
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Check if required permissions are satisfied by token permissions
 */
function hasRequiredPermissions(tokenPermissions: string[], requiredPermissions: string[]): boolean {
  // Check for admin wildcard
  if (tokenPermissions.includes("admin:*")) {
    return true;
  }
  
  // Check each required permission
  return requiredPermissions.every(required => {
    // Direct match
    if (tokenPermissions.includes(required)) {
      return true;
    }
    
    // Check for wildcard permissions (e.g., "orders:*" covers "orders:read")
    const [scope] = required.split(":");
    return tokenPermissions.includes(`${scope}:*`);
  });
}

/**
 * Main authentication function
 */
export async function authenticateRequest(
  request: NextRequest,
  requiredPermissions: string[] = [],
  options: {
    updateLastUsed?: boolean;
    allowExpired?: boolean;
  } = {}
): Promise<AuthResult> {
  const { updateLastUsed = true, allowExpired = false } = options;
  
  try {
    // Extract token from request
    const token = extractToken(request);
    if (!token) {
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: "Authentication required",
            message: "Provide token via Authorization header (Bearer), X-API-Key header, or query parameter" 
          },
          { status: 401 }
        ),
      };
    }
    
    // Hash the token for database lookup
    const tokenHash = hashToken(token);
    
    // Look up token in database using the new model function
    const tokenRecord = await getApiTokenByHash(tokenHash);
    
    if (!tokenRecord) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        ),
      };
    }
    
    // Check expiration
    if (!allowExpired && tokenRecord.expiresAt) {
      const expirationDate = new Date(tokenRecord.expiresAt);
      if (expirationDate < new Date()) {
        return {
          success: false,
          response: NextResponse.json(
            { error: "Token expired" },
            { status: 401 }
          ),
        };
      }
    }
    
    // Parse permissions
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(tokenRecord.permissions as string);
    } catch (error) {
      console.error("Failed to parse token permissions:", error);
      return {
        success: false,
        response: NextResponse.json(
          { error: "Invalid token configuration" },
          { status: 500 }
        ),
      };
    }
    
    // Check permissions
    if (requiredPermissions.length > 0 && !hasRequiredPermissions(permissions, requiredPermissions)) {
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: "Insufficient permissions",
            required: requiredPermissions,
            granted: permissions
          },
          { status: 403 }
        ),
      };
    }
    
    // Update last used timestamp
    if (updateLastUsed) {
      await updateApiTokenLastUsed(tokenRecord.id);
    }
    
    return {
      success: true,
      tokenInfo: {
        id: tokenRecord.id,
        tokenName: tokenRecord.tokenName,
        permissions,
        lastUsedAt: tokenRecord.lastUsedAt,
      },
    };
    
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Authentication service error" },
        { status: 500 }
      ),
    };
  }
}

/**
 * Middleware wrapper for easy use in API routes
 */
export function withAuth(
  handler: (request: NextRequest, authInfo: NonNullable<AuthResult["tokenInfo"]>) => Promise<NextResponse>,
  requiredPermissions: string[] = []
) {
  return async (request: NextRequest) => {
    const authResult = await authenticateRequest(request, requiredPermissions);
    
    if (!authResult.success) {
      return authResult.response!;
    }
    
    return handler(request, authResult.tokenInfo!);
  };
}

/**
 * Generate a new API token (for setup/management scripts)
 */
export async function generateApiToken(): Promise<string> {
  // Generate a secure random token
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Store a new API token in the database
 */
export async function storeApiToken(
  tokenName: string,
  token: string,
  permissions: string[],
  expiresAt?: Date
): Promise<void> {
  const tokenHash = hashToken(token);
  
  await insertApiToken({
    tokenName,
    tokenHash,
    permissions,
    expiresAt: expiresAt?.toISOString(),
  });
}

/**
 * Revoke an API token (moved to auth model)
 */
export { revokeApiToken } from "@/lib/models/auth";
