# Secure API Token Management

## Overview

API tokens for the Mercora platform should be managed through the **mercora-admin** project for security. This document outlines the secure approaches for token management.

## Security Architecture

### ✅ **Secure (Production)**
- Token management through mercora-admin project
- Admin authentication required
- Audit logging of all token operations
- Secure storage with proper access controls

### ❌ **Insecure (Avoided)**
- Public-facing token generation endpoints
- Tokens exposed in client-side code
- Unsecured API endpoints for token operations

## Token Management Options

### 1. **Production: mercora-admin Project** (Recommended)

The token administration UI and APIs have been moved to your mercora-admin project for proper security:

```
mercora-admin-stash/
├── generate-token.html      # Token generator UI
└── admin/
    └── generate-token/
        └── route.ts         # Token generation API
```

**Integration Steps:**
1. Move files from `mercora-admin-stash` to your mercora-admin project
2. Add proper admin authentication
3. Implement audit logging
4. Add token management UI to admin dashboard

### 2. **Development: Server-Side Script**

For development and initial setup, use the server-side script:

```bash
# Generate tokens
node scripts/admin-token-manager.js generate "order-mgmt" "orders:read,orders:write,orders:update_status"

# List tokens  
node scripts/admin-token-manager.js list

# Revoke tokens
node scripts/admin-token-manager.js revoke "order-mgmt"
```

**Note:** This script is for development only and doesn't persist to your actual database.

### 3. **Emergency: Direct Database Access**

For production emergencies, tokens can be created directly via database:

```javascript
// In your Next.js API route or admin tool
import { generateApiToken, storeApiToken } from "@/lib/auth/unified-auth";

const token = await generateApiToken();
await storeApiToken(
  "emergency-token",
  token, 
  ["orders:read", "orders:write", "orders:update_status"]
);
```

## Required Token Permissions

### Order Management
```
orders:read           # View orders
orders:write          # Create/modify orders  
orders:update_status  # Update order status
```

### Vectorize Operations
```
vectorize:read        # Read vectorize data
vectorize:write       # Write vectorize data
```

### Webhook Operations
```
webhooks:receive      # Receive webhooks
```

### Admin Access
```
admin:*              # All permissions (use sparingly)
```

## Security Best Practices

### Token Storage
- **Environment Variables**: Store in secure environment variables
- **Secret Managers**: Use AWS Secrets Manager, Azure Key Vault, etc.
- **Never in Code**: Never commit tokens to version control

### Token Lifecycle
1. **Generation**: Only through authenticated admin interfaces
2. **Distribution**: Secure channels only (encrypted communication)
3. **Usage**: Monitor through webhook audit logs
4. **Rotation**: Regular token rotation schedule
5. **Revocation**: Immediate revocation capability

### Monitoring
- Track token usage through the webhook audit system
- Monitor for unusual API patterns
- Set up alerts for failed authentication attempts
- Regular security audits of active tokens

## API Integration

### Using Tokens
```bash
# Authorization header (preferred)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/update-order

# X-API-Key header
curl -H "X-API-Key: YOUR_TOKEN" \
  https://your-domain.com/api/update-order

# Query parameter (legacy support)
curl "https://your-domain.com/api/update-order?token=YOUR_TOKEN"
```

### Token Validation
All API endpoints use the unified authentication system:
```typescript
const authResult = await authenticateRequest(request, ["orders:write"]);
if (!authResult.success) {
  return authResult.response;
}
```

## Migration Path

### Immediate (Current State)
- Use server-side script for development tokens
- Order update API is secured and ready
- No public token endpoints exposed

### Short Term
- Integrate token management into mercora-admin
- Add proper admin authentication
- Implement audit logging

### Long Term
- Automated token rotation
- Integration with external secret management
- Advanced monitoring and alerting

## Files Structure

```
mercora/
├── lib/auth/unified-auth.ts        # Core auth system
├── lib/models/auth.ts              # Token database operations
├── scripts/admin-token-manager.js  # Development script
└── app/api/update-order/route.ts   # Secured API endpoint

mercora-admin-stash/               # Ready for admin integration
├── generate-token.html            # Token management UI
└── admin/generate-token/route.ts  # Token generation API
```

This approach ensures that:
- ✅ No security endpoints are publicly exposed
- ✅ Token management requires proper authentication
- ✅ Development workflow is still functional
- ✅ Production security is maintained
- ✅ Clear migration path to full admin integration
