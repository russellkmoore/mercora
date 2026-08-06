/**
 * === Stripe Webhooks Handler ===
 *
 * Handles Stripe webhook events for payment processing, tax calculation,
 * and order management. Ensures secure webhook verification and proper
 * event handling for all Stripe-related operations.
 *
 * === Supported Events ===
 * - **payment_intent.succeeded**: Payment completed successfully
 * - **payment_intent.payment_failed**: Payment failed
 * - **invoice.payment_succeeded**: Subscription/recurring payment succeeded
 * - **customer.subscription.updated**: Subscription changes
 * - **checkout.session.completed**: Checkout session completed
 * - **charge.refunded**: Authoritative cumulative refund reconciliation
 * - **refund.updated/refund.failed**: Delayed refund lifecycle reconciliation
 * - **charge.refund.updated**: Legacy delayed-refund compatibility event
 *
 * === Security ===
 * - Webhook signature verification with Stripe secret
 * - Raw body validation for signature checking
 * - Idempotency handling for duplicate events
 *
 * === Error Handling ===
 * - Graceful handling of unknown events
 * - Comprehensive error logging
 * - Proper HTTP status codes
 *
 * === Usage ===
 * Configure this endpoint in your Stripe Dashboard webhook settings:
 * - URL: https://yourdomain.com/api/webhooks/stripe
 * - Events: Select the events you want to handle
 */

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import Stripe from 'stripe';
import {
  finalizeOrderPayment,
  PaymentVerificationError,
} from '@/lib/services/order-finalization';
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  type WebhookEventOutcome,
} from '@/lib/webhooks/processed-events';
import {
  handleChargeRefunded,
  handleRefundLifecycle,
} from '@/app/api/webhooks/stripe/handlers/refund-handlers';

function retryableResponse(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 503, headers: { 'Retry-After': '5' } }
  );
}

/**
 * POST handler for Stripe webhook events
 * Verifies webhook signature and processes supported events
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature for security
    event = await constructWebhookEvent(
      body,
      signature
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  let claim;
  try {
    claim = await claimWebhookEvent({
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
    console.error(`Could not claim Stripe webhook ${event.id}:`, error);
    return NextResponse.json(
      { error: 'Webhook claim failed' },
      { status: 500 }
    );
  }

  if (claim.state === 'completed') {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim.state === 'busy') {
    return retryableResponse('Webhook is already being processed');
  }

  try {
    let outcome: WebhookEventOutcome;

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        outcome = await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        outcome = 'ignored';
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        outcome = 'ignored';
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        outcome = 'ignored';
        break;

      case 'charge.refunded':
        outcome = await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated':
        outcome = await handleRefundLifecycle(event.data.object as Stripe.Refund);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        outcome = 'ignored';
    }

    const completed = await completeWebhookEvent({
      eventId: event.id,
      claimToken: claim.claimToken,
      outcome,
    });
    if (!completed) {
      console.error(`Lost ownership before completing Stripe webhook ${event.id}`);
      return retryableResponse('Webhook ownership expired before completion');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    try {
      const failed = await failWebhookEvent({
        eventId: event.id,
        claimToken: claim.claimToken,
        error,
      });
      if (!failed) {
        console.error(`Lost ownership before failing Stripe webhook ${event.id}`);
      }
    } catch (claimError) {
      console.error(`Could not record failure for Stripe webhook ${event.id}:`, claimError);
    }
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful payment intent
 * Updates order status and triggers post-payment actions
 */
async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookEventOutcome> {
  console.log('Payment succeeded:', paymentIntent.id);
  
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    console.error('No orderId in payment intent metadata');
    return 'permanent_rejection';
  }

  try {
    await finalizeOrderPayment({
      orderId,
      paymentIntentId: paymentIntent.id,
      enforceOwnership: false,
      sendEmail: true,
    });
    return 'handled';
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      console.error(`Payment verification rejected for order ${orderId}:`, error.message);
      return 'permanent_rejection';
    }
    // Transient D1/Stripe failures must reach POST's 500 response so Stripe
    // retries the signed event instead of recording a false success.
    throw error;
  }
}

/**
 * Handle failed payment intent
 * Updates order status and handles payment failure scenarios
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    console.error('No orderId in payment intent metadata');
    return;
  }

  try {
    // Update order status to failed
    // TODO: Implement order status update
    console.log(`Updating order ${orderId} to failed status`);
    
    // You can add additional logic here:
    // - Send failure notification emails
    // - Restore inventory if needed
    // - Log payment failure reasons
    
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

/**
 * Handle completed checkout session
 * Processes successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);
  
  const orderId = session.metadata?.orderId;
  
  if (!orderId) {
    console.error('No orderId in checkout session metadata');
    return;
  }

  try {
    // Handle checkout completion
    console.log(`Processing completed checkout for order ${orderId}`);
    
    // You can add additional logic here:
    // - Final order confirmation
    // - Customer onboarding
    // - Thank you emails
    
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

/**
 * Handle successful invoice payment
 * For subscription or recurring payment scenarios
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  
  try {
    // Handle subscription payment
    console.log(`Processing invoice payment for customer ${invoice.customer}`);
    
    // You can add additional logic here:
    // - Update subscription status
    // - Send invoice receipts
    // - Handle plan upgrades/downgrades
    
  } catch (error) {
    console.error('Error handling invoice payment:', error);
  }
}
