import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { listAgents } from '../../../../../../lib/mcp/tools/agent';

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sessionId = searchParams.get('session_id') || 'temp';
    
    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'page must be >= 1'
        }
      }, { status: 400 });
    }
    
    if (limit < 1 || limit > 100) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'limit must be between 1 and 100'
        }
      }, { status: 400 });
    }
    
    const result = await listAgents(page, limit, sessionId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENT_LIST_ERROR',
        message: 'Failed to list agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}