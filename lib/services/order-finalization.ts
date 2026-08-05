import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { eq } from 'drizzle-orm';
import { Money } from '@/lib/money';
import {
  hydrateOrder,
  promoteOrderToPaid,
  recordCouponReconciliation,
} from '@/lib/models/mach/orders';
import { redeemCoupon } from '@/lib/models/mach/couponInstance';
import { retrievePaymentIntent } from '@/lib/stripe';
import { sendOrderConfirmationEmail } from '@/lib/utils/email';
import {
  noOpCommerceCapabilities,
  type CommerceCapabilities,
} from '@/lib/commerce/capabilities';
import type { Order } from '@/lib/types/order';

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

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const values = value as Record<string, unknown>;
    const localized = values.en ?? Object.values(values)[0];
    if (typeof localized === 'string') return localized;
  }
  return '';
}

async function sendConfirmation(order: Order): Promise<void> {
  const address = order.shipping_address;
  const extensions = order.extensions ?? {};
  const email = typeof extensions.email === 'string'
    ? extensions.email
    : address?.email;
  if (!email || !address) return;

  await sendOrderConfirmationEmail({
    orderNumber: order.id!,
    customerName: address.recipient || address.company || 'Customer',
    customerEmail: email,
    items: order.items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      price: Money.fromStored(item.unit_price, order.currency_code).toJSON(),
      quantity: item.quantity,
    })),
    subtotal: Money.fromStored(
      extensions.checkout_catalog_subtotal ?? extensions.checkout_subtotal ?? 0,
      order.currency_code
    ).toJSON(),
    shipping: Money.fromStored(
      extensions.checkout_shipping_before_discount ?? extensions.checkout_shipping ?? 0,
      order.currency_code
    ).toJSON(),
    tax: Money.fromStored(extensions.checkout_tax ?? 0, order.currency_code).toJSON(),
    discount: Money.fromStored(extensions.checkout_discount ?? 0, order.currency_code).toJSON(),
    tender: Money.fromStored(extensions.checkout_tender ?? 0, order.currency_code).toJSON(),
    total: Money.fromStored(order.total_amount, order.currency_code).toJSON(),
    shippingAddress: {
      street: [text(address.line1), text(address.line2)].filter(Boolean).join(', '),
      city: text(address.city),
      state: address.region || '',
      zipCode: address.postal_code || '',
      country: address.country,
    },
  });
}

export interface FinalizeOrderResult {
  paid: boolean;
  promoted: boolean;
  order: Order;
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

  const amountReceived = Money.fromMinor(paymentIntent.amount_received, receivedCurrency);
  const promotion = await promoteOrderToPaid({ orderId: args.orderId, amountReceived });
  if (!promotion.order || promotion.order.payment_status !== 'paid') {
    throw new Error('Order payment promotion lost without a paid winner');
  }

  // Coupon usage is a paid-order effect, but is independently order-idempotent.
  // Run it for both the CAS winner and already-paid convergence so a transient
  // failure can be recovered by the next signed webhook/finalization retry.
  const paidOrder = promotion.order;
  const paidExtensions = paidOrder.extensions ?? {};
  const discountCodes = Array.isArray(paidExtensions.discount_codes)
    ? paidExtensions.discount_codes.filter((value): value is string => typeof value === 'string')
    : [];
  for (const code of discountCodes) {
    const redemption = await redeemCoupon(code, {
      orderId: paidOrder.id!,
      customerId: paidOrder.customer_id,
      channel: 'web',
      discountAmount: discountCodes.length === 1
        ? Money.fromStored(paidExtensions.checkout_discount ?? 0, paidOrder.currency_code).toMach()
        : undefined,
    });
    if (!redemption.redeemed && !redemption.alreadyRedeemed) {
      // Captured money is already durably paid. A last-use race needs
      // reconciliation, but cannot roll back or strand the paid order.
      await recordCouponReconciliation({ orderId: paidOrder.id!, code });
      console.error(`[checkout] Applied coupon ${code} needs reconciliation for order ${paidOrder.id}`);
    }
  }

  // Tender settlement is keyed by order and must be idempotent. Run it on both
  // the CAS winner and already-paid convergence; transient failures propagate
  // to the webhook so a later delivery can recover settlement.
  await capabilities.giftCards.applyTender({
    order: paidOrder,
    state: paidExtensions.checkout_tender_state,
  });
  // Subscription activation follows the same order-idempotent recovery
  // contract and must surface transient failures for webhook retry.
  await capabilities.subscriptions.orderPaid(paidOrder);

  if (promotion.promoted) {
    if (args.sendEmail !== false) {
      try {
        await sendConfirmation(paidOrder);
      } catch (error) {
        // Paid is already durable. Email is a best-effort post-paid effect until
        // a later webhook/effect-ledger phase can provide retry and dedup state.
        console.error(`[checkout] Confirmation email failed for order ${paidOrder.id}:`, error);
      }
    }
  }

  return { paid: true, promoted: promotion.promoted, order: promotion.order };
}
