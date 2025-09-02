import { NextRequest } from 'next/server';
import { getDbAsync } from '../db';
import { mcpAgents, mcpRateLimits } from '../db/schema/mcp';
import { eq, and, gte, sql } from 'drizzle-orm';
import { MCPError } from './types';
import { AuthenticationError, RateLimitError, DatabaseError } from './error-handler';

export interface AgentAuthResult {
  success: boolean;
  agentId?: string;
  error?: MCPError['error'];
}

export async function authenticateAgent(request: NextRequest): Promise<AgentAuthResult> {
  const apiKey = request.headers.get('X-Agent-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '') ||
                 request.nextUrl.searchParams.get('api_key');

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'Agent API key required in X-Agent-API-Key header, Authorization header, or api_key query parameter'
      }
    };
  }

  try {
    const db = await getDbAsync();
    const agent = await db.select()
      .from(mcpAgents)
      .where(and(
        eq(mcpAgents.apiKey, apiKey),
        eq(mcpAgents.isActive, true)
      ))
      .limit(1);

    if (agent.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid or inactive agent API key'
        }
      };
    }

    const agentData = agent[0];

    // Check rate limits
    const rateLimitCheck = await checkRateLimit(agentData.agentId, agentData.rateLimitRpm, agentData.rateLimitOph);
    if (!rateLimitCheck.success) {
      return rateLimitCheck;
    }

    // Update last used timestamp
    await db.update(mcpAgents)
      .set({ lastUsed: new Date().toISOString() })
      .where(eq(mcpAgents.agentId, agentData.agentId));

    return {
      success: true,
      agentId: agentData.agentId
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

async function checkRateLimit(agentId: string, rpmLimit: number, ophLimit: number): Promise<AgentAuthResult> {
  const now = new Date();
  const minuteStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  try {
    const db = await getDbAsync();
    
    // Check minute rate limit
    const minuteUsage = await db.select()
      .from(mcpRateLimits)
      .where(and(
        eq(mcpRateLimits.agentId, agentId),
        eq(mcpRateLimits.window, 'minute'),
        gte(mcpRateLimits.windowStart, minuteStart.toISOString())
      ))
      .limit(1);

    if (minuteUsage.length > 0 && minuteUsage[0].count >= rpmLimit) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${rpmLimit} requests per minute`
        }
      };
    }

    // Check hour rate limit for orders (if this is an order endpoint)
    const hourUsage = await db.select()
      .from(mcpRateLimits)
      .where(and(
        eq(mcpRateLimits.agentId, agentId),
        eq(mcpRateLimits.window, 'hour'),
        gte(mcpRateLimits.windowStart, hourStart.toISOString())
      ))
      .limit(1);

    if (hourUsage.length > 0 && hourUsage[0].count >= ophLimit) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${ophLimit} operations per hour`
        }
      };
    }

    // Update rate limit counters
    await updateRateLimit(agentId, 'minute', minuteStart.toISOString());
    
    return { success: true, agentId };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMIT_ERROR',
        message: 'Failed to check rate limits',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

async function updateRateLimit(agentId: string, window: string, windowStart: string): Promise<void> {
  const db = await getDbAsync();
  
  // Upsert rate limit record
  await db.insert(mcpRateLimits)
    .values({
      agentId,
      window,
      count: 1,
      windowStart
    })
    .onConflictDoUpdate({
      target: [mcpRateLimits.agentId, mcpRateLimits.window],
      set: {
        count: sql`count + 1`,
        windowStart: windowStart
      },
      where: eq(mcpRateLimits.windowStart, windowStart)
    });
}

export async function createAgent(agentData: {
  agentId: string;
  name: string;
  description?: string;
  permissions?: string[];
  rateLimitRpm?: number;
  rateLimitOph?: number;
}): Promise<{ apiKey: string }> {
  const db = await getDbAsync();
  const apiKey = generateApiKey();
  
  await db.insert(mcpAgents).values({
    agentId: agentData.agentId,
    name: agentData.name,
    description: agentData.description,
    apiKey,
    permissions: JSON.stringify(agentData.permissions || []),
    rateLimitRpm: agentData.rateLimitRpm || 100,
    rateLimitOph: agentData.rateLimitOph || 10,
    isActive: true
  });

  return { apiKey };
}

function generateApiKey(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}