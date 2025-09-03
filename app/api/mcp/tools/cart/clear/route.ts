import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { clearCart } from '../../../../../../lib/mcp/tools/cart';

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
    const sessionId = body.session_id || 'temp';
    
    const result = await clearCart(sessionId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CART_CLEAR_ERROR',
        message: 'Failed to clear cart',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}