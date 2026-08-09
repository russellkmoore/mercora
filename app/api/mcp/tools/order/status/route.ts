import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { getOrderStatus } from '../../../../../../lib/mcp/tools/order';
import {
  parseMcpOrderId,
  readMcpOrderLookup,
} from '../../../../../../lib/mcp/order-lookup';

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const parsed = parseMcpOrderId(request.nextUrl.searchParams.get('orderId'));
    if (!parsed.ok) {
      return NextResponse.json({
        success: false,
        error: {
          code: parsed.code,
          message: parsed.message
        }
      }, { status: parsed.status });
    }

    const result = await getOrderStatus(parsed.orderId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ORDER_STATUS_ERROR',
        message: 'Failed to get order status'
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Alternative POST method for order status lookup
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const parsed = await readMcpOrderLookup(request);
    if (!parsed.ok) {
      return NextResponse.json({
        success: false,
        error: {
          code: parsed.code,
          message: parsed.message
        }
      }, { status: parsed.status });
    }

    const result = await getOrderStatus(parsed.orderId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ORDER_STATUS_ERROR',
        message: 'Failed to get order status'
      }
    }, { status: 500 });
  }
}
