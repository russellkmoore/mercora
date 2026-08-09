import { toWireMoney } from '../../money';
import {
  finalizeOrderPayment,
  PaymentVerificationError,
} from '../../services/order-finalization';
import type { MACHAddress as Address } from '../../types/mach/Address';
import {
  getOwnedMcpOrder,
  getOwnedMcpOrderBinding,
} from '../checkout';
import { requireOwnedSession } from '../session';
import { buildMcpOrderDelivery } from '../order-delivery';
import type { MCPToolResponse, OrderRequest, OrderResponse } from '../types';

const ZERO_TOTAL = toWireMoney(0);

function orderFailure(
  sessionId: string,
  agentId: string,
  startTime: number,
  code: string,
  message: string,
  nextActions: string[],
): MCPToolResponse<OrderResponse> {
  return {
    success: false,
    data: { orderId: '', status: 'failed', total: ZERO_TOTAL, estimated_delivery: '' },
    context: {
      session_id: sessionId,
      agent_id: agentId,
      processing_time_ms: Date.now() - startTime,
    },
    error: { code, message },
    metadata: {
      can_fulfill_percentage: 0,
      estimated_satisfaction: 0,
      next_actions: nextActions,
    },
  };
}

export async function placeOrder(
  request: OrderRequest,
  sessionId: string,
  agentId: string,
): Promise<MCPToolResponse<OrderResponse>> {
  const startTime = Date.now();
  if (request.agent_context) request.agent_context.agentId = agentId;

  const ownership = await requireOwnedSession(sessionId, agentId);
  if (!ownership.ok) {
    return orderFailure(
      sessionId,
      agentId,
      startTime,
      ownership.code,
      ownership.message,
      ownership.code === 'SESSION_NOT_FOUND'
        ? ['Create a new session', 'Verify session ID']
        : ['Use a session created by this agent'],
    );
  }

  const { orderId, paymentIntentId } = request;
  if (
    typeof orderId !== 'string' ||
    !/^MCP-[A-Z0-9]+-\d+-[A-F0-9]{8}$/.test(orderId) ||
    typeof paymentIntentId !== 'string' ||
    !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)
  ) {
    return orderFailure(
      sessionId,
      agentId,
      startTime,
      'PAYMENT_REQUIRED',
      'A valid orderId and paymentIntentId from create_payment_intent are required.',
      ['Call create_payment_intent', 'Complete payment', 'Retry place_order'],
    );
  }

  const pending = await getOwnedMcpOrderBinding({
    orderId,
    paymentIntentId,
    agentId,
    sessionId,
  });
  if (!pending) {
    return orderFailure(
      sessionId,
      agentId,
      startTime,
      'PAYMENT_NOT_BOUND',
      'The pending order and PaymentIntent are not bound to this agent and session.',
      ['Create a new PaymentIntent for this session'],
    );
  }

  try {
    const result = await finalizeOrderPayment({
      orderId,
      paymentIntentId,
      enforceOwnership: false,
      sendEmail: true,
    });
    const order = result.order;
    return {
      success: true,
      data: {
        orderId: order.id!,
        status: order.status,
        total: toWireMoney(order.total_amount, order.currency_code),
        tracking_number: order.tracking_number,
        estimated_delivery: calculateEstimatedDelivery(
          order.shipping_address,
          order.shipping_method || 'standard',
        ),
      },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: Date.now() - startTime,
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 95,
        next_actions: ['Save the order confirmation', 'Use get_order_status for updates'],
      },
    };
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return orderFailure(
        sessionId,
        agentId,
        startTime,
        'PAYMENT_VERIFICATION_FAILED',
        'Payment has not been verified for this order.',
        ['Complete payment', 'Retry place_order'],
      );
    }
    console.error(`[mcp] Failed to finalize order ${orderId}:`, error);
    return orderFailure(
      sessionId,
      agentId,
      startTime,
      'ORDER_FINALIZATION_FAILED',
      'The order could not be finalized.',
      ['Retry place_order; finalization is idempotent'],
    );
  }
}

export async function getOrderStatus(
  orderId: string,
  agentId: string,
): Promise<MCPToolResponse<OrderResponse>> {
  const startTime = Date.now();
  const order = await getOwnedMcpOrder(orderId, agentId);

  if (!order) {
    return orderFailure(
      'status-check',
      agentId,
      startTime,
      'ORDER_NOT_FOUND',
      'No order found for this agent with that ID.',
      ['Verify the order ID', 'Place an order with place_order'],
    );
  }

  const delivery = await buildMcpOrderDelivery(order);

  return {
    success: true,
    data: {
      orderId: order.id!,
      status: order.status,
      total: toWireMoney(order.total_amount, order.currency_code),
      tracking_number: delivery.shipment.trackingNumber ?? undefined,
      shipment: {
        carrier: delivery.shipment.carrier,
        carrier_label: delivery.shipment.carrierLabel,
        tracking_number: delivery.shipment.trackingNumber,
        tracking_url: delivery.shipment.trackingUrl,
      },
      tracking_history: delivery.history,
      estimated_delivery: delivery.estimatedDelivery,
    },
    context: {
      session_id: 'status-check',
      agent_id: agentId,
      processing_time_ms: Date.now() - startTime,
    },
    metadata: {
      can_fulfill_percentage: 100,
      estimated_satisfaction: 90,
      next_actions: order.status === 'delivered'
        ? ['Review the delivered order']
        : delivery.shipment.trackingUrl
          ? ['Track the shipment with the configured carrier']
          : ['Check back for status updates'],
    },
  };
}

function calculateEstimatedDelivery(address: Address | undefined, shippingOption: string): string {
  if (shippingOption === 'expedited' || shippingOption === 'overnight') {
    return '1-2 business days';
  }
  if (address?.region === 'AK' || address?.region === 'HI') {
    return '5-7 business days';
  }
  return '3-5 business days';
}

export function normalizeAddress(input: unknown): Address {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { line1: '', city: '', country: 'US' };
  }
  const address = input as Record<string, unknown>;
  return {
    ...address,
    line1: String(address.line1 ?? address.street ?? ''),
    line2: address.line2 === undefined && address.street2 === undefined
      ? undefined
      : String(address.line2 ?? address.street2),
    city: String(address.city ?? ''),
    region: address.region === undefined && address.state === undefined
      ? undefined
      : String(address.region ?? address.state),
    postal_code: address.postal_code === undefined && address.postalCode === undefined
      ? undefined
      : String(address.postal_code ?? address.postalCode),
    country: String(address.country ?? 'US'),
  } as Address;
}
