#!/usr/bin/env node

/**
 * Cloudflare D1 Token Management Script
 * 
 * This script generates API tokens and stores them directly in your Cloudflare D1 database.
 * It bypasses the Next.js runtime requirements by using direct D1 API calls.
 * 
 * Prerequisites:
 * 1. Install wrangler: npm install -g wrangler
 * 2. Be authenticated with Cloudflare: wrangler auth login
 * 3. Have your database ID configured in wrangler.toml
 * 
 * Usage:
 *   node scripts/d1-token-manager.js generate "token-name" "permission1,permission2"
 *   node scripts/d1-token-manager.js list
 *   node scripts/d1-token-manager.js revoke "token-name"
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Get database name from wrangler config
 */
function getDatabaseName() {
  try {
    // Try wrangler.jsonc first, then wrangler.toml
    let wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
    if (!fs.existsSync(wranglerPath)) {
      wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    }
    
    if (!fs.existsSync(wranglerPath)) {
      throw new Error('Neither wrangler.jsonc nor wrangler.toml found');
    }
    
    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    if (wranglerPath.endsWith('.jsonc') || wranglerPath.endsWith('.json')) {
      // Parse JSON config (strip comments and fix trailing commas)
      let cleanJson = wranglerContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '')         // Remove line comments
        .replace(/,(\s*[}\]])/g, '$1');   // Remove trailing commas
      
      const config = JSON.parse(cleanJson);
      
      if (config.d1_databases && config.d1_databases[0] && config.d1_databases[0].database_name) {
        return config.d1_databases[0].database_name;
      }
    } else {
      // Parse TOML config
      const dbMatch = wranglerContent.match(/\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/);
      if (dbMatch) {
        return dbMatch[1];
      }
    }
    
    throw new Error('Could not find database_name in wrangler configuration');
  } catch (error) {
    console.error('❌ Error reading wrangler configuration:', error.message);
    console.log('Make sure you have a wrangler.jsonc or wrangler.toml file with D1 database configuration.');
    process.exit(1);
  }
}

/**
 * Execute a SQL query on Cloudflare D1
 */
function executeD1Query(sql) {
  const dbName = getDatabaseName();
  
  try {
    // Use remote database by default for production tokens
    const command = `npx wrangler d1 execute ${dbName} --command "${sql}" --remote`;
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    
    return result;
  } catch (error) {
    console.error('❌ D1 Query Error:', error.message);
    throw error;
  }
}

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
 * Generate and store a new API token in D1
 */
function generateToken(name, permissions) {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const permissionsArray = permissions.split(',').map(p => p.trim());
  const permissionsJson = JSON.stringify(permissionsArray).replace(/"/g, '\\"');
  
  try {
    // Insert token into D1 database with proper escaping - use active field instead of revoked_at
    const sql = `INSERT INTO api_tokens (token_name, token_hash, permissions, active, created_at, updated_at) VALUES ('${name}', '${tokenHash}', '${permissionsJson}', 1, '${now}', '${now}');`;
    
    executeD1Query(sql);
    
    console.log('\n🎉 Token generated and stored in Cloudflare D1!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Name: ${name}`);
    console.log(`🔑 Token: ${token}`);
    console.log(`🛡️  Permissions: ${permissions}`);
    console.log(`📅 Created: ${now}`);
    console.log(`💾 Database: ${getDatabaseName()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Save this token securely! It will not be shown again.');
    console.log('\n📋 Usage Examples:');
    console.log(`   curl -H "Authorization: Bearer ${token}" https://your-domain.com/api/update-order`);
    console.log(`   curl -H "X-API-Key: ${token}" https://your-domain.com/api/update-order`);
    console.log('\n💡 Tip: Set this as an environment variable:');
    console.log(`   export MERCORA_API_TOKEN="${token}"`);
    console.log('\n');
    
    return { token, tokenHash, name, permissions };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log(`❌ Token '${name}' already exists. Use revoke first if you want to replace it.`);
    } else {
      console.error('❌ Failed to create token:', error.message);
    }
    process.exit(1);
  }
}

/**
 * List all tokens from D1 database
 */
function listTokens() {
  try {
    const sql = `SELECT token_name, permissions, created_at, last_used_at FROM api_tokens WHERE active = 1 ORDER BY created_at DESC;`;
    
    const result = executeD1Query(sql);
    
    console.log('\n📋 API Tokens in Cloudflare D1');
    console.log(`💾 Database: ${getDatabaseName()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Show the full wrangler output
    console.log(result);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Failed to list tokens:', error.message);
    process.exit(1);
  }
}

/**
 * Revoke a token in D1 database
 */
function revokeToken(name) {
  try {
    const now = new Date().toISOString();
    const sql = `UPDATE api_tokens SET active = 0, updated_at = '${now}' WHERE token_name = '${name}' AND active = 1;`;
    
    executeD1Query(sql);
    
    console.log(`✅ Token '${name}' has been revoked in Cloudflare D1.`);
    
  } catch (error) {
    console.error(`❌ Failed to revoke token '${name}':`, error.message);
    process.exit(1);
  }
}

/**
 * Check if wrangler is available and authenticated
 */
function checkPrerequisites() {
  try {
    // Check if wrangler is available via npx
    execSync('npx wrangler --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Wrangler is not available. Please make sure your project has wrangler installed.');
    console.error('   Try: npm install wrangler --save-dev');
    process.exit(1);
  }
  
  try {
    // Check if authenticated
    execSync('npx wrangler whoami', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Not authenticated with Cloudflare. Please run: npx wrangler auth login');
    process.exit(1);
  }
  
  // Check if wrangler config exists
  if (!fs.existsSync('wrangler.jsonc') && !fs.existsSync('wrangler.toml')) {
    console.error('❌ wrangler.jsonc or wrangler.toml not found. Make sure you\'re in the project root directory.');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
🔐 Mercora Cloudflare D1 Token Manager

Usage:
  node scripts/d1-token-manager.js <command> [options]

Commands:
  generate <name> <permissions>  Generate a new API token and store in D1
  list                          List all tokens from D1 database
  revoke <name>                 Revoke a token in D1 database

Examples:
  # Generate order management token
  node scripts/d1-token-manager.js generate "order-mgmt" "orders:read,orders:write,orders:update_status"
  
  # Generate vectorize token  
  node scripts/d1-token-manager.js generate "vectorize" "vectorize:read,vectorize:write"
  
  # Generate admin token
  node scripts/d1-token-manager.js generate "admin" "admin:*"
  
  # List all tokens
  node scripts/d1-token-manager.js list
  
  # Revoke a token
  node scripts/d1-token-manager.js revoke "order-mgmt"

Available Permissions:
  orders:read           - View orders
  orders:write          - Create/modify orders  
  orders:update_status  - Update order status
  vectorize:read        - Read vectorize data
  vectorize:write       - Write vectorize data
  webhooks:receive      - Receive webhooks
  admin:*              - All admin permissions

Prerequisites:
  ✅ wrangler CLI installed: npm install -g wrangler
  ✅ Authenticated with Cloudflare: wrangler auth login
  ✅ wrangler.toml configured with D1 database
  ✅ Database schema deployed (api_tokens table exists)

Database Connection:
  This script connects directly to your Cloudflare D1 database using the wrangler CLI.
  Tokens are securely hashed and stored in the api_tokens table.
`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Check prerequisites before running any commands
  if (command && command !== 'help') {
    checkPrerequisites();
  }

  switch (command) {
    case 'generate':
      const name = args[1];
      const permissions = args[2];
      
      if (!name || !permissions) {
        console.log('❌ Usage: generate <name> <permissions>');
        console.log('   Example: generate "my-token" "orders:read,orders:write"');
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
      
    case 'help':
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
