import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, hasAgentManagementPermission } from '../../../../../../lib/mcp/auth';
import { getAgentDetails, rotateAgentCredential, updateAgentStatus } from '../../../../../../lib/mcp/tools/agent';

const forbiddenResponse = {
  success: false,
  error: {
    code: 'FORBIDDEN',
    message: 'Agent management requires admin or agents:manage permission',
  },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  if (!hasAgentManagementPermission(auth.permissions)) {
    return NextResponse.json(forbiddenResponse, { status: 403 });
  }

  try {
    const { agentId } = await params;
    const { searchParams } = request.nextUrl;
    const sessionId = searchParams.get('session_id') || 'temp';
    
    const result = await getAgentDetails(agentId, sessionId, auth.agentId!);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENT_DETAILS_ERROR',
        message: 'Failed to get agent details',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  if (!hasAgentManagementPermission(auth.permissions)) {
    return NextResponse.json(forbiddenResponse, { status: 403 });
  }

  try {
    const { agentId } = await params;
    const body = await request.json() as any;
    
    const sessionId = body.session_id || 'temp';

    if (body.rotateApiKey === true) {
      const result = await rotateAgentCredential(
        agentId,
        body.apiKeyTtlDays,
        sessionId,
        auth.agentId!,
        auth.permissions,
      );
      return NextResponse.json(result);
    }

    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'isActive boolean or rotateApiKey=true is required'
        }
      }, { status: 400 });
    }
    
    const result = await updateAgentStatus(
      agentId,
      body.isActive,
      sessionId,
      auth.agentId!,
      auth.permissions,
    );
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENT_UPDATE_ERROR',
        message: 'Failed to update agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}
