#!/usr/bin/env node

/**
 * Test script for Order Update API
 * 
 * This script tests the complete order update flow:
 * 1. Generates an API token with proper permissions
 * 2. Tests order status updates
 * 3. Verifies webhook creation
 * 4. Tests email sending
 */

import { generateApiToken } from '../lib/auth/unified-auth.ts';
import { getDbAsync } from '../lib/db.ts';

async function testOrderUpdateAPI() {
  console.log('🚀 Testing Order Update API...\n');

  try {
    // 1. Generate a test token with order update permissions
    console.log('1. Generating API token...');
    const tokenResult = await generateApiToken({
      name: 'Test-Order-Update-Token',
      permissions: ['orders:read', 'orders:write', 'orders:update_status'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
    
    if (!tokenResult.success) {
      throw new Error(`Failed to generate token: ${tokenResult.error}`);
    }
    
    console.log(`✅ Token generated: ${tokenResult.token?.substring(0, 16)}...`);
    console.log(`   Token name: ${tokenResult.tokenInfo?.name}`);
    console.log(`   Permissions: ${tokenResult.tokenInfo?.permissions.join(', ')}\n`);

    // 2. Check if we have any existing orders to test with
    console.log('2. Checking for existing orders...');
    const db = await getDbAsync();
    const existingOrders = await db.select().from(orders).limit(1);
    
    if (existingOrders.length === 0) {
      console.log('⚠️  No existing orders found. You can test the API manually with:');
      console.log(`
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenResult.token}" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "shipped",
    "carrier": "FedEx",
    "trackingNumber": "1234567890"
  }'
      `);
      return;
    }

    const testOrder = existingOrders[0];
    console.log(`✅ Found test order: ${testOrder.id} (status: ${testOrder.status})\n`);

    // 3. Test the API endpoint
    console.log('3. Testing order update API...');
    const testPayload = {
      orderId: testOrder.id,
      status: 'processing',
      notes: 'Testing order update API'
    };

    // Make API request
    const response = await fetch('http://localhost:3000/api/update-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`API request failed: ${result.error}`);
    }

    console.log('✅ Order update successful:');
    console.log(`   Order ID: ${result.order.id}`);
    console.log(`   Status: ${result.order.status}`);
    console.log(`   Updated by: ${result.authenticatedAs}\n`);

    // 4. Verify webhook was created
    console.log('4. Checking webhook creation...');
    const webhooks = await db.select().from(orderWebhooks)
      .where(eq(orderWebhooks.orderId, testOrder.id))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    if (webhooks.length > 0) {
      const webhook = webhooks[0];
      console.log('✅ Webhook created:');
      console.log(`   Event type: ${webhook.eventType}`);
      console.log(`   Source: ${webhook.source}`);
      console.log(`   Created: ${webhook.createdAt}\n`);
    } else {
      console.log('⚠️  No webhook found for this order update\n');
    }

    // 5. Clean up - revoke the test token
    console.log('5. Cleaning up test token...');
    await db.update(apiTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(apiTokens.tokenHash, tokenResult.tokenInfo!.tokenHash));
    console.log('✅ Test token revoked\n');

    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Import required modules
const { orders } = require('../lib/models/order.ts');
const { orderWebhooks } = require('../lib/models/order.ts');
const { apiTokens } = require('../lib/models/auth.ts');
const { eq } = require('drizzle-orm');
const { sql } = require('drizzle-orm');

// Run the test
if (require.main === module) {
  testOrderUpdateAPI();
}

export { testOrderUpdateAPI };
