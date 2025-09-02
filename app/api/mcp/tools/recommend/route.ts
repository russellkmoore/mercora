import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../lib/mcp/context';
import { getRecommendations } from '../../../../../lib/mcp/tools/recommend';
import { RecommendRequest } from '../../../../../lib/mcp/types';

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
    
    const recommendRequest: RecommendRequest = {
      ...body,
      agent_context: agentContext || undefined
    };

    const sessionId = body.session_id || 'temp';
    const result = await getRecommendations(recommendRequest, sessionId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'RECOMMEND_ERROR',
        message: 'Product recommendations failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}