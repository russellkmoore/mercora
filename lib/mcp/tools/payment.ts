import { cartSubtotal, Money, toWireMoney, type MachMoney } from '../../money';
import type { MACHAddress } from '../../types/mach/Address';
import {
  createMcpCheckout,
  normalizeMcpAddress,
  type McpCheckoutRequest,
} from '../checkout';
import { requireOwnedSession } from '../session';
import type { MCPToolResponse } from '../types';

export interface AgentPaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
  amount: MachMoney;
  noCash?: boolean;
  quote: {
    items: Array<{
      productId: string;
      variantId?: string;
      name: string;
      quantity: number;
      unitPrice: MachMoney;
      lineTotal: MachMoney;
    }>;
    total: MachMoney;
    currency: string;
  };
}

const EMPTY_PAYMENT_INTENT: AgentPaymentIntentResponse = {
  clientSecret: '',
  paymentIntentId: '',
  orderId: '',
  amount: toWireMoney(0),
  quote: { items: [], total: toWireMoney(0), currency: 'USD' },
};

export async function createAgentPaymentIntent(
  request: McpCheckoutRequest,
  sessionId: string,
  agentId: string,
): Promise<MCPToolResponse<AgentPaymentIntentResponse>> {
  const startTime = Date.now();
  const ownership = await requireOwnedSession(sessionId, agentId);
  if (!ownership.ok) {
    return {
      success: false,
      data: EMPTY_PAYMENT_INTENT,
      context: { session_id: sessionId, agent_id: agentId, processing_time_ms: Date.now() - startTime },
      error: { code: ownership.code, message: ownership.message },
      metadata: { can_fulfill_percentage: 0, estimated_satisfaction: 0 },
    };
  }

  try {
    const checkout = await createMcpCheckout({ agentId, session: ownership.session, input: request });
    return {
      success: true,
      data: {
        clientSecret: checkout.clientSecret ?? '',
        paymentIntentId: checkout.paymentIntentId ?? '',
        orderId: checkout.orderId,
        amount: checkout.amount,
        ...(checkout.noCash ? { noCash: true } : {}),
        quote: {
          items: checkout.quote.items.map((item) => ({
            productId: item.product_id,
            variantId: item.variant_id,
            name: item.product_name,
            quantity: item.quantity,
            unitPrice: toWireMoney(item.unit_price, checkout.quote.currency),
            lineTotal: toWireMoney(item.total_price, checkout.quote.currency),
          })),
          total: checkout.amount,
          currency: checkout.quote.currency,
        },
      },
      context: { session_id: sessionId, agent_id: agentId, processing_time_ms: Date.now() - startTime },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: checkout.noCash
          ? ['Save the order confirmation']
          : ['Complete the PaymentIntent', 'Call place_order with orderId and paymentIntentId'],
      },
    };
  } catch (error) {
    console.error('[mcp] PaymentIntent creation failed:', error);
    return {
      success: false,
      data: EMPTY_PAYMENT_INTENT,
      context: { session_id: sessionId, agent_id: agentId, processing_time_ms: Date.now() - startTime },
      error: { code: 'CHECKOUT_FAILED', message: 'Could not create an authoritative checkout' },
      metadata: {
        can_fulfill_percentage: 0,
        estimated_satisfaction: 0,
        next_actions: ['Verify the session cart and shipping details', 'Retry checkout'],
      },
    };
  }
}

export interface PaymentMethod {
  id: 'stripe';
  type: 'payment_intent';
  name: string;
  description: string;
  available: boolean;
}

export interface PaymentValidationRequest {
  payment_method: string;
  billing_address?: MACHAddress;
  agent_context?: unknown;
}

export interface PaymentValidationResponse {
  valid: boolean;
  payment_methods: PaymentMethod[];
  recommended_method: 'stripe';
  processing_fee: MachMoney;
  estimated_processing_time: string;
  requirements_met: boolean;
  missing_requirements?: string[];
  authoritative_total: MachMoney;
}

export async function validatePayment(
  request: PaymentValidationRequest,
  sessionId: string,
  agentId: string,
): Promise<MCPToolResponse<PaymentValidationResponse>> {
  const startTime = Date.now();
  const ownership = await requireOwnedSession(sessionId, agentId);
  if (!ownership.ok) {
    return paymentValidationFailure(sessionId, agentId, startTime, ownership.code, ownership.message);
  }

  try {
    if (request.billing_address) normalizeMcpAddress(request.billing_address);
    const subtotal = cartSubtotal(ownership.session.cart);
    const missing: string[] = [];
    if (request.payment_method !== 'stripe') missing.push("payment_method must be 'stripe'");
    if (ownership.session.cart.length === 0) missing.push('Session cart is empty');
    if (!subtotal.gt(Money.zero(subtotal.currency))) missing.push('Cart total must be positive');

    const valid = missing.length === 0;
    return {
      success: true,
      data: {
        valid,
        payment_methods: [{
          id: 'stripe',
          type: 'payment_intent',
          name: 'Stripe PaymentIntent',
          description: 'Server-priced payment through the configured Stripe account',
          available: true,
        }],
        recommended_method: 'stripe',
        processing_fee: toWireMoney(0, subtotal.currency),
        estimated_processing_time: 'Confirmed by PaymentIntent status',
        requirements_met: valid,
        missing_requirements: missing.length ? missing : undefined,
        authoritative_total: subtotal.toMach(),
      },
      context: { session_id: sessionId, agent_id: agentId, processing_time_ms: Date.now() - startTime },
      metadata: {
        can_fulfill_percentage: valid ? 100 : 0,
        estimated_satisfaction: valid ? 90 : 20,
        next_actions: valid
          ? ['Call create_payment_intent with shipping details']
          : ['Resolve the missing payment requirements'],
      },
    };
  } catch (error) {
    console.error('[mcp] Payment validation failed:', error);
    return paymentValidationFailure(
      sessionId,
      agentId,
      startTime,
      'PAYMENT_VALIDATION_FAILED',
      'Payment requirements could not be validated',
    );
  }
}

function paymentValidationFailure(
  sessionId: string,
  agentId: string,
  startTime: number,
  code: string,
  message: string,
): MCPToolResponse<PaymentValidationResponse> {
  return {
    success: false,
    data: {
      valid: false,
      payment_methods: [],
      recommended_method: 'stripe',
      processing_fee: toWireMoney(0),
      estimated_processing_time: 'Unknown',
      requirements_met: false,
      missing_requirements: [message],
      authoritative_total: toWireMoney(0),
    },
    context: { session_id: sessionId, agent_id: agentId, processing_time_ms: Date.now() - startTime },
    error: { code, message },
    metadata: { can_fulfill_percentage: 0, estimated_satisfaction: 0 },
  };
}
