import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../../lib/mcp/context';
import { validatePayment } from '../../../../../../lib/mcp/tools/payment';
import { getSessionCart } from '../../../../../../lib/mcp/session';

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const body = await request.json();
    const agentContext = parseAgentContext(request);
    
    if (!body.payment_method) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'payment_method is required'
        }
      }, { status: 400 });
    }
    
    if (!body.total_amount && body.total_amount !== 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'total_amount is required'
        }
      }, { status: 400 });
    }
    
    // Get cart from session if not provided
    const sessionId = body.session_id || 'temp';
    const cart = body.cart || await getSessionCart(sessionId);
    
    const paymentRequest = {
      payment_method: body.payment_method,
      billing_address: body.billing_address,
      cart,
      total_amount: body.total_amount,
      agent_context: agentContext || undefined
    };

    const result = await validatePayment(paymentRequest, sessionId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'PAYMENT_VALIDATION_ERROR',
        message: 'Failed to validate payment method',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}