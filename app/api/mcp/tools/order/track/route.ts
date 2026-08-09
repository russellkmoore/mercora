import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { getOrderStatus } from '../../../../../../lib/mcp/tools/order';
import {
  parseMcpOrderId,
  readMcpOrderLookup,
} from '../../../../../../lib/mcp/order-lookup';
import type { MCPToolResponse, MCPTrackingEvent } from '../../../../../../lib/mcp/types';

interface TrackingResponse {
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  carrierLabel?: string;
  trackingUrl?: string;
  status: string;
  estimatedDelivery: string;
  history: MCPTrackingEvent[];
}

async function projectOwnedOrder(
  orderId: string,
  agentId: string,
): Promise<NextResponse> {
  try {
    const result = await getOrderStatus(orderId, agentId);
    if (!result.success) return NextResponse.json(result, { status: 404 });

    const shipment = result.data.shipment;

    const response: MCPToolResponse<TrackingResponse> = {
      success: true,
      data: {
        orderId: result.data.orderId,
        trackingNumber: shipment?.tracking_number ?? result.data.tracking_number,
        ...(shipment?.carrier ? { carrier: shipment.carrier } : {}),
        ...(shipment?.carrier_label ? { carrierLabel: shipment.carrier_label } : {}),
        ...(shipment?.tracking_url ? { trackingUrl: shipment.tracking_url } : {}),
        status: result.data.status,
        estimatedDelivery: result.data.estimated_delivery,
        history: result.data.tracking_history ?? [],
      },
      context: result.context,
      metadata: {
        ...result.metadata,
        next_actions: shipment?.tracking_url
          ? ['Open the configured carrier tracking link']
          : ['Check back after the order ships'],
      },
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ORDER_TRACKING_ERROR',
        message: 'Failed to get order tracking',
      },
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const parsed = parseMcpOrderId(request.nextUrl.searchParams.get('orderId'));
  if (!parsed.ok) {
    return NextResponse.json({
      success: false,
      error: {
        code: parsed.code,
        message: parsed.message,
      },
    }, { status: parsed.status });
  }
  return projectOwnedOrder(parsed.orderId, auth.agentId!);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const parsed = await readMcpOrderLookup(request);
  if (!parsed.ok) {
    return NextResponse.json({
      success: false,
      error: { code: parsed.code, message: parsed.message },
    }, { status: parsed.status });
  }
  return projectOwnedOrder(parsed.orderId, auth.agentId!);
}
