/**
 * === Order Refund API ===
 *
 * Handles Stripe refunds for order cancellations and returns.
 * Processes both full refunds (cancellations) and partial refunds (returns).
 *
 * === Features ===
 * - **Full Refunds**: Complete order cancellation with full amount refund
 * - **Partial Refunds**: Item-level returns with calculated partial amounts
 * - **Stripe Integration**: Direct Stripe refund processing
 * - **Order Updates**: Automatic order status and payment status updates
 * - **Audit Trail**: Comprehensive logging and reason tracking
 *
 * === Security ===
 * - Admin API key authentication required
 * - Payment intent validation
 * - Refund amount verification
 *
 * === Request Format ===
 * ```json
 * {
 *   "orderId": "WEB-USER-123456",
 *   "type": "full" | "partial",
 *   "reason": "requested_by_customer",
 *   "amount"?: number, // Required for partial refunds (in cents)
 *   "items"?: string[], // Required for partial refunds - product IDs
 *   "notes"?: string
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { eq } from 'drizzle-orm';
import { authenticateRequest, PERMISSIONS } from '@/lib/auth/unified-auth';

interface RefundRequest {
  orderId: string;
  type: 'full' | 'partial';
  reason: string;
  amount?: number; // For partial refunds (in cents)
  items?: string[]; // For partial refunds - product IDs
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with admin permissions
    const authResult = await authenticateRequest(request, PERMISSIONS.ORDERS_UPDATE);
    if (!authResult.success) {
      return authResult.response!;
    }

    const body = await request.json() as RefundRequest;
    const { orderId, type, reason, amount, items, notes } = body;

    // Validate required fields
    if (!orderId || !type || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: orderId, type, reason'
      }, { status: 400 });
    }

    if (type === 'partial' && (!amount || !items || items.length === 0)) {
      return NextResponse.json({
        error: 'Partial refunds require amount and items'
      }, { status: 400 });
    }

    const db = await getDbAsync();
    
    // Get the order
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      return NextResponse.json({
        error: 'Order not found'
      }, { status: 404 });
    }

    // Parse order data
    const extensions = order.extensions ? (typeof order.extensions === 'string' ? JSON.parse(order.extensions) : order.extensions) : {};
    const totalAmount = order.total_amount ? (typeof order.total_amount === 'string' ? JSON.parse(order.total_amount) : order.total_amount) : { amount: 0 };
    
    const paymentIntentId = extensions.payment_intent_id;
    if (!paymentIntentId) {
      return NextResponse.json({
        error: 'No payment intent found for this order'
      }, { status: 400 });
    }

    // Check if order is already cancelled or refunded
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({
        error: 'Order is already cancelled or refunded'
      }, { status: 400 });
    }

    // Process Stripe refund
    const stripe = getStripeClient();
    let refundAmount: number;
    let newStatus: string;
    let newPaymentStatus: string;

    if (type === 'full') {
      // Full refund
      refundAmount = totalAmount.amount;
      newStatus = 'cancelled';
      newPaymentStatus = 'refunded';
    } else {
      // Partial refund
      refundAmount = amount!;
      newStatus = order.status; // Keep same status for partial refunds
      newPaymentStatus = 'paid'; // Still considered paid since it's partial
      
      // Validate partial refund amount doesn't exceed total
      if (refundAmount > totalAmount.amount) {
        return NextResponse.json({
          error: 'Refund amount cannot exceed order total'
        }, { status: 400 });
      }
    }

    // Create Stripe refund
    let stripeRefund;
    try {
      // Check if we're using regular Stripe SDK or Cloudflare-compatible version
      if ('refunds' in stripe) {
        // Using regular Stripe SDK
        const regularStripe = stripe as any;
        stripeRefund = await regularStripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            orderId,
            refundType: type,
            refundReason: reason,
            ...(items && { refundedItems: items.join(',') })
          }
        });
      } else {
        // Using Cloudflare-compatible Stripe client
        const stripeCloudflare = stripe as any;
        stripeRefund = await stripeCloudflare.request('POST', '/refunds', {
          payment_intent: paymentIntentId,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            orderId,
            refundType: type,
            refundReason: reason,
            ...(items && { refundedItems: items.join(',') })
          }
        });
      }
    } catch (stripeError: any) {
      console.error('Stripe refund failed:', stripeError);
      return NextResponse.json({
        error: 'Failed to process refund with Stripe',
        details: stripeError.message
      }, { status: 500 });
    }

    // Update order in database
    const updateData: any = {
      status: newStatus,
      payment_status: newPaymentStatus,
      updated_at: new Date().toISOString()
    };

    // Add refund information to extensions
    const updatedExtensions = {
      ...extensions,
      refunds: [
        ...(extensions.refunds || []),
        {
          id: stripeRefund.id,
          amount: refundAmount,
          type,
          reason,
          items: items || [],
          notes: notes || '',
          processed_at: new Date().toISOString(),
          stripe_refund_id: stripeRefund.id
        }
      ]
    };
    updateData.extensions = JSON.stringify(updatedExtensions);

    // Add cancellation reason to notes for full cancellations
    if (type === 'full') {
      const currentNotes = order.notes || '';
      const cancellationNote = `CANCELLED: ${reason}${notes ? ` - ${notes}` : ''}`;
      updateData.notes = currentNotes ? `${currentNotes}\n\n${cancellationNote}` : cancellationNote;
    }

    // Update order
    const [updatedOrder] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    // Log the refund action
    console.log(`${type.toUpperCase()} refund processed:`, {
      orderId,
      stripeRefundId: stripeRefund.id,
      amount: refundAmount,
      reason,
      items,
      admin: authResult.tokenInfo?.tokenName || 'unknown'
    });

    return NextResponse.json({
      success: true,
      refund: {
        id: stripeRefund.id,
        amount: refundAmount,
        type,
        reason,
        items: items || [],
        processed_at: new Date().toISOString()
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status
      }
    });

  } catch (error) {
    console.error('Refund processing error:', error);
    return NextResponse.json({
      error: 'Failed to process refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}