import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { getOrderStatus } from '../../../../../../lib/mcp/tools/order';

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const orderId = request.nextUrl.searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'orderId parameter is required'
        }
      }, { status: 400 });
    }

    const result = await getOrderStatus(orderId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ORDER_STATUS_ERROR',
        message: 'Failed to get order status',
        details: error instanceof Error ? error.message : 'Unknown error'
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
    const body = await request.json() as any;
    const { orderId } = body;
    
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'orderId is required in request body'
        }
      }, { status: 400 });
    }

    const result = await getOrderStatus(orderId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ORDER_STATUS_ERROR',
        message: 'Failed to get order status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}