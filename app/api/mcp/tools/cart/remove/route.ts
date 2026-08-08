import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, hasPermission, requiredScopeForTool } from '../../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../../lib/mcp/context';
import { removeFromCart } from '../../../../../../lib/mcp/tools/cart';
import { CartRequest } from '../../../../../../lib/mcp/types';

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  const requiredScope = requiredScopeForTool('remove_from_cart')!;
  if (!hasPermission(auth.permissions, requiredScope)) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'This tool requires write:cart permission' } }, { status: 403 });
  }

  try {
    const body = await request.json() as any;
    const agentContext = parseAgentContext(request, auth.agentId);
    
    const cartRequest: CartRequest & { sessionId: string } = {
      ...body,
      agent_context: agentContext || undefined
    };

    const sessionId = body.session_id || 'temp';
    const result = await removeFromCart(cartRequest, sessionId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CART_REMOVE_ERROR',
        message: 'Failed to remove cart item',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}
