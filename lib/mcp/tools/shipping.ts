import { cartSubtotal, Money, toWireMoney, type MachMoney } from '../../money';
import {
  allowedShippingCountries,
  enabledShippingMethods,
  freeShippingMethodIds,
  freeShippingThreshold,
} from '../../shipping/allowed-countries';
import type { CartItem } from '../../types/cartitem';
import type { MACHAddress } from '../../types/mach/Address';
import { getSettings } from '../../utils/settings';
import { normalizeMcpAddress } from '../checkout';
import { requireOwnedSession } from '../session';
import type { MCPToolResponse } from '../types';

export interface ShippingOption {
  id: string;
  name: string;
  estimated_days: string;
  price: MachMoney;
}

export interface ShippingRequest {
  address: MACHAddress;
  cart?: CartItem[];
  agent_context?: unknown;
}

export interface ShippingResponse {
  shipping_options: ShippingOption[];
  default_option: string;
  restrictions?: string[];
}

export async function getShippingOptions(
  request: ShippingRequest,
  sessionId: string,
  agentId: string,
): Promise<MCPToolResponse<ShippingResponse>> {
  const startTime = Date.now();
  const ownership = await requireOwnedSession(sessionId, agentId);
  if (!ownership.ok) {
    return failure(sessionId, agentId, startTime, ownership.code, ownership.message);
  }

  try {
    const address = normalizeMcpAddress(request.address);
    const [shippingSettings, storeSettings] = await Promise.all([
      getSettings('shipping'),
      getSettings('store'),
    ]);
    const country = address.country.toUpperCase();
    if (!allowedShippingCountries(shippingSettings).includes(country)) {
      return failure(
        sessionId,
        agentId,
        startTime,
        'DESTINATION_UNAVAILABLE',
        'Shipping options are not available for this destination',
      );
    }

    const subtotal = cartSubtotal(ownership.session.cart);
    const threshold = freeShippingThreshold(storeSettings);
    const freeMethods = freeShippingMethodIds(shippingSettings);
    const shippingOptions = enabledShippingMethods(shippingSettings).flatMap((method) => {
      if (
        typeof method.id !== 'string' ||
        typeof method.label !== 'string' ||
        typeof method.cost !== 'number' ||
        typeof method.estimatedDays !== 'number'
      ) return [];
      const cost = subtotal.gte(Money.fromMajor(threshold, subtotal.currency)) && freeMethods.includes(method.id)
        ? Money.zero(subtotal.currency)
        : Money.fromMajor(method.cost, subtotal.currency);
      return [{
        id: method.id,
        name: method.label,
        estimated_days: `${method.estimatedDays} business day${method.estimatedDays === 1 ? '' : 's'}`,
        price: toWireMoney(cost.toJSON()),
      }];
    });

    if (shippingOptions.length === 0) {
      return failure(sessionId, agentId, startTime, 'NO_SHIPPING_METHODS', 'No shipping methods are enabled');
    }

    return {
      success: true,
      data: {
        shipping_options: shippingOptions,
        default_option: shippingOptions[0].id,
        restrictions: [],
      },
      context: {
        session_id: sessionId,
        agent_id: agentId,
        processing_time_ms: Date.now() - startTime,
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: ['Select a shipping method', 'Create the PaymentIntent'],
      },
    };
  } catch (error) {
    console.error('[mcp] Shipping option calculation failed:', error);
    return failure(sessionId, agentId, startTime, 'SHIPPING_UNAVAILABLE', 'Unable to calculate shipping options');
  }
}

function failure(
  sessionId: string,
  agentId: string,
  startTime: number,
  code: string,
  message: string,
): MCPToolResponse<ShippingResponse> {
  return {
    success: false,
    data: { shipping_options: [], default_option: '', restrictions: [message] },
    context: {
      session_id: sessionId,
      agent_id: agentId,
      processing_time_ms: Date.now() - startTime,
    },
    error: { code, message },
    metadata: {
      can_fulfill_percentage: 0,
      estimated_satisfaction: 0,
      next_actions: ['Verify the shipping address and configured methods'],
    },
  };
}
