# Unified Authentication System

The unified authentication system provides secure, token-based authentication for all admin APIs with granular permissions.

## Features

- **Multiple Authentication Methods**: Bearer tokens, API keys, query parameters
- **Granular Permissions**: Fine-grained control over API access
- **Token Management**: Easy generation, listing, and revocation
- **Webhook Support**: Secure endpoints for carrier webhooks
- **Database-Driven**: All tokens stored securely with SHA-256 hashing

## Quick Start

### 1. Generate API Tokens

```bash
# Generate token for order management
npm run token:generate admin_orders "orders:read,orders:write,orders:update_status"

# Generate token for vectorize operations  
npm run token:generate admin_vectorize "vectorize:read,vectorize:write"

# Generate token for carrier webhooks
npm run token:generate webhook_carrier "webhooks:receive,orders:update_tracking"
```

### 2. Use Tokens in API Calls

```bash
# Using Authorization header (recommended)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://voltique.russellkmoore.me/api/vectorize-knowledge

# Using X-API-Key header
curl -H "X-API-Key: YOUR_TOKEN" \
     https://voltique.russellkmoore.me/api/update-order

# Using query parameter (deprecated)
curl "https://voltique.russellkmoore.me/api/vectorize-knowledge?token=YOUR_TOKEN"
```

### 3. Manage Tokens

```bash
# List all tokens
npm run token:list

# Revoke a token
npm run token:revoke admin_orders
```

## Permission System

### Available Permissions

- **vectorize:read** - Read vectorize indexes
- **vectorize:write** - Write to vectorize indexes  
- **orders:read** - Read order data
- **orders:write** - Create and modify orders
- **orders:update_status** - Update order status
- **webhooks:receive** - Receive webhook events
- **orders:update_tracking** - Update tracking information
- **admin:*** - Full admin access (wildcard)

### Permission Scopes

You can use wildcards for broader permissions:

```bash
# Grant all order permissions
npm run token:generate admin_full "orders:*"

# Grant all permissions
npm run token:generate super_admin "admin:*"
```

## API Integration

### In Your API Routes

```typescript
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";

export async function POST(request: NextRequest) {
  // Authenticate with specific permissions
  const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
  
  if (!authResult.success) {
    return authResult.response; // Returns 401/403 error
  }
  
  // Your authenticated logic here
  console.log(`Authenticated as: ${authResult.tokenInfo?.tokenName}`);
}
```

### Using the Wrapper

```typescript
import { withAuth, PERMISSIONS } from "@/lib/auth/unified-auth";

export const POST = withAuth(async (request, authInfo) => {
  // Your authenticated logic here
  console.log(`Authenticated as: ${authInfo.tokenName}`);
  
  return NextResponse.json({ success: true });
}, PERMISSIONS.ORDERS_WRITE);
```

## Migration from Old System

### Before (vectorize APIs)
```typescript
const ADMIN_VECTORIZE_TOKEN = process.env.ADMIN_VECTORIZE_TOKEN;
const url = new URL(request.url);
const token = url.searchParams.get("token");

if (token !== ADMIN_VECTORIZE_TOKEN) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### After (unified system)
```typescript
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";

const authResult = await authenticateRequest(request, PERMISSIONS.VECTORIZE_WRITE);
if (!authResult.success) {
  return authResult.response;
}
```

## Security Benefits

1. **No Plaintext Storage**: Tokens are SHA-256 hashed in database
2. **Granular Permissions**: Each token has specific capabilities
3. **Usage Tracking**: Monitor when tokens are used
4. **Easy Revocation**: Instantly disable compromised tokens
5. **Expiration Support**: Set automatic token expiration
6. **Multiple Auth Methods**: Flexible authentication options

## Webhook Integration

The system is designed for carrier webhook integration:

```typescript
// Webhook endpoint with carrier permissions
export const POST = withAuth(async (request, authInfo) => {
  const webhookData = await request.json();
  
  // Process carrier tracking update
  await processTrackingUpdate(webhookData);
  
  return NextResponse.json({ received: true });
}, PERMISSIONS.WEBHOOKS_CARRIER);
```

## Database Schema

The authentication system uses these tables:

- **api_tokens**: Stores hashed tokens with permissions
- **order_webhooks**: Tracks webhook events and processing
- **orders**: Enhanced with tracking fields

See the migration SQL for full schema details.
