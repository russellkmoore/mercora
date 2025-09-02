import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, deleteSession } from '../../../../../lib/mcp/session';
import { authenticateAgent } from '../../../../../lib/mcp/auth';
import { MCPToolResponse, AgentSession } from '../../../../../lib/mcp/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Get specific session
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired'
        }
      }, { status: 404 });
    }

    // Verify agent owns this session
    if (session.agentId !== auth.agentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Agent does not own this session'
        }
      }, { status: 403 });
    }

    const response: MCPToolResponse<AgentSession> = {
      success: true,
      data: session,
      context: {
        session_id: sessionId,
        agent_id: auth.agentId!,
        processing_time_ms: 0
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: session.cart.length > 0 ? ['Review cart', 'Proceed to checkout'] : ['Search products', 'Add items to cart']
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SESSION_GET_ERROR',
        message: 'Failed to get session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Update session
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired'
        }
      }, { status: 404 });
    }

    // Verify agent owns this session
    if (session.agentId !== auth.agentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Agent does not own this session'
        }
      }, { status: 403 });
    }

    const updateData = await request.json();
    const success = await updateSession(sessionId, updateData);
    
    if (!success) {
      throw new Error('Failed to update session');
    }

    const updatedSession = await getSession(sessionId);
    
    const response: MCPToolResponse<AgentSession> = {
      success: true,
      data: updatedSession!,
      context: {
        session_id: sessionId,
        agent_id: auth.agentId!,
        processing_time_ms: 0
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: ['Continue shopping', 'Review updated session']
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SESSION_UPDATE_ERROR',
        message: 'Failed to update session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Delete session
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired'
        }
      }, { status: 404 });
    }

    // Verify agent owns this session
    if (session.agentId !== auth.agentId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Agent does not own this session'
        }
      }, { status: 403 });
    }

    const success = await deleteSession(sessionId);
    
    if (!success) {
      throw new Error('Failed to delete session');
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SESSION_DELETE_ERROR',
        message: 'Failed to delete session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}