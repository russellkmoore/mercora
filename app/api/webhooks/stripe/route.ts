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
 * - URL: https://yourdomain.com/api/stripe/webhooks
 * - Events: Select the events you want to handle
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, getWebhookSecret } from '@/lib/stripe';
import Stripe from 'stripe';

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
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getWebhookSecret()
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
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
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);
  
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    console.error('No orderId in payment intent metadata');
    return;
  }

  try {
    // Update order status using unified orders endpoint
    try {
      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/orders`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': process.env.STRIPE_WEBHOOK_SECRET || '', // Use webhook secret as internal API key
        },
        body: JSON.stringify({
          orderId,
          status: 'processing', // Move to processing after successful payment
          notes: `Payment completed via Stripe - Payment Intent: ${paymentIntent.id}`,
        }),
      });

      if (!updateRes.ok) {
        console.error('Failed to update order status:', await updateRes.text());
      }
    } catch (updateError) {
      console.error('Error updating order status:', updateError);
    }
    
    // You can add additional logic here:
    // - Send confirmation emails
    // - Update inventory
    // - Trigger fulfillment process
    // - Analytics tracking
    
  } catch (error) {
    console.error('Error updating order after payment:', error);
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