import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, hasAgentManagementPermission } from '../../../../../../lib/mcp/auth';
import { createAgent } from '../../../../../../lib/mcp/tools/agent';

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  if (!hasAgentManagementPermission(auth.permissions)) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Agent management requires admin or agents:manage permission',
      },
    }, { status: 403 });
  }

  try {
    const body = await request.json() as any;
    
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
      rateLimitOph: body.rateLimitOph,
      apiKeyTtlDays: body.apiKeyTtlDays,
    };

    const sessionId = body.session_id || 'temp';
    const result = await createAgent(createRequest, sessionId, auth.agentId!, auth.permissions);
    
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
