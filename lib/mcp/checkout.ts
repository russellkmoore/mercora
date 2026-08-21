import { and, eq, sql } from 'drizzle-orm';
import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { Money, toWireMoney } from '@/lib/money';
import { hydrateOrder } from '@/lib/models/mach/orders';
import { isBoundedString, isPlainRecord } from '@/lib/public-request-validation';
import {
  priceCheckout,
  MAX_CHECKOUT_LINES,
  type CheckoutQuote,
} from '@/lib/services/checkout-pricing';
import {
  assertCheckoutInventoryAvailable,
} from '@/lib/services/inventory-adjustments';
import { cancelPaymentIntent, createPaymentIntent } from '@/lib/stripe';
import type { Address, Order } from '@/lib/types';
import type { AgentSession } from './types';
import { resolveRuntimeCommerceCapabilities } from '@/lib/commerce/runtime';
import { createCartLineId } from '@/lib/gift-cards/line-identity';
import { hasPhysicalCheckoutLines } from '@/lib/gift-cards/checkout';
import { finalizeZeroCashGiftOrder } from '@/lib/services/order-finalization';
import { noOpCommerceCapabilities } from '@/lib/commerce/capabilities';

export interface McpCheckoutRequest {
  shippingAddress: unknown;
  shippingMethodId?: string;
  shippingOption?: string;
  discountCodes?: string[];
  giftCardToken?: string;
  giftCardRequestKey?: string;
}

export interface McpCheckoutResult {
  clientSecret?: string;
  paymentIntentId?: string;
  orderId: string;
  amount: ReturnType<typeof toWireMoney>;
  quote: CheckoutQuote;
  /** The order was paid and finalized without a Stripe PaymentIntent. */
  noCash: boolean;
}

export function normalizeMcpAddress(value: unknown): Address {
  if (!isPlainRecord(value)) throw new Error('Shipping address is required');
  const line1 = value.line1 ?? value.street;
  const line2 = value.line2 ?? value.street2;
  const region = value.region ?? value.state;
  const postalCode = value.postal_code ?? value.postalCode;
  const country = value.country ?? 'US';
  const email = typeof value.email === 'string' ? value.email.trim() : undefined;

  if (!(
    isBoundedString(line1, 256) &&
    isBoundedString(value.city, 128) &&
    isBoundedString(region, 128) &&
    isBoundedString(postalCode, 32) &&
    isBoundedString(country, 2) && /^[A-Za-z]{2}$/.test(country) &&
    (line2 === undefined || isBoundedString(line2, 256, { allowEmpty: true })) &&
    (value.recipient === undefined || isBoundedString(value.recipient, 256, { allowEmpty: true })) &&
    (email === undefined || email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )) {
    throw new Error('Shipping address is invalid');
  }

  return {
    line1,
    ...(line2 !== undefined ? { line2 } : {}),
    city: value.city,
    region,
    postal_code: postalCode,
    country: country.toUpperCase(),
    ...(value.recipient !== undefined ? { recipient: value.recipient } : {}),
    ...(email ? { email } : {}),
    type: 'shipping',
    status: 'unverified',
  };
}

function newMcpOrderId(agentId: string): string {
  const owner = agentId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 32) || 'AGENT';
  return `MCP-${owner}-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createMcpCheckout(args: {
  agentId: string;
  session: AgentSession;
  input: McpCheckoutRequest;
}): Promise<McpCheckoutResult> {
  if (args.session.cart.length === 0) throw new Error('Cart is empty');
  if (args.session.cart.length > MAX_CHECKOUT_LINES) {
    throw new Error(`Cart has too many distinct items (max ${MAX_CHECKOUT_LINES})`);
  }

  const shippingAddress = normalizeMcpAddress(args.input.shippingAddress);
  const shippingMethodId = args.input.shippingMethodId ?? args.input.shippingOption;
  if (!isBoundedString(shippingMethodId, 128)) throw new Error('Shipping method is required');

  const requiresGiftCardRuntime = typeof args.input.giftCardToken === 'string' && args.input.giftCardToken !== '';
  const capabilities = requiresGiftCardRuntime
    ? await resolveRuntimeCommerceCapabilities()
    : noOpCommerceCapabilities;
  const pricingInput = {
    items: args.session.cart.map((item) => ({
      lineId: createCartLineId({ productId: item.productId, variantId: item.variantId }),
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    shippingAddress,
    shippingMethodId,
    discountCodes: args.input.discountCodes,
    giftCardToken: args.input.giftCardToken,
    giftCardRequestKey: args.input.giftCardRequestKey,
  };
  const quote = requiresGiftCardRuntime
    ? await priceCheckout(pricingInput, { capabilities })
    : await priceCheckout(pricingInput);
  await assertCheckoutInventoryAvailable(quote.items);

  const total = Money.fromStored(quote.total);
  const orderId = newMcpOrderId(args.agentId);
  let paymentIntent: Awaited<ReturnType<typeof createPaymentIntent>> | undefined;
  try {
    paymentIntent = total.gt(Money.zero(total.currency)) ? await createPaymentIntent({
    amount: total.toMinorUnits(),
    currency: total.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId,
      agentId: args.agentId,
      sessionId: args.session.sessionId,
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
    }) : undefined;
  } catch (error) {
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({
        state: quote.tenderState,
        reason: 'cash payment initialization failed',
      }).catch(() => undefined);
    }
    throw error;
  }

  const providerAmount = paymentIntent ? Number(paymentIntent.amount) : total.toMinorUnits();
  const providerCurrency = paymentIntent ? String(paymentIntent.currency || '').toUpperCase() : total.currency;
  if (paymentIntent && (
    !Number.isSafeInteger(providerAmount) ||
    providerAmount !== total.toMinorUnits() ||
    providerCurrency !== total.currency ||
    !paymentIntent.client_secret
  )) {
    await cancelPaymentIntent(paymentIntent.id).catch((error) =>
      console.error(`[mcp] Failed to cancel invalid PaymentIntent ${paymentIntent.id}:`, error)
    );
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({
        state: quote.tenderState,
        reason: 'cash payment validation failed',
      }).catch(() => undefined);
    }
    throw new Error('Payment provider returned an invalid intent');
  }

  const catalogSubtotal = Money.fromStored(quote.subtotal);
  const merchandiseDiscount = Money.fromStored(quote.merchandiseDiscount, quote.currency);
  const baseShipping = Money.fromStored(quote.shipping, quote.currency);
  const shippingDiscount = Money.fromStored(quote.shippingDiscount, quote.currency);
  const extensions = {
    agent_id: args.agentId,
    mcp_session_id: args.session.sessionId,
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
    checkout_total: Money.fromMinor(providerAmount, providerCurrency).toJSON(),
    discount_codes: quote.discountCodes,
    tax_source: quote.taxSource,
  };

  try {
    const db = await getDbAsync();
    await db.insert(orders).values({
      id: orderId,
      customer_id: null,
      status: 'pending',
      total_amount: Money.fromMinor(providerAmount, providerCurrency).toJSON(),
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
    if (quote.tenderState !== undefined) {
      await capabilities.giftCards.releaseTender?.({ state: quote.tenderState, reason: 'checkout persistence failed' })
        .catch(() => undefined);
    }
    if (paymentIntent) await cancelPaymentIntent(paymentIntent.id).catch((cancelError) =>
      console.error(`[mcp] Failed to cancel orphaned PaymentIntent ${paymentIntent.id}:`, cancelError)
    );
    throw error;
  }

  if (!paymentIntent) {
    const finalized = await finalizeZeroCashGiftOrder({
      orderId,
      enforceOwnership: false,
      sendEmail: true,
      capabilities,
    });
    return {
      orderId: finalized.order.id!,
      amount: toWireMoney(total.toJSON()),
      quote,
      noCash: true,
    };
  }

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    orderId,
    amount: toWireMoney(Money.fromMinor(providerAmount, providerCurrency).toJSON()),
    quote,
    noCash: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return asRecord(JSON.parse(value)); } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function getOwnedMcpOrder(orderId: string, agentId: string): Promise<Order | null> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!record) return null;
  const extensions = asRecord(record.extensions);
  if (extensions.agent_id !== agentId) return null;
  return hydrateOrder(record);
}

export async function getOwnedMcpOrderBinding(args: {
  orderId: string;
  paymentIntentId: string;
  agentId: string;
  sessionId: string;
}): Promise<Order | null> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders).where(and(
    eq(orders.id, args.orderId),
    sql`json_extract(${orders.external_references}, '$.payment_intent_id') = ${args.paymentIntentId}`,
  )).limit(1);
  if (!record) return null;
  const extensions = asRecord(record.extensions);
  if (
    extensions.agent_id !== args.agentId ||
    extensions.mcp_session_id !== args.sessionId ||
    extensions.payment_intent_id !== args.paymentIntentId
  ) return null;
  return hydrateOrder(record);
}

/** Fetch an already-finalized gift-funded MCP order without accepting a PI substitute. */
export async function getOwnedMcpZeroCashOrder(args: {
  orderId: string;
  agentId: string;
  sessionId: string;
}): Promise<Order | null> {
  const db = await getDbAsync();
  const [record] = await db.select().from(orders).where(and(
    eq(orders.id, args.orderId),
    eq(orders.payment_method, 'gift_card'),
  )).limit(1);
  if (!record) return null;
  const extensions = asRecord(record.extensions);
  const external = asRecord(record.external_references);
  if (
    extensions.agent_id !== args.agentId ||
    extensions.mcp_session_id !== args.sessionId ||
    typeof extensions.payment_intent_id === 'string' ||
    typeof external.payment_intent_id === 'string'
  ) return null;
  return hydrateOrder(record);
}
