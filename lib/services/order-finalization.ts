import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { eq } from 'drizzle-orm';
import { Money } from '@/lib/money';
import { hydrateOrder, promoteOrderToPaid } from '@/lib/models/mach/orders';
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
  const expected = Money.fromStored(order.total_amount, order.currency_code);
  const receivedCurrency = String(paymentIntent.currency).toUpperCase();
  if (receivedCurrency !== expected.currency) {
    throw new PaymentVerificationError('Payment currency does not match the order');
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
  // A non-cash tender must still be authoritatively reserved at finalization.
  // Failure occurs before the paid CAS, so core never accepts underfunded goods.
  await capabilities.giftCards.verifyReservedTender({
    order,
    state: extensions.checkout_tender_state,
    expectedTender,
  });

  const amountReceived = Money.fromMinor(paymentIntent.amount_received, receivedCurrency);
  const promotion = await promoteOrderToPaid({ orderId: args.orderId, amountReceived });
  if (!promotion.order || promotion.order.payment_status !== 'paid') {
    throw new Error('Order payment promotion lost without a paid winner');
  }

  if (promotion.promoted) {
    const finalOrder = promotion.order;
    const finalExtensions = finalOrder.extensions ?? {};

    // These effects are owned only by the pending→paid CAS winner. Coupon
    // redemption is additionally order-key idempotent in case an operator
    // explicitly re-drives it after an interrupted effect.
    for (const code of Array.isArray(finalExtensions.discount_codes)
      ? finalExtensions.discount_codes.filter((value): value is string => typeof value === 'string')
      : []) {
      try {
        await redeemCoupon(code, {
          orderId: finalOrder.id!,
          customerId: finalOrder.customer_id,
          channel: 'web',
          discountAmount: finalExtensions.discount_codes.length === 1
            ? Money.fromStored(finalExtensions.checkout_discount ?? 0, finalOrder.currency_code).toMach()
            : undefined,
        });
      } catch (error) {
        console.error(`[checkout] Coupon redemption failed for order ${finalOrder.id}:`, error);
      }
    }

    try {
      await capabilities.giftCards.applyTender({
        order: finalOrder,
        state: finalExtensions.checkout_tender_state,
      });
      await capabilities.subscriptions.orderPaid(finalOrder);
    } catch (error) {
      console.error(`[checkout] Optional paid-order capability failed for ${finalOrder.id}:`, error);
    }

    if (args.sendEmail !== false) await sendConfirmation(finalOrder);
  }

  return { paid: true, promoted: promotion.promoted, order: promotion.order };
}
