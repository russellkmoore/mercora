import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../../lib/mcp/context';
import { validatePayment } from '../../../../../../lib/mcp/tools/payment';

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
    const agentContext = parseAgentContext(request, auth.agentId);
    
    if (!body.payment_method) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'payment_method is required'
        }
      }, { status: 400 });
    }
    
    const sessionId = body.session_id || 'temp';
    const paymentRequest = {
      payment_method: body.payment_method,
      billing_address: body.billing_address,
      agent_context: agentContext || undefined
    };

    const result = await validatePayment(paymentRequest, sessionId, auth.agentId!);
    
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
