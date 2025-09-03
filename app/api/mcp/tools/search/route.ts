import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../lib/mcp/context';
import { searchProductsWithContext } from '../../../../../lib/mcp/tools/search';
import { SearchRequest } from '../../../../../lib/mcp/types';

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
    
    const searchRequest: SearchRequest = {
      ...body,
      agent_context: agentContext || undefined
    };

    const sessionId = body.session_id || 'temp';
    const result = await searchProductsWithContext(searchRequest, sessionId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Product search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}