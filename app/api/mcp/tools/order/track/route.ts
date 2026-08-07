import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { getOrderStatus } from '../../../../../../lib/mcp/tools/order';
import type { MCPToolResponse } from '../../../../../../lib/mcp/types';

interface TrackingResponse {
  orderId: string;
  trackingNumber?: string;
  status: string;
  estimatedDelivery: string;
  history: Array<never>;
}

async function projectOwnedOrder(
  orderId: string,
  agentId: string,
): Promise<NextResponse> {
  const result = await getOrderStatus(orderId, agentId);
  if (!result.success) return NextResponse.json(result, { status: 404 });

  const response: MCPToolResponse<TrackingResponse> = {
    success: true,
    data: {
      orderId: result.data.orderId,
      trackingNumber: result.data.tracking_number,
      status: result.data.status,
      estimatedDelivery: result.data.estimated_delivery,
      // Carrier events ship with the fulfillment vertical slice. An empty
      // history is truthful; generated locations and events are not.
      history: [],
    },
    context: result.context,
    metadata: {
      ...result.metadata,
      next_actions: result.data.tracking_number
        ? ['Use the configured carrier tracking experience']
        : ['Check back after the order ships'],
    },
  };
  return NextResponse.json(response);
}

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const orderId = request.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'MISSING_ORDER_ID',
        message: 'orderId is required; tracking-number lookup awaits the fulfillment data model',
      },
    }, { status: 400 });
  }
  return projectOwnedOrder(orderId, auth.agentId!);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' },
    }, { status: 400 });
  }
  const orderId = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).orderId
    : undefined;
  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'MISSING_ORDER_ID',
        message: 'orderId is required; tracking-number lookup awaits the fulfillment data model',
      },
    }, { status: 400 });
  }
  return projectOwnedOrder(orderId, auth.agentId!);
}
