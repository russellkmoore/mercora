#!/usr/bin/env node

/**
 * Server-Side Token Management Script
 * 
 * This script provides secure token management functionality that runs
 * server-side only and can be used for initial setup or emergency token creation.
 * 
 * Usage:
 *   node scripts/admin-token-manager.js generate "token-name" "permission1,permission2"
 *   node scripts/admin-token-manager.js list
 *   node scripts/admin-token-manager.js revoke "token-name"
 */

const crypto = require('crypto');

// Mock database functions for this standalone script
// In production, this would integrate with your mercora-admin project
const tokens = new Map();

/**
 * Generate a secure random token
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate and store a new API token
 */
function generateToken(name, permissions) {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  
  const tokenInfo = {
    id: Date.now(),
    name,
    tokenHash,
    permissions: permissions.split(',').map(p => p.trim()),
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  };
  
  tokens.set(name, tokenInfo);
  
  console.log('\n🎉 Token generated successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 Name: ${name}`);
  console.log(`🔑 Token: ${token}`);
  console.log(`🛡️  Permissions: ${tokenInfo.permissions.join(', ')}`);
  console.log(`📅 Created: ${now}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  IMPORTANT: Save this token securely! It will not be shown again.');
  console.log('\n📋 Usage Examples:');
  console.log(`   curl -H "Authorization: Bearer ${token}" https://your-domain.com/api/update-order`);
  console.log(`   curl -H "X-API-Key: ${token}" https://your-domain.com/api/update-order`);
  console.log('\n');
  
  return { token, tokenInfo };
}

/**
 * List all tokens (without showing the actual token values)
 */
function listTokens() {
  console.log('\n📋 API Tokens');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (tokens.size === 0) {
    console.log('   No tokens found.');
  } else {
    tokens.forEach((tokenInfo, name) => {
      const status = tokenInfo.revokedAt ? '❌ REVOKED' : '✅ ACTIVE';
      console.log(`   ${status} ${name}`);
      console.log(`      Permissions: ${tokenInfo.permissions.join(', ')}`);
      console.log(`      Created: ${tokenInfo.createdAt}`);
      console.log(`      Last Used: ${tokenInfo.lastUsedAt || 'Never'}`);
      if (tokenInfo.revokedAt) {
        console.log(`      Revoked: ${tokenInfo.revokedAt}`);
      }
      console.log('');
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Revoke a token
 */
function revokeToken(name) {
  const tokenInfo = tokens.get(name);
  
  if (!tokenInfo) {
    console.log(`❌ Token '${name}' not found.`);
    return;
  }
  
  if (tokenInfo.revokedAt) {
    console.log(`⚠️  Token '${name}' is already revoked.`);
    return;
  }
  
  tokenInfo.revokedAt = new Date().toISOString();
  tokens.set(name, tokenInfo);
  
  console.log(`✅ Token '${name}' has been revoked.`);
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🔐 Mercora API Token Manager

Usage:
  node scripts/admin-token-manager.js <command> [options]

Commands:
  generate <name> <permissions>  Generate a new API token
  list                          List all tokens
  revoke <name>                 Revoke a token

Examples:
  # Generate order management token
  node scripts/admin-token-manager.js generate "order-mgmt" "orders:read,orders:write,orders:update_status"
  
  # Generate vectorize token  
  node scripts/admin-token-manager.js generate "vectorize" "vectorize:read,vectorize:write"
  
  # Generate admin token
  node scripts/admin-token-manager.js generate "admin" "admin:*"
  
  # List all tokens
  node scripts/admin-token-manager.js list
  
  # Revoke a token
  node scripts/admin-token-manager.js revoke "order-mgmt"

Available Permissions:
  orders:read           - View orders
  orders:write          - Create/modify orders  
  orders:update_status  - Update order status
  vectorize:read        - Read vectorize data
  vectorize:write       - Write vectorize data
  webhooks:receive      - Receive webhooks
  admin:*              - All admin permissions

Security Notes:
  ⚠️  This script is for development/emergency use only
  ⚠️  In production, use your mercora-admin project for token management
  ⚠️  Never commit generated tokens to version control
  ⚠️  Store tokens in secure environment variables
`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate':
      const name = args[1];
      const permissions = args[2];
      
      if (!name || !permissions) {
        console.log('❌ Usage: generate <name> <permissions>');
        console.log('   Example: generate "my-token" "orders:read,orders:write"');
        process.exit(1);
      }
      
      if (tokens.has(name)) {
        console.log(`❌ Token '${name}' already exists. Use revoke first if you want to replace it.`);
        process.exit(1);
      }
      
      generateToken(name, permissions);
      break;
      
    case 'list':
      listTokens();
      break;
      
    case 'revoke':
      const tokenName = args[1];
      
      if (!tokenName) {
        console.log('❌ Usage: revoke <name>');
        process.exit(1);
      }
      
      revokeToken(tokenName);
      break;
      
    default:
      showUsage();
      break;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  generateSecureToken,
  hashToken,
  generateToken,
  listTokens,
  revokeToken,
};
