# Clean API Structure

## Overview

The API has been refactored to eliminate redundancy and follow RESTful principles with clear, top-level endpoints.

## 🔥 **Removed Redundant Endpoints**

### Before (Redundant)
- `/api/submit-order` - Only created orders
- `/api/update-order` - Only updated orders  
- `/api/user-orders` - Only listed user orders
- `/api/stripe/create-payment-intent` - Created payments + calculated tax

### After (Unified)
- `/api/orders` - **UNIFIED**: GET (list), POST (create), PUT (update)
- `/api/payment-intent` - **FOCUSED**: Only creates payment intents
- `/api/tax` - **SINGLE SOURCE**: Tax calculation for all scenarios

## 📋 **Current Clean API Structure**

### **Core Resources**
```
├── /api/orders              # UNIFIED order management
│   ├── GET    - List orders (with filtering)
│   ├── POST   - Create new orders  
│   └── PUT    - Update order status
├── /api/orders/[id]         # Specific order operations
│   ├── GET    - Get order details
│   └── PUT    - Update specific order
```

### **Payment & Tax**
```
├── /api/payment-intent      # Stripe payment creation
│   └── POST   - Create payment intent (requires pre-calculated tax)
├── /api/tax                 # Tax calculation (Stripe Tax)
│   └── POST   - Calculate tax based on address + items
├── /api/webhooks/stripe     # Payment status updates
│   └── POST   - Handle Stripe webhook events
```

### **Products & Categories** 
```
├── /api/products            # Product catalog
│   ├── GET    - List products (with filters)
│   └── POST   - Add products (admin)
├── /api/products/[id]       # Specific product
│   ├── GET    - Get product details
│   └── PUT    - Update product (admin)
├── /api/categories          # Product categories
│   ├── GET    - List categories
│   └── POST   - Add categories (admin)
├── /api/categories/[id]     # Specific category
│   ├── GET    - Get category details
│   └── PUT    - Update category (admin)
```

### **Commerce Support**
```
├── /api/shipping-options    # Shipping calculation
│   └── POST   - Get shipping options for address
├── /api/validate-discount   # Discount validation
│   └── POST   - Validate discount codes
```

### **AI & Content**
```
├── /api/agent-chat          # AI assistant
│   └── POST   - Chat with Volt AI assistant
├── /api/vectorize-products  # Content indexing
│   └── POST   - Index products for AI search
├── /api/vectorize-knowledge # Knowledge indexing
│   └── POST   - Index support articles for AI
```

## 🎯 **Key Improvements**

### **1. Clear Separation of Concerns**
- **Tax Calculation**: Only `/api/tax` calculates tax
- **Payment Processing**: Only `/api/payment-intent` creates payments
- **Order Management**: Only `/api/orders` handles orders

### **2. RESTful Design**
- **Resource-based URLs**: `/api/orders` not `/api/submit-order`
- **HTTP verbs**: GET, POST, PUT map to list, create, update
- **Consistent patterns**: All resources follow same structure

### **3. Workflow Clarity**
```
1. Calculate Tax    → POST /api/tax
2. Create Payment   → POST /api/payment-intent (with tax amount)
3. Process Payment  → Stripe handles (webhook updates via /api/webhooks/stripe)
4. Create Order     → POST /api/orders (with payment intent ID)
```

## 📊 **Endpoint Usage Patterns**

### **Checkout Flow**
```javascript
// 1. Calculate tax
const taxResponse = await fetch('/api/tax', {
  method: 'POST',
  body: JSON.stringify({ items, shippingAddress, shippingCost })
});

// 2. Create payment intent
const paymentResponse = await fetch('/api/payment-intent', {
  method: 'POST', 
  body: JSON.stringify({ 
    amount: total, 
    taxAmount: tax, 
    shippingAddress, 
    orderId 
  })
});

// 3. Process payment (Stripe handles)
// 4. Create order after payment success
const orderResponse = await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({ items, shipping_address, tax_amount, payment_intent_id })
});
```

### **Admin Operations**
```javascript
// List all orders
const orders = await fetch('/api/orders?admin=true&limit=50');

// Update order status  
const update = await fetch('/api/orders', {
  method: 'PUT',
  body: JSON.stringify({ orderId: 'WEB-123', status: 'shipped' })
});
```

### **Customer Operations**
```javascript
// Get my orders
const myOrders = await fetch('/api/orders?userId=user_123');

// Get specific order
const order = await fetch('/api/orders/WEB-USER-123456');
```

## 🔒 **Authentication Patterns**

### **User Endpoints** (Clerk Auth)
- `/api/orders` (user's own orders)
- `/api/payment-intent` 
- `/api/tax`

### **Admin Endpoints** (API Key Auth)
- `/api/orders?admin=true`
- `/api/orders` (PUT with admin permissions)
- `/api/products` (POST/PUT)

### **Webhook Endpoints** (Signature Auth)
- `/api/webhooks/stripe` (Stripe signature verification)

## 📈 **Performance Benefits**

1. **Reduced Complexity**: Fewer endpoints to maintain
2. **Better Caching**: Clear resource boundaries enable better caching
3. **Clearer Dependencies**: Tax → Payment → Order workflow is explicit
4. **Easier Testing**: Each endpoint has single responsibility

## 🚀 **Migration Impact**

### **Frontend Changes**
- Updated checkout components to use new endpoint structure
- Simplified payment flow with clear separation of concerns
- Better error handling with focused endpoints

### **Webhook Changes**  
- Moved from `/api/stripe/webhooks` to `/api/webhooks/stripe`
- Webhook now calls unified `/api/orders` for status updates

### **Documentation Updates**
- All API docs updated to reflect new structure
- Examples updated with new endpoint paths
- Stripe integration guide updated