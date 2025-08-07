#!/usr/bin/env node

/**
 * API Token Management Utility
 * 
 * Usage:
 *   npm run token:generate admin_orders "orders:read,orders:write,orders:update_status"
 *   npm run token:generate admin_vectorize "vectorize:read,vectorize:write"
 *   npm run token:generate webhook_carrier "webhooks:receive,orders:update_tracking"
 *   npm run token:list
 *   npm run token:revoke admin_orders
 */

import { generateApiToken, storeApiToken, revokeApiToken } from "@/lib/auth/unified-auth";
import { getAllApiTokens } from "@/lib/models/auth";

async function generateToken(tokenName: string, permissionsStr: string, expirationDays?: number) {
  try {
    const permissions = permissionsStr.split(",").map(p => p.trim());
    const token = await generateApiToken();
    
    const expiresAt = expirationDays ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) : undefined;
    
    await storeApiToken(tokenName, token, permissions, expiresAt);
    
    console.log(`✅ Generated token for ${tokenName}:`);
    console.log(`Token: ${token}`);
    console.log(`Permissions: ${permissions.join(", ")}`);
    if (expiresAt) {
      console.log(`Expires: ${expiresAt.toISOString()}`);
    }
    console.log(`\n🔒 Store this token securely - it cannot be retrieved again!`);
    console.log(`\n📝 To use in API calls:`);
    console.log(`Authorization: Bearer ${token}`);
    console.log(`or`);
    console.log(`X-API-Key: ${token}`);
    
  } catch (error) {
    console.error("❌ Failed to generate token:", error);
    process.exit(1);
  }
}

async function listTokens() {
  try {
    const tokens = await getAllApiTokens();
    
    console.log("📋 API Tokens:");
    console.log("================");
    
    for (const token of tokens) {
      const permissions = JSON.parse(token.permissions as string);
      const status = token.active ? "🟢 Active" : "🔴 Inactive";
      const lastUsed = token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : "Never";
      const expires = token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "Never";
      
      console.log(`\n${status} ${token.tokenName}`);
      console.log(`  ID: ${token.id}`);
      console.log(`  Permissions: ${permissions.join(", ")}`);
      console.log(`  Last Used: ${lastUsed}`);
      console.log(`  Expires: ${expires}`);
      console.log(`  Created: ${new Date(token.createdAt).toLocaleDateString()}`);
    }
    
  } catch (error) {
    console.error("❌ Failed to list tokens:", error);
    process.exit(1);
  }
}

async function revokeToken(tokenName: string) {
  try {
    const success = await revokeApiToken(tokenName);
    
    if (success) {
      console.log(`✅ Token ${tokenName} has been revoked`);
    } else {
      console.log(`❌ Token ${tokenName} not found or already inactive`);
    }
    
  } catch (error) {
    console.error("❌ Failed to revoke token:", error);
    process.exit(1);
  }
}

async function main() {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case "generate":
      if (args.length < 2) {
        console.error("Usage: npm run token:generate <tokenName> <permissions> [expirationDays]");
        console.error("Example: npm run token:generate admin_orders \"orders:read,orders:write\" 365");
        process.exit(1);
      }
      await generateToken(args[0], args[1], args[2] ? parseInt(args[2]) : undefined);
      break;
      
    case "list":
      await listTokens();
      break;
      
    case "revoke":
      if (args.length < 1) {
        console.error("Usage: npm run token:revoke <tokenName>");
        process.exit(1);
      }
      await revokeToken(args[0]);
      break;
      
    default:
      console.log("🔑 API Token Management");
      console.log("======================");
      console.log("");
      console.log("Commands:");
      console.log("  generate <name> <permissions> [days]  Generate a new API token");
      console.log("  list                                   List all API tokens");
      console.log("  revoke <name>                          Revoke an API token");
      console.log("");
      console.log("Examples:");
      console.log('  npm run token:generate admin_orders "orders:read,orders:write,orders:update_status"');
      console.log('  npm run token:generate admin_vectorize "vectorize:read,vectorize:write"');
      console.log('  npm run token:generate webhook_carrier "webhooks:receive,orders:update_tracking" 365');
      console.log("  npm run token:list");
      console.log("  npm run token:revoke admin_orders");
      break;
  }
  
  process.exit(0);
}

main().catch(console.error);
