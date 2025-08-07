# Order Update API Documentation

## Overview

The Order Update API provides a secure endpoint for updating order status, shipping information, and handling cancellations. It includes automated email notifications, webhook audit trails, and comprehensive validation.

## Features

- ✅ **Unified Authentication**: Token-based security with granular permissions
- ✅ **Status Validation**: Business logic enforcement for order state transitions
- ✅ **Auto Tracking URLs**: Automatic generation of tracking links for major carriers
- ✅ **Email Notifications**: Automated customer notifications for status changes
- ✅ **Webhook Audit Trail**: Complete logging of all order updates
- ✅ **Comprehensive Validation**: Input validation and error handling

## Authentication

The API uses the unified authentication system with the following required permissions:
- `orders:read` - Read order information
- `orders:write` - Write order updates  
- `orders:update_status` - Specific permission for status updates

### Supported Auth Methods
1. **Authorization Header**: `Authorization: Bearer <token>`
2. **X-API-Key Header**: `X-API-Key: <token>`
3. **Query Parameter**: `?token=<token>` (legacy support)

## API Endpoint

```
POST /api/update-order
```

## Request Format

```json
{
  "orderId": "ORD-12345678",
  "status": "shipped",
  "carrier": "FedEx",
  "trackingNumber": "1234567890123",
  "trackingUrl": "https://...",
  "notes": "Additional information",
  "cancellationReason": "Customer request"
}
```

### Required Fields
- `orderId`: The order ID to update
- `status`: New order status (see valid statuses below)

### Optional Fields
- `carrier`: Shipping carrier (required for "shipped" status)
- `trackingNumber`: Package tracking number
- `trackingUrl`: Custom tracking URL (auto-generated if not provided)
- `notes`: Additional notes for the order
- `cancellationReason`: Reason for cancellation (required for "cancelled" status)

## Valid Order Statuses

1. **incomplete** - Order not yet complete
2. **pending** - Order pending payment
3. **paid** - Order paid but not yet processed
4. **processing** - Order being prepared for shipment
5. **shipped** - Order has been shipped
6. **delivered** - Order has been delivered
7. **cancelled** - Order has been cancelled

## Status-Specific Requirements

### Shipped Status
- `carrier` field is required
- `trackingNumber` is optional but recommended
- `trackingUrl` will be auto-generated if not provided
- Sets `shippedAt` timestamp automatically

### Delivered Status
- Sets `deliveredAt` timestamp automatically

### Cancelled Status
- `cancellationReason` field is required

## Response Format

### Success Response
```json
{
  "message": "Order updated successfully",
  "order": {
    "id": "ORD-12345678",
    "orderNumber": "ORD-12345678",
    "status": "shipped",
    "carrier": "FedEx",
    "trackingNumber": "1234567890123",
    "trackingUrl": "https://www.fedex.com/fedextrack/?tracknumbers=1234567890123",
    "shippedAt": "2024-01-15T10:30:00Z",
    "deliveredAt": null,
    "cancellationReason": null,
    "notes": "Package shipped via FedEx Ground",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "authenticatedAs": "admin-token"
}
```

### Error Response
```json
{
  "error": "Error message description"
}
```

## Automatic Features

### Tracking URL Generation
The API automatically generates tracking URLs for major carriers:
- **FedEx**: `https://www.fedex.com/fedextrack/?tracknumbers={trackingNumber}`
- **UPS**: `https://www.ups.com/track?tracknum={trackingNumber}`
- **USPS**: `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1={trackingNumber}`
- **DHL**: `https://www.dhl.com/en/express/tracking.html?AWB={trackingNumber}`

### Email Notifications
Status change emails are automatically sent for:
- **processing**: "Your order is being processed"
- **shipped**: "Your order has shipped!" (includes tracking info)
- **delivered**: "Your order has been delivered!"
- **cancelled**: "Your order has been cancelled"

### Webhook Audit Trail
Every update creates a webhook record with:
- Previous and new status
- All update fields (carrier, tracking, etc.)
- Timestamp and authenticated user
- Complete audit trail for compliance

## Usage Examples

### Update to Processing
```bash
curl -X POST http://localhost:3000/api/update-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-12345678",
    "status": "processing",
    "notes": "Order is being prepared for shipment"
  }'
```

### Mark as Shipped
```bash
curl -X POST http://localhost:3000/api/update-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-12345678",
    "status": "shipped",
    "carrier": "FedEx",
    "trackingNumber": "1234567890123"
  }'
```

### Mark as Delivered
```bash
curl -X POST http://localhost:3000/api/update-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-12345678",
    "status": "delivered"
  }'
```

### Cancel Order
```bash
curl -X POST http://localhost:3000/api/update-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-12345678",
    "status": "cancelled",
    "cancellationReason": "Customer requested cancellation"
  }'
```

## Error Codes

- **400 Bad Request**: Invalid request format or missing required fields
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: Token lacks required permissions
- **404 Not Found**: Order not found
- **500 Internal Server Error**: Server error during processing

## Token Management

### Generate Token
```bash
npm run token:generate order-update-token "orders:read,orders:write,orders:update_status"
```

### List Tokens
```bash
npm run token:list
```

### Revoke Token
```bash
npm run token:revoke order-update-token
```

## Testing

Use the provided test script to verify the API:
```bash
./scripts/test-order-update.sh
```

This will generate a test token, show example API calls, and clean up afterward.

## Integration Notes

### Webhook Receivers
For carrier integration, you can create webhook receivers that automatically update orders when carriers send delivery notifications. The webhook audit system tracks all updates from multiple sources.

### Admin Panel Integration
The API is designed to be used by admin panels, fulfillment systems, and automated processes. The unified authentication system provides secure access with proper permission controls.

### Rate Limiting
Consider implementing rate limiting for production use to prevent abuse of the API endpoint.

## Security Best Practices

1. **Token Security**: Store tokens securely and rotate them regularly
2. **Permission Scope**: Use minimal required permissions for each token
3. **HTTPS Only**: Always use HTTPS in production
4. **Token Expiration**: Set appropriate expiration times for tokens
5. **Audit Logging**: Monitor the webhook audit trail for unusual activity
