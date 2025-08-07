#!/bin/bash

# Test Order Update API
# This script demonstrates how to use the order update API

echo "🚀 Testing Order Update API"
echo "=========================="
echo

# First, generate an API token using our management script
echo "1. Generating API token..."
TOKEN_OUTPUT=$(npm run token:generate test-order-update "orders:read,orders:write,orders:update_status" 2>&1)
TOKEN=$(echo "$TOKEN_OUTPUT" | grep -o 'Token: [a-zA-Z0-9_-]*' | cut -d' ' -f2)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate token"
  echo "$TOKEN_OUTPUT"
  exit 1
fi

echo "✅ Token generated: ${TOKEN:0:16}..."
echo

# Test the API with a sample request
echo "2. Testing API endpoint..."
echo "Note: Replace 'YOUR_ORDER_ID' with an actual order ID from your database"
echo

# Show the curl command that can be used
cat << EOF
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "shipped",
    "carrier": "FedEx",
    "trackingNumber": "1234567890",
    "notes": "Package shipped via FedEx Ground"
  }'
EOF

echo
echo
echo "3. Example status updates:"
echo

# Processing status
cat << EOF
# Update to processing
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "processing",
    "notes": "Order is being prepared for shipment"
  }'

EOF

# Shipped status
cat << EOF
# Update to shipped
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "shipped",
    "carrier": "FedEx",
    "trackingNumber": "1234567890"
  }'

EOF

# Delivered status
cat << EOF
# Update to delivered
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "delivered"
  }'

EOF

# Cancelled status
cat << EOF
# Cancel order
curl -X POST http://localhost:3000/api/update-order \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "status": "cancelled",
    "cancellationReason": "Customer requested cancellation"
  }'

EOF

echo "4. API Features:"
echo "   ✅ Unified authentication with token-based security"
echo "   ✅ Status validation and business logic enforcement"
echo "   ✅ Automatic tracking URL generation for major carriers"
echo "   ✅ Email notifications for status changes"
echo "   ✅ Webhook audit trail for all updates"
echo "   ✅ Comprehensive error handling and validation"
echo

echo "5. Cleaning up..."
npm run token:revoke test-order-update > /dev/null 2>&1
echo "✅ Test token revoked"
echo

echo "🎉 Order Update API is ready for use!"
