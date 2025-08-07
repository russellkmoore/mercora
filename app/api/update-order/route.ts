/**
 * === Order Update API ===
 *
 * Secure endpoint for updating order status, shipping information, and handling cancellations.
 * Sends automated email notifications for status changes.
 *
 * === Authentication ===
 * Requires token with permissions: ["orders:read", "orders:write", "orders:update_status"]
 * 
 * Supported methods:
 * - Authorization: Bearer <token>
 * - X-API-Key: <token>
 *
 * === Usage ===
 * POST /api/update-order
 * 
 * Request Body:
 * {
 *   "orderId": "order_123",
 *   "status": "shipped",           // Required: processing | shipped | delivered | cancelled
 *   "carrier": "FedEx",           // Required for shipped status
 *   "trackingNumber": "123456",   // Optional
 *   "trackingUrl": "https://...", // Optional - auto-generated if not provided
 *   "cancellationReason": "...",  // Required for cancelled status
 *   "notes": "Additional info"    // Optional
 * }
 *
 * === Response ===
 * Success: { message: "Order updated successfully", order: {...}, authenticatedAs: "..." }
 * Error: { error: "Error message" }
 *
 * === Webhook Integration ===
 * Each update creates a webhook record for audit and carrier integration
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { authenticateRequest, PERMISSIONS } from "@/lib/auth/unified-auth";
import {
  getOrderById,
  updateOrderStatus,
  insertOrderWebhook,
  orders 
} from "@/lib/models/order";
import { sendOrderStatusUpdateEmail } from "@/lib/utils/email";

interface UpdateOrderRequest {
  orderId: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  cancellationReason?: string;
}

interface OrderStatusUpdateData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  cancellationReason?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

/**
 * Generate tracking URL based on carrier and tracking number
 */
function generateTrackingUrl(carrier: string, trackingNumber: string): string {
  const carrierLower = carrier.toLowerCase();
  
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
  } else if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  } else if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
  } else if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  } else {
    // Generic tracking URL for unknown carriers
    return `https://www.google.com/search?q=track+package+${encodeURIComponent(trackingNumber)}`;
  }
}

/**
 * Transform order data for email notification
 */
function transformOrderForEmail(order: any): OrderStatusUpdateData {
  const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items || [];
  const shippingAddr = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress || {};

  return {
    orderNumber: order.id, // Use id as orderNumber
    customerName: order.customerName || 'Valued Customer',
    customerEmail: order.customerEmail || order.email,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    notes: order.notes,
    cancellationReason: order.cancellationReason,
    items: orderItems.map((item: any) => ({
      productId: item.productId || item.id,
      name: item.name || item.title,
      price: item.price || 0,
      quantity: item.quantity || 1,
      imageUrl: item.imageUrl || item.image,
    })),
    shippingAddress: {
      street: shippingAddr.street || '',
      city: shippingAddr.city || '',
      state: shippingAddr.state || '',
      zipCode: shippingAddr.zipCode || shippingAddr.zip || '',
      country: shippingAddr.country || 'US',
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using unified auth with proper permissions
    const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
    
    if (!authResult.success) {
      return authResult.response!;
    }

    // Parse and validate request body
    const body = await request.json() as UpdateOrderRequest;

    // Validate required fields
    const { orderId, status, carrier, trackingNumber, trackingUrl, cancellationReason, notes } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses = ['incomplete', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Additional validation for specific statuses
    if (status === 'shipped' && !carrier) {
      return NextResponse.json(
        { error: 'Carrier is required when status is shipped' },
        { status: 400 }
      );
    }

    if (status === 'cancelled' && !cancellationReason) {
      return NextResponse.json(
        { error: 'Cancellation reason is required when status is cancelled' },
        { status: 400 }
      );
    }

    // Get the existing order
    const existingOrderResult = await getOrderById(orderId);
    if (!existingOrderResult || existingOrderResult.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const existingOrder = existingOrderResult[0];

    // Check if this is actually a status change
    if (existingOrder.status === status && !carrier && !trackingNumber && !notes) {
      return NextResponse.json(
        { message: 'No changes detected', order: existingOrder },
        { status: 200 }
      );
    }

    // Generate tracking URL if not provided but carrier and tracking number are available
    let finalTrackingUrl = trackingUrl;
    if (!finalTrackingUrl && carrier && trackingNumber) {
      finalTrackingUrl = generateTrackingUrl(carrier, trackingNumber);
    }

    // Update order in database using direct SQL for more control
    const db = await getDbAsync();
    const now = new Date().toISOString();
    
    // Build update fields based on status and provided data
    const updateFields: any = {
      status,
      updatedAt: now,
    };

    // Add tracking information for shipped orders
    if (status === 'shipped') {
      updateFields.carrier = carrier;
      updateFields.trackingNumber = trackingNumber;
      updateFields.trackingUrl = finalTrackingUrl;
      updateFields.shippedAt = now;
    }

    // Add delivery date for delivered orders
    if (status === 'delivered') {
      updateFields.deliveredAt = now;
    }

    // Add cancellation information
    if (status === 'cancelled') {
      updateFields.cancellationReason = cancellationReason;
    }

    // Add notes if provided
    if (notes) {
      updateFields.notes = notes;
    }

    // Update the order
    await db.update(orders).set(updateFields).where(eq(orders.id, orderId));

    // Get updated order
    const updatedOrderResult = await getOrderById(orderId);
    if (!updatedOrderResult || updatedOrderResult.length === 0) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated order' },
        { status: 500 }
      );
    }

    const updatedOrder = updatedOrderResult[0];

    // Send email notification for status changes that warrant it
    const emailStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (emailStatuses.includes(status) && existingOrder.status !== status) {
      try {
        const emailData = transformOrderForEmail(updatedOrder);
        await sendOrderStatusUpdateEmail(emailData);
        console.log(`Status update email sent for order ${orderId}: ${status}`);
      } catch (emailError) {
        console.error(`Failed to send status update email for order ${orderId}:`, emailError);
        // Don't fail the request if email fails
      }
    }

    // Create webhook record for audit trail and carrier integration
    await insertOrderWebhook({
      orderId,
      eventType: "status_update",
      payload: {
        previousStatus: existingOrder.status,
        newStatus: status,
        carrier,
        trackingNumber,
        trackingUrl: finalTrackingUrl,
        cancellationReason,
        notes,
        updatedBy: authResult.tokenInfo?.tokenName || 'unknown',
        timestamp: new Date().toISOString(),
      },
      source: "admin",
    });

    return NextResponse.json({
      message: "Order updated successfully",
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.id, // Use id as orderNumber
        status: updatedOrder.status,
        carrier: updatedOrder.carrier,
        trackingNumber: updatedOrder.trackingNumber,
        trackingUrl: updatedOrder.trackingUrl,
        shippedAt: updatedOrder.shippedAt,
        deliveredAt: updatedOrder.deliveredAt,
        cancellationReason: updatedOrder.cancellationReason,
        notes: updatedOrder.notes,
        updatedAt: updatedOrder.updatedAt,
      },
      authenticatedAs: authResult.tokenInfo?.tokenName,
    });

  } catch (error) {
    console.error("Order update error:", error);
    
    // Create exception webhook record if we can
    try {
      const bodyText = await request.text();
      const body = JSON.parse(bodyText) as UpdateOrderRequest;
      
      if (body.orderId) {
        await insertOrderWebhook({
          orderId: body.orderId,
          eventType: "exception",
          payload: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            request: body,
          },
          source: "admin",
        });
      }
    } catch (webhookError) {
      console.error("Failed to create exception webhook:", webhookError);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
