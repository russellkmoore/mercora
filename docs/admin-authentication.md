# 🔐 Admin Authentication System

> **Comprehensive multi-layered authentication system securing admin routes and APIs with role-based access control**

Mercora implements a robust admin authentication system that protects all admin functionality through multiple security layers, ensuring only authorized users can access administrative features.

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[User Access] --> B{Signed In?}
    B -->|No| C[Show Sign-In]
    B -->|Yes| D{Environment}
    D -->|Development| E[Grant Admin Access]
    D -->|Production| F{Has Admin Role?}
    F -->|No| G[Access Denied]
    F -->|Yes| H[Grant Admin Access]
    
    H --> I[Admin Dashboard]
    E --> I
    
    I --> J[Admin API Calls]
    J --> K[Server Auth Check]
    K --> L{Valid Auth?}
    L -->|No| M[401 Unauthorized]
    L -->|Yes| N[Process Request]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#9f9,stroke:#333,stroke-width:2px
    style M fill:#f99,stroke:#333,stroke-width:2px
    style N fill:#9f9,stroke:#333,stroke-width:2px
```

## 🔒 Security Layers

### 1. **Client-Side Route Protection**
- **Component**: `AdminGuard` wrapper for all admin pages
- **Location**: `/app/admin/layout.tsx`
- **Function**: Prevents unauthorized users from seeing admin interface

### 2. **Server-Side API Protection**
- **Middleware**: `checkAdminPermissions()` function
- **Location**: `/lib/auth/admin-middleware.ts`
- **Function**: Validates all admin API requests

### 3. **Role-Based Access Control**
- **Development**: Any authenticated user gets admin access
- **Production**: Only users with the Clerk admin role or an active `adminUsers` table row

## 📋 Implementation Details

### AdminGuard Component

```tsx
// Wraps all admin pages with authentication protection
<AdminGuard>
  <AdminDashboard />
</AdminGuard>
```

**Features:**
- ✅ **Loading States**: Shows loading while checking authentication
- ✅ **Error Handling**: Graceful fallback for unauthorized access
- ✅ **Sign-In Integration**: Direct integration with Clerk authentication
- ✅ **Access Denied UI**: Clear messaging for authenticated non-admin users

### Admin Middleware

```typescript
// Server-side authentication for all admin APIs
const authResult = await checkAdminPermissions(request);
if (!authResult.success) {
  return NextResponse.json({ error: authResult.error }, { status: 401 });
}
```

**Authentication Methods:**
- ✅ **Clerk Integration**: Uses `auth()` for user session validation
- ✅ **Token Authentication**: Supports API tokens for server-to-server calls
- ✅ **Dev Bypass**: Special development bypass for testing
- ✅ **Role Checking**: Validates Clerk admin role or an active `adminUsers` table row

## 🛡️ Security Features

### Environment-Based Access Control

#### Development Environment
```typescript
if (process.env.NODE_ENV === "development") {
  // Any authenticated user becomes admin for easier development
  console.log(`✅ DEV MODE: User ${userId} granted admin access`);
  return { success: true, userId };
}
```

#### Production Environment
```typescript
// lib/auth/admin-middleware.ts:64-77 — the real production check
const isAdmin = await isUserAdmin(userId); // lib/models/admin.ts, adminUsers table

if (isAdmin) {
  return { success: true, userId };
}

// Fallback: Clerk metadata role, for backward compatibility
const userRole = (sessionClaims as any)?.metadata?.role;
if (userRole === "admin") {
  return { success: true, userId };
}
```

### API Token Authentication

For server-to-server admin API calls:

```bash
# Using environment token
curl -H "Authorization: Bearer $ADMIN_VECTORIZE_TOKEN" \
     https://app.com/api/admin/analytics
```

## 🔧 Configuration

### Environment Variables

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `development` or `production` |
| `ADMIN_VECTORIZE_TOKEN` | API token for server calls | Optional | `secret-token-123` |

The production admin list lives in the `adminUsers` D1 table, managed through `/admin/users`. It is not configured by an environment variable.

### Clerk Configuration

#### Development Setup
1. Any authenticated user automatically gets admin access
2. No additional configuration required

#### Production Setup
1. Add an active row to the `adminUsers` D1 table for the user (managed through `/admin/users`)
2. Alternatively, use Clerk's public metadata to set user roles:

```javascript
// In Clerk Dashboard, set user public metadata:
{
  "role": "admin"
}
```

## 🎯 User Experience

### Admin Access Flow

1. **Unauthenticated User**:
   - Sees sign-in prompt with clear call-to-action
   - Can sign in directly from the admin route

2. **Authenticated Non-Admin**:
   - Sees access denied message with helpful explanation
   - Provided option to return to main site

3. **Authenticated Admin**:
   - Immediate access to admin dashboard
   - Admin menu item appears in user dropdown
   - Seamless experience across all admin features

### Admin Menu Integration

```tsx
// Admin menu item in user dropdown (ClerkLogin component)
{!adminLoading && isAdmin && (
  <UserButton.Link
    label="Admin Dashboard"
    labelIcon={<Shield />}
    href="/admin"
  />
)}
```

## 🔍 Testing Authentication

### Manual Testing

1. **Unauthenticated Access**:
   ```bash
   curl https://app.com/admin
   # Should redirect to sign-in
   ```

2. **API Without Auth**:
   ```bash
   curl -X POST https://app.com/api/admin/analytics
   # Returns: {"error":"Authentication required. Please sign in."}
   ```

3. **Valid API Token**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://app.com/api/admin/analytics
   # Returns: Valid analytics data
   ```

### Development Testing

Use the development bypass header for testing:

```bash
curl -H "x-dev-admin: <DEV_ADMIN_BYPASS_TOKEN>" \
     "https://localhost:3000/api/admin/analytics"
```

This header is honored only when `NODE_ENV` is `development`; it is inert in every deployed build.

## 🚨 Security Considerations

### Best Practices Implemented

✅ **Defense in Depth**: Multiple security layers (client + server)
✅ **Least Privilege**: Production requires explicit admin role assignment
✅ **Secure Defaults**: Denies access by default, grants only when authorized
✅ **Environment Separation**: Different behavior for dev vs production
✅ **Token Security**: API tokens stored as secure environment variables
✅ **Error Handling**: Graceful degradation with helpful error messages

### Security Warnings

⚠️ **Development Mode**: Any authenticated user gets admin access for easier development
⚠️ **Production Setup**: Production admin access requires either an active `adminUsers` row or the Clerk metadata role; neither is granted by default
⚠️ **Token Management**: Keep API tokens secure and rotate regularly
⚠️ **Clerk Configuration**: Verify Clerk public metadata roles are properly set

## 📊 Access Control Matrix

| User Type | Development | Production | Admin APIs | Admin UI |
|-----------|------------|------------|------------|----------|
| **Unauthenticated** | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Authenticated User** | ✅ Granted | ❌ Denied | ❌ Denied | ❌ Denied |
| **Admin User** | ✅ Granted | ✅ Granted | ✅ Granted | ✅ Granted |
| **API Token** | ✅ Granted | ✅ Granted | ✅ Granted | N/A |

## 🔄 Migration from Previous System

The system was upgraded from a development-only authentication to a production-ready solution:

### Before (Development Only)

The superseded implementation short-circuited the permission check entirely and returned a synthetic admin identity for every request.

### After (Production Ready - Current Implementation)
```typescript
// Multi-layered authentication with proper role checking
const authResult = await checkAdminPermissions(request);
if (!authResult.success) {
  return NextResponse.json({ error: authResult.error }, { status: 401 });
}
```

**Current Status**: The system now runs with full production authentication enabled, providing comprehensive security for all admin functions.

## 🚀 Future Enhancements

### Planned Features
- **Permission Levels**: Granular permissions beyond admin/non-admin
- **Audit Logging**: Track admin actions for compliance
- **Session Management**: Advanced session controls and timeouts  
- **Two-Factor Authentication**: Additional security layer for admin access
- **Admin Invitation System**: Streamlined process for adding new admin users

### Integration Opportunities
- **RBAC System**: Role-based access control with fine-grained permissions
- **SSO Integration**: Corporate single sign-on for enterprise deployments
- **Admin Activity Dashboard**: Real-time monitoring of admin user actions

---

## 📝 Summary

The Mercora admin authentication system provides enterprise-grade security through:

- **🔐 Multi-layered Protection**: Client-side and server-side authentication
- **🎯 Environment-Aware**: Different behavior for development and production
- **🛡️ Role-Based Access**: Granular control over admin permissions
- **⚡ Developer-Friendly**: Easy development workflow with bypass options
- **🚀 Production-Ready**: Secure defaults with comprehensive error handling

The system ensures that only authorized users can access admin functionality while maintaining an excellent developer experience and user interface.

---

**Need help with admin authentication? Check the [development context](CLAUDE.md) for additional technical details.**