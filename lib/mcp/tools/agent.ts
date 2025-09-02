import { getDbAsync } from '../../db';
import { mcpAgents, mcpSessions } from '../../db/schema/mcp';
import { eq, desc, count, and, gte } from 'drizzle-orm';
import { MCPToolResponse } from '../types';
import { createAgent as createAgentAuth } from '../auth';
import { AuthenticationError, ValidationError, ResourceNotFoundError, DatabaseError, createErrorResponse } from '../error-handler';

export interface AgentInfo {
  agentId: string;
  name: string;
  description?: string;
  permissions: string[];
  rateLimitRpm: number;
  rateLimitOph: number;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export interface AgentStats {
  totalRequests: number;
  activeSessions: number;
  lastActivity?: string;
  averageSessionDuration?: number;
}

export interface CreateAgentRequest {
  agentId: string;
  name: string;
  description?: string;
  permissions?: string[];
  rateLimitRpm?: number;
  rateLimitOph?: number;
}

export interface CreateAgentResponse {
  agent: AgentInfo;
  apiKey: string;
  setup_instructions: string[];
}

export interface ListAgentsResponse {
  agents: (AgentInfo & { stats?: AgentStats })[];
  total: number;
  page: number;
  limit: number;
}

export interface AgentDetailsResponse {
  agent: AgentInfo;
  stats: AgentStats;
  recent_sessions: Array<{
    sessionId: string;
    createdAt: string;
    expiresAt: string;
    itemsInCart: number;
  }>;
}

export async function createAgent(
  request: CreateAgentRequest,
  sessionId: string,
  adminAgentId: string
): Promise<MCPToolResponse<CreateAgentResponse>> {
  const startTime = Date.now();

  try {
    // Validate input
    if (!request.agentId || request.agentId.length < 3) {
      throw new ValidationError('agentId', 'Agent ID must be at least 3 characters long');
    }

    if (!request.name || request.name.length < 3) {
      throw new ValidationError('name', 'Agent name must be at least 3 characters long');
    }

    // Check if agent already exists
    const db = await getDbAsync();
    const existingAgent = await db.select()
      .from(mcpAgents)
      .where(eq(mcpAgents.agentId, request.agentId))
      .limit(1);

    if (existingAgent.length > 0) {
      throw new ValidationError('agentId', 'Agent ID already exists');
    }

    // Create the agent
    const { apiKey } = await createAgentAuth({
      agentId: request.agentId,
      name: request.name,
      description: request.description,
      permissions: request.permissions,
      rateLimitRpm: request.rateLimitRpm,
      rateLimitOph: request.rateLimitOph
    });

    // Get the created agent info
    const createdAgent = await db.select()
      .from(mcpAgents)
      .where(eq(mcpAgents.agentId, request.agentId))
      .limit(1);

    const agentData = createdAgent[0];
    const agent: AgentInfo = {
      agentId: agentData.agentId,
      name: agentData.name,
      description: agentData.description || undefined,
      permissions: JSON.parse(agentData.permissions || '[]'),
      rateLimitRpm: agentData.rateLimitRpm,
      rateLimitOph: agentData.rateLimitOph,
      isActive: agentData.isActive,
      createdAt: agentData.createdAt,
      lastUsed: agentData.lastUsed || undefined
    };

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        agent,
        apiKey,
        setup_instructions: [
          'Store the API key securely - it will not be shown again',
          'Include the API key in X-Agent-API-Key header for all requests',
          'Test authentication with GET /api/mcp to verify setup',
          'Review rate limits and adjust request frequency accordingly'
        ]
      },
      context: {
        session_id: sessionId,
        agent_id: adminAgentId,
        processing_time_ms: processingTime
      },
      recommendations: {
        cost_optimization: [`Agent created with ${agent.rateLimitRpm} RPM limit - monitor usage to optimize`],
        bundling_opportunities: ['Consider creating multiple agents for different use cases or clients']
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 95,
        next_actions: ['Test agent authentication', 'Configure agent permissions', 'Begin using MCP tools']
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof ValidationError) {
      return createErrorResponse(error, sessionId, adminAgentId, processingTime, {
        agent: {} as AgentInfo,
        apiKey: '',
        setup_instructions: []
      });
    }

    return createErrorResponse(
      error instanceof Error ? error : new Error('Failed to create agent'),
      sessionId,
      adminAgentId,
      processingTime,
      {
        agent: {} as AgentInfo,
        apiKey: '',
        setup_instructions: []
      }
    );
  }
}

export async function listAgents(
  page: number = 1,
  limit: number = 20,
  sessionId: string,
  adminAgentId: string
): Promise<MCPToolResponse<ListAgentsResponse>> {
  const startTime = Date.now();

  try {
    const db = await getDbAsync();
    const offset = (page - 1) * limit;

    // Get agents with pagination
    const agents = await db.select()
      .from(mcpAgents)
      .orderBy(desc(mcpAgents.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(mcpAgents);
    const total = totalResult[0].count;

    // Get stats for each agent
    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const stats = await getAgentStats(agent.agentId);
        return {
          agentId: agent.agentId,
          name: agent.name,
          description: agent.description || undefined,
          permissions: JSON.parse(agent.permissions || '[]'),
          rateLimitRpm: agent.rateLimitRpm,
          rateLimitOph: agent.rateLimitOph,
          isActive: agent.isActive,
          createdAt: agent.createdAt,
          lastUsed: agent.lastUsed || undefined,
          stats
        };
      })
    );

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        agents: agentsWithStats,
        total,
        page,
        limit
      },
      context: {
        session_id: sessionId,
        agent_id: adminAgentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: total > limit ? ['View additional pages', 'Filter results'] : ['Create new agents', 'Review agent performance']
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return createErrorResponse(
      error instanceof Error ? error : new Error('Failed to list agents'),
      sessionId,
      adminAgentId,
      processingTime,
      {
        agents: [],
        total: 0,
        page,
        limit
      }
    );
  }
}

export async function getAgentDetails(
  agentId: string,
  sessionId: string,
  adminAgentId: string
): Promise<MCPToolResponse<AgentDetailsResponse>> {
  const startTime = Date.now();

  try {
    const db = await getDbAsync();
    
    // Get agent info
    const agentResult = await db.select()
      .from(mcpAgents)
      .where(eq(mcpAgents.agentId, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      throw new ResourceNotFoundError('Agent', agentId);
    }

    const agentData = agentResult[0];
    const agent: AgentInfo = {
      agentId: agentData.agentId,
      name: agentData.name,
      description: agentData.description || undefined,
      permissions: JSON.parse(agentData.permissions || '[]'),
      rateLimitRpm: agentData.rateLimitRpm,
      rateLimitOph: agentData.rateLimitOph,
      isActive: agentData.isActive,
      createdAt: agentData.createdAt,
      lastUsed: agentData.lastUsed || undefined
    };

    // Get detailed stats
    const stats = await getAgentStats(agentId);

    // Get recent sessions
    const recentSessions = await db.select({
      sessionId: mcpSessions.sessionId,
      createdAt: mcpSessions.createdAt,
      expiresAt: mcpSessions.expiresAt,
      cart: mcpSessions.cart
    })
      .from(mcpSessions)
      .where(eq(mcpSessions.agentId, agentId))
      .orderBy(desc(mcpSessions.createdAt))
      .limit(10);

    const sessionsWithItemCount = recentSessions.map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      itemsInCart: session.cart ? JSON.parse(session.cart).length : 0
    }));

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        agent,
        stats,
        recent_sessions: sessionsWithItemCount
      },
      context: {
        session_id: sessionId,
        agent_id: adminAgentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 95,
        next_actions: [
          'Review agent performance metrics',
          'Monitor recent session activity',
          agent.isActive ? 'Deactivate agent if needed' : 'Reactivate agent if needed'
        ]
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof ResourceNotFoundError) {
      return createErrorResponse(error, sessionId, adminAgentId, processingTime, {
        agent: {} as AgentInfo,
        stats: {} as AgentStats,
        recent_sessions: []
      });
    }

    return createErrorResponse(
      error instanceof Error ? error : new Error('Failed to get agent details'),
      sessionId,
      adminAgentId,
      processingTime,
      {
        agent: {} as AgentInfo,
        stats: {} as AgentStats,
        recent_sessions: []
      }
    );
  }
}

export async function updateAgentStatus(
  agentId: string,
  isActive: boolean,
  sessionId: string,
  adminAgentId: string
): Promise<MCPToolResponse<{ agent: AgentInfo; previous_status: boolean }>> {
  const startTime = Date.now();

  try {
    const db = await getDbAsync();
    
    // Check if agent exists and get current status
    const agentResult = await db.select()
      .from(mcpAgents)
      .where(eq(mcpAgents.agentId, agentId))
      .limit(1);

    if (agentResult.length === 0) {
      throw new ResourceNotFoundError('Agent', agentId);
    }

    const previousStatus = agentResult[0].isActive;

    // Update status
    await db.update(mcpAgents)
      .set({ isActive })
      .where(eq(mcpAgents.agentId, agentId));

    // Get updated agent info
    const updatedAgentResult = await db.select()
      .from(mcpAgents)
      .where(eq(mcpAgents.agentId, agentId))
      .limit(1);

    const agentData = updatedAgentResult[0];
    const agent: AgentInfo = {
      agentId: agentData.agentId,
      name: agentData.name,
      description: agentData.description || undefined,
      permissions: JSON.parse(agentData.permissions || '[]'),
      rateLimitRpm: agentData.rateLimitRpm,
      rateLimitOph: agentData.rateLimitOph,
      isActive: agentData.isActive,
      createdAt: agentData.createdAt,
      lastUsed: agentData.lastUsed || undefined
    };

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        agent,
        previous_status: previousStatus
      },
      context: {
        session_id: sessionId,
        agent_id: adminAgentId,
        processing_time_ms: processingTime
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 90,
        next_actions: [
          isActive ? 'Agent is now active and can make requests' : 'Agent is now inactive - requests will be rejected',
          'Monitor agent activity after status change'
        ]
      }
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return createErrorResponse(
      error instanceof Error ? error : new Error('Failed to update agent status'),
      sessionId,
      adminAgentId,
      processingTime,
      {
        agent: {} as AgentInfo,
        previous_status: false
      }
    );
  }
}

async function getAgentStats(agentId: string): Promise<AgentStats> {
  try {
    const db = await getDbAsync();
    
    // Get session count and recent activity
    const sessionStats = await db.select({
      count: count(),
      lastActivity: desc(mcpSessions.createdAt)
    })
      .from(mcpSessions)
      .where(eq(mcpSessions.agentId, agentId))
      .limit(1);

    // Get active sessions (not expired)
    const now = new Date().toISOString();
    const activeSessionStats = await db.select({ count: count() })
      .from(mcpSessions)
      .where(and(
        eq(mcpSessions.agentId, agentId),
        gte(mcpSessions.expiresAt, now)
      ));

    return {
      totalRequests: sessionStats[0]?.count || 0,
      activeSessions: activeSessionStats[0]?.count || 0,
      lastActivity: sessionStats[0]?.lastActivity || undefined
    };
  } catch (error) {
    return {
      totalRequests: 0,
      activeSessions: 0
    };
  }
}