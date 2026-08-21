import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { Money, toWireMoney } from '@/lib/money';
import { priceCheckout, type CheckoutLineInput } from '@/lib/services/checkout-pricing';
import { cancelPaymentIntent, createPaymentIntent } from '@/lib/stripe';
import type { Address } from '@/lib/types';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { isBoundedString, isPlainRecord } from '@/lib/public-request-validation';
import { createCustomer, getCustomer } from '@/lib/models/mach/customer';
import {
  assertCheckoutInventoryAvailable,
  InventoryUnavailableError,
} from '@/lib/services/inventory-adjustments';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { resolveRuntimeCommerceCapabilities } from '@/lib/commerce/runtime';
import { hasPhysicalCheckoutLines } from '@/lib/gift-cards/checkout';
import { finalizeZeroCashGiftOrder } from '@/lib/services/order-finalization';
import {
  noOpCommerceCapabilities,
  type CommerceCapabilities,
} from '@/lib/commerce/capabilities';

interface PaymentIntentRequest {
  items: CheckoutLineInput[];
  shippingAddress: unknown;
  shippingMethodId: string;
  discountCodes?: string[];
  giftCardToken?: string;
  giftCardRequestKey?: string;
}

function normalizeAddress(value: unknown): Address | null {
  if (!isPlainRecord(value)) return null;
  const normalizedEmail = typeof value.email === 'string' ? value.email.trim() : undefined;
  if (!(
    isBoundedString(value.line1, 256) &&
    isBoundedString(value.city, 128) &&
    isBoundedString(value.country, 2) && /^[A-Za-z]{2}$/.test(value.country) &&
    isBoundedString(value.region, 128) &&
    isBoundedString(value.postal_code, 32) &&
    (value.line2 === undefined || isBoundedString(value.line2, 256, { allowEmpty: true })) &&
    (value.company === undefined || isBoundedString(value.company, 256, { allowEmpty: true })) &&
    (value.recipient === undefined || isBoundedString(value.recipient, 256, { allowEmpty: true })) &&
    (value.email === undefined || (
      isBoundedString(value.email, 320, { allowEmpty: true }) &&
      (normalizedEmail === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail ?? ''))
    ))
  )) return null;
  return {
    line1: value.line1,
    ...(value.line2 !== undefined ? { line2: value.line2 } : {}),
    city: value.city,
    region: value.region,
    postal_code: value.postal_code,
    country: value.country.trim().toUpperCase(),
    ...(value.company !== undefined ? { company: value.company } : {}),
    ...(value.recipient !== undefined ? { recipient: value.recipient } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    type: 'shipping',
    status: 'unverified',
  };
}

function newOrderId(userId: string | null): string {
  const owner = (userId ?? 'guest').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'GUEST';
  return `WEB-${owner}-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(
    'PUBLIC_RATE_LIMITER',
    `payment-intent:${getClientIp(request)}`
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }
  if (!isPlainRecord(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = body as unknown as PaymentIntentRequest;
  const shippingAddress = normalizeAddress(input.shippingAddress);
  if (
    !shippingAddress ||
    !isBoundedString(input.shippingMethodId, 128) ||
    (input.giftCardToken !== undefined && !isBoundedString(input.giftCardToken, 512)) ||
    (input.giftCardRequestKey !== undefined && !isBoundedString(input.giftCardRequestKey, 256))
  ) {
    return NextResponse.json({ error: 'Invalid checkout details' }, { status: 400 });
  }

  const { userId } = await auth();
  let quote: Awaited<ReturnType<typeof priceCheckout>>;
  let capabilities: CommerceCapabilities;
  try {
    capabilities = input.giftCardToken
      ? await resolveRuntimeCommerceCapabilities()
      : noOpCommerceCapabilities;
    quote = await priceCheckout({
      items: input.items,
      shippingAddress,
      shippingMethodId: input.shippingMethodId,
      discountCodes: input.discountCodes,
      giftCardToken: input.giftCardToken,
      giftCardRequestKey: input.giftCardRequestKey,
      customerId: userId ?? undefined,
    }, { capabilities });
  } catch (error) {
    recordTelemetry('payment.pricing_rejected', {
      operation: 'validate', outcome: 'rejected', path: '/api/payment-intent',
    }, error);
    return NextResponse.json(
      { error: 'Checkout details are invalid or unavailable' },
      { status: 400 }
    );
  }

  const total = Money.fromStored(quote.total);
  try {
    await assertCheckoutInventoryAvailable(quote.items);
  } catch (error) {
    if (error instanceof InventoryUnavailableError) {
      recordTelemetry('payment.inventory_unavailable', {
        operation: 'validate', outcome: 'unavailable',
        count: error.variantIds.length, path: '/api/payment-intent',
      }, error);
      return NextResponse.json(
        { error: 'One or more items are no longer available in the requested quantity' },
        { status: 409 }
      );
    }
    recordTelemetry('payment.inventory_check_failed', {
      operation: 'validate', outcome: 'failed', provider: 'd1',
      retryable: true, path: '/api/payment-intent',
    }, error);
    return NextResponse.json({ error: 'Inventory is temporarily unavailable' }, { status: 503 });
  }

  // Preserve the authenticated customer→order FK before creating any payment
  // object. Failure is not downgraded to a guest order.
  if (userId) {
    try {
      const existingCustomer = await getCustomer(userId);
      if (!existingCustomer) {
        const user = await currentUser();
        await createCustomer({
          id: userId,
          type: 'person',
          person: {
            email: user?.emailAddresses[0]?.emailAddress || shippingAddress.email || '',
            first_name: user?.firstName || '',
            last_name: user?.lastName || '',
            full_name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
          },
        });
      }
    } catch (error) {
      recordTelemetry('payment.customer_prepare_failed', {
        operation: 'persist', outcome: 'failed', provider: 'd1',
        retryable: true, path: '/api/payment-intent',
      }, error);
      return NextResponse.json({ error: 'Could not prepare authenticated checkout' }, { status: 503 });
    }
  }

  const orderId = newOrderId(userId);
  let paymentIntent: Awaited<ReturnType<typeof createPaymentIntent>> | undefined;
  if (total.gt(Money.zero(total.currency))) try {
    paymentIntent = await createPaymentIntent({
      amount: total.toMinorUnits(),
      currency: total.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId,
        expectedAmount: String(total.toMinorUnits()),
        currency: total.currency,
      },
      shipping: {
        address: {
          line1: String(shippingAddress.line1),
          line2: shippingAddress.line2 ? String(shippingAddress.line2) : undefined,
          city: String(shippingAddress.city),
          state: shippingAddress.region,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
        name: shippingAddress.recipient || 'Customer',
      },
      description: `Order ${orderId}`,
    });
  } catch (error) {
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({
        state: quote.tenderState,
        reason: 'cash payment initialization failed',
      }).catch(() => undefined);
    }
    recordTelemetry('payment.intent_create_failed', {
      operation: 'create', outcome: 'failed', provider: 'stripe',
      retryable: true, path: '/api/payment-intent',
    }, error);
    return NextResponse.json({ error: 'Payment provider is unavailable' }, { status: 503 });
  }

  const providerAmount = paymentIntent ? Number(paymentIntent.amount) : total.toMinorUnits();
  const providerCurrency = paymentIntent ? String(paymentIntent.currency || '').toUpperCase() : total.currency;
  if (paymentIntent && (
    !Number.isSafeInteger(providerAmount) ||
    providerAmount !== total.toMinorUnits() ||
    providerCurrency !== total.currency ||
    !paymentIntent.client_secret
  )) {
    recordTelemetry('payment.intent_invalid', {
      operation: 'validate', outcome: 'invalid', provider: 'stripe',
      http_status: 502, path: '/api/payment-intent',
    });
    await cancelPaymentIntent(paymentIntent.id).catch((error) => {
      recordTelemetry('payment.intent_cancel_failed', {
        operation: 'process', outcome: 'failed', provider: 'stripe',
        retryable: true, path: '/api/payment-intent',
      }, error);
    });
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({
        state: quote.tenderState,
        reason: 'cash payment validation failed',
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: 'Payment provider returned an invalid intent' }, { status: 502 });
  }

  const catalogSubtotal = Money.fromStored(quote.subtotal);
  const merchandiseDiscount = Money.fromStored(quote.merchandiseDiscount, quote.currency);
  const baseShipping = Money.fromStored(quote.shipping, quote.currency);
  const shippingDiscount = Money.fromStored(quote.shippingDiscount, quote.currency);
  const extensions = {
    email: shippingAddress.email,
    ...(paymentIntent ? { payment_intent_id: paymentIntent.id } : {}),
    checkout_catalog_subtotal: catalogSubtotal.toJSON(),
    checkout_subtotal: catalogSubtotal.subtract(merchandiseDiscount).toJSON(),
    checkout_discount: quote.discount,
    checkout_merchandise_discount: quote.merchandiseDiscount,
    checkout_shipping_before_discount: baseShipping.toJSON(),
    checkout_shipping_discount: quote.shippingDiscount,
    checkout_shipping: baseShipping.subtract(shippingDiscount).toJSON(),
    checkout_tax: quote.tax,
    checkout_shipping_tax: quote.shippingTax,
    checkout_line_allocations: quote.lineAllocations,
    checkout_tender: quote.tender,
    checkout_tender_state: quote.tenderState,
    checkout_total: total.toJSON(),
    discount_codes: quote.discountCodes,
    tax_source: quote.taxSource,
  };

  try {
    const db = await getDbAsync();
    await db.insert(orders).values({
      id: orderId,
      customer_id: userId,
      status: 'pending',
      total_amount: total.toJSON(),
      currency_code: providerCurrency,
      shipping_address: hasPhysicalCheckoutLines(quote.items) ? shippingAddress : null,
      billing_address: shippingAddress,
      items: quote.items,
      shipping_method: hasPhysicalCheckoutLines(quote.items) ? quote.shippingMethod.label : null,
      payment_method: paymentIntent ? 'stripe' : 'gift_card',
      payment_status: 'pending',
      external_references: paymentIntent ? { payment_intent_id: paymentIntent.id } : null,
      extensions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    recordTelemetry('payment.order_persist_failed', {
      operation: 'persist', outcome: 'failed', provider: 'd1',
      retryable: true, path: '/api/payment-intent',
    }, error);
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({ state: quote.tenderState, reason: 'checkout persistence failed' })
        .catch(() => undefined);
    }
    if (paymentIntent) await cancelPaymentIntent(paymentIntent.id).catch((cancelError) => {
      recordTelemetry('payment.intent_cancel_failed', {
        operation: 'process', outcome: 'failed', provider: 'stripe',
        retryable: true, path: '/api/payment-intent',
      }, cancelError);
    });
    // The client secret is deliberately withheld: without a durable, immutable
    // order binding the intent must never be confirmable by this checkout.
    return NextResponse.json(
      { error: 'Could not reserve the order; no payment was accepted' },
      { status: 503 }
    );
  }

  if (!paymentIntent) {
    try {
      const finalized = await finalizeZeroCashGiftOrder({
        orderId,
        customerId: userId ?? undefined,
        enforceOwnership: true,
        sendEmail: true,
        capabilities,
      });
      return NextResponse.json({
        noCash: true,
        orderId: finalized.order.id,
        amount: toWireMoney(total.toJSON()),
        quote: {
          items: quote.items.map((item) => ({
            productId: item.product_id, variantId: item.variant_id, name: item.product_name,
            quantity: item.quantity, unitPrice: toWireMoney(item.unit_price, providerCurrency),
            lineTotal: toWireMoney(item.total_price, providerCurrency),
          })),
          subtotal: toWireMoney(quote.subtotal), discount: toWireMoney(quote.discount),
          shipping: toWireMoney(quote.shipping), tax: toWireMoney(quote.tax),
          tender: toWireMoney(quote.tender), total: toWireMoney(total.toJSON()),
          currency: providerCurrency, taxSource: quote.taxSource,
        },
      });
    } catch (error) {
      recordTelemetry('order.finalization_failed', {
        operation: 'finalize', outcome: 'failed', retryable: true, path: '/api/payment-intent',
      }, error);
      return NextResponse.json({ error: 'Gift-card checkout could not be finalized' }, { status: 409 });
    }
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    orderId,
    amount: toWireMoney(Money.fromMinor(providerAmount, providerCurrency).toJSON()),
    quote: {
      items: quote.items.map((item) => ({
        productId: item.product_id,
        variantId: item.variant_id,
        name: item.product_name,
        quantity: item.quantity,
        unitPrice: toWireMoney(item.unit_price, providerCurrency),
        lineTotal: toWireMoney(item.total_price, providerCurrency),
      })),
      subtotal: toWireMoney(quote.subtotal),
      discount: toWireMoney(quote.discount),
      shipping: toWireMoney(quote.shipping),
      tax: toWireMoney(quote.tax),
      tender: toWireMoney(quote.tender),
      total: toWireMoney(Money.fromMinor(providerAmount, providerCurrency).toJSON()),
      currency: providerCurrency,
      taxSource: quote.taxSource,
    },
  });
}
