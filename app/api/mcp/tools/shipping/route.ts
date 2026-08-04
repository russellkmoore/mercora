import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../lib/mcp/context';
import { getShippingOptions } from '../../../../../lib/mcp/tools/shipping';
import { getSessionCart } from '../../../../../lib/mcp/session';
import type { CartItem } from '../../../../../lib/types/cartitem';
import { Money } from '../../../../../lib/money';

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const agentContext = parseAgentContext(request);
    
    if (!body.address) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Shipping address is required'
        }
      }, { status: 400 });
    }
    
    // Get cart from session if not provided
    const sessionId = body.session_id || 'temp';
    const cart = body.cart ? parseWireCart(body.cart) : await getSessionCart(sessionId);
    
    const shippingRequest = {
      address: body.address,
      cart,
      agent_context: agentContext || undefined
    };

    const result = await getShippingOptions(shippingRequest, sessionId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SHIPPING_ERROR',
        message: 'Failed to get shipping options',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

function parseWireCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) throw new Error('cart must be an array');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('cart item must be an object');
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.productId !== 'string' || typeof candidate.variantId !== 'string' || typeof candidate.name !== 'string' ||
      typeof candidate.quantity !== 'number' || !Number.isSafeInteger(candidate.quantity) || candidate.quantity < 1 ||
      !candidate.price || typeof candidate.price !== 'object') {
      throw new Error('cart item is invalid');
    }
    const price = candidate.price as Record<string, unknown>;
    if (typeof price.amount !== 'number' || typeof price.currency !== 'string') throw new Error('cart item price is invalid');
    const money = 'precision' in price
      ? Money.fromMajor(price.amount, price.currency)
      : Money.fromStored(price, price.currency);
    return {
      productId: candidate.productId,
      variantId: candidate.variantId,
      name: candidate.name,
      quantity: candidate.quantity,
      primaryImageUrl: typeof candidate.primaryImageUrl === 'string' ? candidate.primaryImageUrl : '',
      price: money.toJSON(),
    };
  });
}
