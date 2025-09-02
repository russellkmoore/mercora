import { NextRequest, NextResponse } from 'next/server';
import { createSession, getActiveSessionsForAgent, cleanupExpiredSessions } from '../../../../lib/mcp/session';
import { authenticateAgent } from '../../../../lib/mcp/auth';
import { parseAgentContext } from '../../../../lib/mcp/context';
import { MCPToolResponse, AgentSession } from '../../../../lib/mcp/types';

export async function POST(request: NextRequest) {
  // Create new agent session
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const agentContext = parseAgentContext(request);
    const session = await createSession(auth.agentId!, agentContext || undefined);
    
    const response: MCPToolResponse<AgentSession> = {
      success: true,
      data: session,
      context: {
        session_id: session.sessionId,
        agent_id: auth.agentId!,
        processing_time_ms: 0
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 85,
        next_actions: ['Search for products', 'Get recommendations', 'Add items to cart']
      }
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SESSION_CREATE_ERROR',
        message: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Get active sessions for agent
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    // Clean up expired sessions first
    await cleanupExpiredSessions();
    
    const sessions = await getActiveSessionsForAgent(auth.agentId!);
    
    const response: MCPToolResponse<AgentSession[]> = {
      success: true,
      data: sessions,
      context: {
        session_id: 'list',
        agent_id: auth.agentId!,
        processing_time_ms: 0
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 100,
        next_actions: sessions.length > 0 ? ['Resume existing session', 'Create new session'] : ['Create new session']
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SESSION_LIST_ERROR',
        message: 'Failed to list sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}