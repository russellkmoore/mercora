import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../lib/mcp/context';
import { assessFulfillmentCapability } from '../../../../../lib/mcp/tools/assess';
import { AssessRequest } from '../../../../../lib/mcp/types';

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
    
    const assessRequest: AssessRequest = {
      ...body,
      agent_context: agentContext || undefined
    };

    const sessionId = body.session_id || 'temp';
    const result = await assessFulfillmentCapability(assessRequest, sessionId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'ASSESS_ERROR',
        message: 'Fulfillment assessment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}