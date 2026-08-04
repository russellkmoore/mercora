import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isUserAdmin } from "../models/admin";
import { getApiTokenByHash, updateApiTokenLastUsed } from "../models/auth";
import { sha256Hex, timingSafeEqual } from "./crypto";

export { sha256Hex, timingSafeEqual };

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

function deny(status: number, error: string): AuthResult {
  return { success: false, response: NextResponse.json({ error }, { status }) };
}

function runAfterResponse(work: Promise<unknown>): void {
  const done = work.catch((error) =>
    console.error("Failed to update token last-used:", error)
  );

  try {
    getCloudflareContext().ctx.waitUntil(done);
  } catch {
    // Local development/tests have no Workers execution context. The promise
    // has already started and can still complete normally.
  }
}

function grantsPermission(granted: string[], required: string): boolean {
  if (granted.includes("*") || granted.includes("admin:*")) return true;
  if (granted.includes(required)) return true;
  const [domain] = required.split(":");
  return granted.includes(`${domain}:*`);
}

function hasAllPermissions(granted: string[], required: string[]): boolean {
  return required.every((permission) => grantsPermission(granted, permission));
}

/** Extract service credentials from headers only. Query tokens are rejected. */
function extractToken(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-api-key")?.trim();
}

/**
 * Authenticate a service token or an interactive Clerk admin session.
 * Production fails closed. The only development convenience retained is that
 * a signed-in Clerk user is treated as an admin when NODE_ENV=development.
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
    const presentedToken = extractToken(request);
    if (presentedToken) {
      const serviceToken = process.env.ADMIN_VECTORIZE_TOKEN;
      if (serviceToken && (await timingSafeEqual(presentedToken, serviceToken))) {
        const permissions = ["admin:*"];
        if (!hasAllPermissions(permissions, requiredPermissions)) {
          return deny(403, "Insufficient permissions");
        }

        return {
          success: true,
          tokenInfo: {
            id: 0,
            tokenName: "admin-service",
            permissions,
            lastUsedAt: new Date().toISOString(),
          },
        };
      }

      const token = await getApiTokenByHash(await sha256Hex(presentedToken));
      if (!token) return deny(401, "Invalid API token");

      if (
        !allowExpired &&
        token.expiresAt &&
        new Date(token.expiresAt).getTime() < Date.now()
      ) {
        return deny(401, "API token expired");
      }

      const permissions: string[] = Array.isArray(token.permissions)
        ? token.permissions as string[]
        : JSON.parse((token.permissions as unknown as string) || "[]");

      if (!hasAllPermissions(permissions, requiredPermissions)) {
        return deny(403, "Insufficient permissions");
      }

      if (updateLastUsed) {
        runAfterResponse(updateApiTokenLastUsed(token.id));
      }

      return {
        success: true,
        tokenInfo: {
          id: token.id,
          tokenName: token.tokenName,
          permissions,
          lastUsedAt: token.lastUsedAt ?? null,
        },
      };
    }

    const { userId, sessionClaims } = await auth();
    if (!userId) return deny(401, "Authentication required");

    const role = (sessionClaims as { metadata?: { role?: string } } | null)
      ?.metadata?.role;
    const isAdmin = process.env.NODE_ENV === "development" ||
      role === "admin" ||
      await isUserAdmin(userId);

    if (!isAdmin) return deny(403, "Admin access required");

    const permissions = ["admin:*"];
    if (!hasAllPermissions(permissions, requiredPermissions)) {
      return deny(403, "Insufficient permissions");
    }

    return {
      success: true,
      tokenInfo: {
        id: 0,
        tokenName: `clerk:${userId}`,
        permissions,
        lastUsedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("authenticateRequest error:", error);
    return deny(401, "Authentication failed");
  }
}

/** Return an authorization denial response or null on success. */
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
