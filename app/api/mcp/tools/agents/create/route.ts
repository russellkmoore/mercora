import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../../../lib/mcp/context';
import { createAgent } from '../../../../../../lib/mcp/tools/agent';

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
    
    // Validate required fields
    if (!body.agentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'agentId is required'
        }
      }, { status: 400 });
    }
    
    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'name is required'
        }
      }, { status: 400 });
    }
    
    const createRequest = {
      agentId: body.agentId,
      name: body.name,
      description: body.description,
      permissions: body.permissions,
      rateLimitRpm: body.rateLimitRpm,
      rateLimitOph: body.rateLimitOph
    };

    const sessionId = body.session_id || 'temp';
    const result = await createAgent(createRequest, sessionId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENT_CREATE_ERROR',
        message: 'Failed to create agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}