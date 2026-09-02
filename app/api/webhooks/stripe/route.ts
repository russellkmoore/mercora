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
import { mapDeclineReason } from '@/app/api/webhooks/stripe/handlers/decline-reason';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { handleSubscriptionStripeEvent } from '@/app/api/webhooks/stripe/handlers/subscription-handlers';
import { resolveRuntimeCommerceCapabilities } from '@/lib/commerce/runtime';

const MAX_STRIPE_SIGNATURE_BYTES = 4_096;
const MAX_STRIPE_WEBHOOK_BODY_BYTES = 1_048_576;

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try {
    await body?.cancel();
  } catch {
    // Preserve the bounded public rejection if the upstream stream cannot cancel.
  }
}

function validSignatureHeader(value: string | null): value is string {
  return value !== null && value.length > 0
    && new TextEncoder().encode(value).byteLength <= MAX_STRIPE_SIGNATURE_BYTES
    && !/[\u0000-\u001f\u007f]/.test(value);
}

async function readBoundedRawBody(request: Request): Promise<
  | { ok: true; body: Uint8Array }
  | { ok: false; status: 400 | 413 }
> {
  const declaredHeader = request.headers.get('content-length');
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader)) {
      await cancelBody(request.body);
      return { ok: false, status: 400 };
    }
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared > MAX_STRIPE_WEBHOOK_BODY_BYTES) {
      await cancelBody(request.body);
      return { ok: false, status: 413 };
    }
  }
  if (!request.body) return { ok: true, body: new Uint8Array() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > MAX_STRIPE_WEBHOOK_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the bounded public rejection.
        }
        return { ok: false, status: 413 };
      }
      chunks.push(chunk.value.slice());
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // Preserve the bounded public rejection.
    }
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}

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
  const signature = req.headers.get('stripe-signature');

  if (!validSignatureHeader(signature)) {
    await cancelBody(req.body);
    recordTelemetry('webhook.signature_rejected', {
      operation: 'validate', outcome: 'rejected', provider: 'stripe',
      http_status: 400, path: '/api/webhooks/stripe', trigger: 'webhook',
    });
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const rawBody = await readBoundedRawBody(req);
  if (!rawBody.ok) {
    recordTelemetry('webhook.signature_rejected', {
      operation: 'validate', outcome: 'rejected', provider: 'stripe',
      http_status: rawBody.status, path: '/api/webhooks/stripe', trigger: 'webhook',
    });
    return NextResponse.json(
      { error: 'Webhook payload was rejected' },
      { status: rawBody.status }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature for security
    event = await constructWebhookEvent(
      rawBody.body,
      signature
    );
  } catch (error) {
    recordTelemetry('webhook.signature_rejected', {
      operation: 'validate', outcome: 'rejected', provider: 'stripe',
      http_status: 400, path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
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
    recordTelemetry('webhook.claim_failed', {
      operation: 'claim', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
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
        outcome = 'handled';
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        outcome = 'ignored';
        break;

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.payment_attempt_required':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.pending_update_applied':
      case 'customer.subscription.pending_update_expired':
        outcome = await handleSubscriptionStripeEvent(event);
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
        outcome = 'ignored';
    }

    const completed = await completeWebhookEvent({
      eventId: event.id,
      claimToken: claim.claimToken,
      outcome,
    });
    if (!completed) {
      recordTelemetry('webhook.ownership_lost', {
        operation: 'complete', outcome: 'conflict', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      });
      return retryableResponse('Webhook ownership expired before completion');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
    try {
      const failed = await failWebhookEvent({
        eventId: event.id,
        claimToken: claim.claimToken,
        error,
      });
      if (!failed) {
        recordTelemetry('webhook.ownership_lost', {
          operation: 'record_failure', outcome: 'conflict', provider: 'd1', retryable: true,
          path: '/api/webhooks/stripe', trigger: 'webhook',
        });
      }
    } catch (claimError) {
      recordTelemetry('webhook.failure_record_failed', {
        operation: 'record_failure', outcome: 'failed', provider: 'd1', retryable: true,
        path: '/api/webhooks/stripe', trigger: 'webhook',
      }, claimError);
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
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    recordTelemetry('webhook.payment_verification_rejected', {
      operation: 'validate', outcome: 'rejected', provider: 'stripe',
      path: '/api/webhooks/stripe', trigger: 'webhook',
    });
    return 'permanent_rejection';
  }

  try {
    await finalizeOrderPayment({
      orderId,
      paymentIntentId: paymentIntent.id,
      enforceOwnership: false,
      sendEmail: true,
      capabilities: await resolveRuntimeCommerceCapabilities(),
    });
    return 'handled';
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      recordTelemetry('webhook.payment_verification_rejected', {
        operation: 'validate', outcome: 'rejected', provider: 'stripe',
        path: '/api/webhooks/stripe', trigger: 'webhook',
      }, error);
      return 'permanent_rejection';
    }
    // Transient D1/Stripe failures must reach POST's 500 response so Stripe
    // retries the signed event instead of recording a false success.
    throw error;
  }
}

/**
 * Handle failed payment intent
 * Records a telemetry-only signal for the operator: no order-state change,
 * no email, no inventory adjustment, no ledger write. ADR-WRI forbids state
 * changes outside the ledgers, and a failed payment is not a ledger event.
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    recordTelemetry('payment.intent_failed', {
      provider: 'stripe',
      outcome: 'failed',
      reason: mapDeclineReason(paymentIntent.last_payment_error),
    });
  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
  }
}

/**
 * Handle completed checkout session
 * Processes successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  
  if (!orderId) return;

  try {
    // Handle checkout completion
    // You can add additional logic here:
    // - Final order confirmation
    // - Customer onboarding
    // - Thank you emails
    
  } catch (error) {
    recordTelemetry('webhook.processing_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      path: '/api/webhooks/stripe', trigger: 'webhook',
    }, error);
  }
}
