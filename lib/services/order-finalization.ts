import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { eq } from 'drizzle-orm';
import { Money } from '@/lib/money';
import {
  hydrateOrder,
  promoteOrderToPaid,
} from '@/lib/models/mach/orders';
import { retrievePaymentIntent } from '@/lib/stripe';
import {
  noOpCommerceCapabilities,
  type CommerceCapabilities,
} from '@/lib/commerce/capabilities';
import type { Order } from '@/lib/types/order';
import {
  drainOrderEffects,
  stagePaidOrderEffects,
} from '@/lib/services/order-effects';
import { recordTelemetry } from '@/lib/observability/telemetry';

export class PaymentVerificationError extends Error {}

function asObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return asObject(JSON.parse(value)); } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export interface FinalizeOrderResult {
  paid: boolean;
  promoted: boolean;
  order: Order;
}

/**
 * Finalize an order wholly funded by a committed gift-card reservation. This
 * is intentionally separate from PaymentIntent finalization: no Stripe object
 * is created, retrieved, or simulated for a zero-cash transaction.
 */
export async function finalizeZeroCashGiftOrder(args: {
  orderId: string;
  customerId?: string;
  enforceOwnership?: boolean;
  sendEmail?: boolean;
  capabilities: CommerceCapabilities;
}): Promise<FinalizeOrderResult> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  if (!record) throw new PaymentVerificationError('Pending order not found');
  const order = hydrateOrder(record);
  if (args.enforceOwnership && order.customer_id && order.customer_id !== args.customerId) {
    throw new PaymentVerificationError('Order does not belong to the authenticated customer');
  }
  const extensions = asObject(record.extensions);
  const total = Money.fromStored(extensions.checkout_total ?? order.total_amount, order.currency_code);
  const tender = Money.fromStored(extensions.checkout_tender ?? 0, order.currency_code);
  if (!total.isZero() || tender.isZero() || !order.id) {
    throw new PaymentVerificationError('Order is not eligible for zero-cash gift-card finalization');
  }
  if (order.payment_status !== 'paid') {
    await args.capabilities.giftCards.verifyReservedTender({
      order,
      state: extensions.checkout_tender_state,
      expectedTender: tender,
    });
  }
  await stagePaidOrderEffects(order, { includeEmail: args.sendEmail !== false });
  const promotion = await promoteOrderToPaid({
    orderId: order.id,
    amountReceived: Money.zero(order.currency_code),
  });
  if (!promotion.order || promotion.order.payment_status !== 'paid') {
    throw new Error('Order payment promotion lost without a paid winner');
  }
  try {
    await stagePaidOrderEffects(promotion.order, { includeEmail: args.sendEmail !== false });
    await drainOrderEffects({ orderId: promotion.order.id!, capabilities: args.capabilities, limit: 25 });
  } catch (error) {
    recordTelemetry('paid_effect.drain_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true, trigger: 'request',
    }, error);
  }
  return { paid: true, promoted: promotion.promoted, order: promotion.order };
}

/**
 * Verify a captured PaymentIntent and atomically promote exactly one pending
 * order. Client returns and signed webhooks both call this routine.
 */
export async function finalizeOrderPayment(args: {
  orderId: string;
  paymentIntentId: string;
  customerId?: string;
  enforceOwnership?: boolean;
  sendEmail?: boolean;
  capabilities?: CommerceCapabilities;
}): Promise<FinalizeOrderResult> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  if (!record) throw new PaymentVerificationError('Pending order not found');
  const order = hydrateOrder(record);
  if (args.enforceOwnership && order.customer_id && order.customer_id !== args.customerId) {
    throw new PaymentVerificationError('Order does not belong to the authenticated customer');
  }

  const extensions = asObject(record.extensions);
  const external = asObject(record.external_references);
  if (
    extensions.payment_intent_id !== args.paymentIntentId ||
    external.payment_intent_id !== args.paymentIntentId
  ) {
    throw new PaymentVerificationError('PaymentIntent is not bound to this order');
  }

  const paymentIntent = await retrievePaymentIntent(args.paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    throw new PaymentVerificationError('Payment has not succeeded');
  }
  if (paymentIntent.metadata?.orderId !== args.orderId) {
    throw new PaymentVerificationError('PaymentIntent order binding is invalid');
  }
  // checkout_total remains the immutable authorized amount after paid
  // promotion replaces total_amount with the actual captured receipt amount.
  const expected = Money.fromStored(
    extensions.checkout_total ?? order.total_amount,
    order.currency_code
  );
  const receivedCurrency = String(paymentIntent.currency).toUpperCase();
  if (receivedCurrency !== expected.currency) {
    throw new PaymentVerificationError('Payment currency does not match the order');
  }
  if (!Number.isSafeInteger(paymentIntent.amount) || paymentIntent.amount !== expected.toMinorUnits()) {
    throw new PaymentVerificationError('PaymentIntent amount does not match the server quote');
  }
  if (
    !Number.isSafeInteger(paymentIntent.amount_received) ||
    paymentIntent.amount_received < expected.toMinorUnits()
  ) {
    throw new PaymentVerificationError('Captured payment is below the server charge floor');
  }

  const capabilities = args.capabilities ?? noOpCommerceCapabilities;
  const expectedTender = Money.fromStored(
    extensions.checkout_tender ?? 0,
    order.currency_code
  );
  if (order.payment_status !== 'paid') {
    // A pending order's non-cash tender must still be authoritatively reserved
    // before the paid CAS. Already-paid retries recover settlement by order id
    // without requiring the original reservation to remain open.
    await capabilities.giftCards.verifyReservedTender({
      order,
      state: extensions.checkout_tender_state,
      expectedTender,
    });
  }

  // Stage deterministic, dormant effect rows before the paid CAS. A crash
  // after promotion can then be recovered by another request or the scheduler.
  try {
    await stagePaidOrderEffects(order, { includeEmail: args.sendEmail !== false });
  } catch (error) {
    recordTelemetry('paid_effect.staging_failed', {
      operation: 'stage', outcome: 'failed', provider: 'd1', retryable: true,
    }, error);
    throw error;
  }

  const amountReceived = Money.fromMinor(paymentIntent.amount_received, receivedCurrency);
  const promotion = await promoteOrderToPaid({ orderId: args.orderId, amountReceived });
  if (!promotion.order || promotion.order.payment_status !== 'paid') {
    throw new Error('Order payment promotion lost without a paid winner');
  }

  const paidOrder = promotion.order;
  // Ensure repairs legacy/already-paid convergence. Inline draining is an
  // optimization; every failure remains durable for scheduled retry.
  try {
    await stagePaidOrderEffects(paidOrder, { includeEmail: args.sendEmail !== false });
  } catch (error) {
    recordTelemetry('paid_effect.staging_failed', {
      operation: 'stage', outcome: 'failed', provider: 'd1', retryable: true,
    }, error);
    throw error;
  }
  try {
    const effects = await drainOrderEffects({
      orderId: paidOrder.id!,
      capabilities,
      limit: 25,
    });
    if (effects.failed > 0) {
      recordTelemetry('paid_effect.first_attempt_failed', {
        operation: 'process', outcome: 'retry_scheduled', count: effects.failed,
        retryable: true, trigger: 'request',
      });
    }
  } catch (error) {
    // Paid state and deterministic effect rows are already durable. The
    // scheduled runner owns recovery even if this opportunistic drain cannot
    // reach D1 after the payment transition.
    recordTelemetry('paid_effect.drain_failed', {
      operation: 'process', outcome: 'failed', provider: 'd1', retryable: true,
      trigger: 'request',
    }, error);
  }

  return { paid: true, promoted: promotion.promoted, order: promotion.order };
}
