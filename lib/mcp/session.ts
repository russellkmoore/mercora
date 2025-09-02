import { getDbAsync } from '../db';
import { mcpSessions } from '../db/schema/mcp';
import { eq, and, lt, gte } from 'drizzle-orm';
import { AgentSession, AgentContext } from './types';
import { CartItem } from '../types/core';
import { createAgentSessionId } from './context';

export async function createSession(agentId: string, agentContext?: AgentContext): Promise<AgentSession> {
  const sessionId = createAgentSessionId(agentId);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const session: AgentSession = {
    sessionId,
    agentId,
    userContext: agentContext || { agentId },
    cart: [],
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString()
  };

  const db = await getDbAsync();
  await db.insert(mcpSessions).values({
    sessionId: session.sessionId,
    agentId: session.agentId,
    userId: session.userContext.userId,
    userPreferences: JSON.stringify(session.userContext.userPreferences || {}),
    sessionContext: session.userContext.session_context,
    cart: JSON.stringify(session.cart),
    expiresAt: session.expires_at
  });

  return session;
}

export async function getSession(sessionId: string): Promise<AgentSession | null> {
  try {
    const db = await getDbAsync();
    const sessions = await db.select()
      .from(mcpSessions)
      .where(eq(mcpSessions.sessionId, sessionId))
      .limit(1);

    if (sessions.length === 0) {
      return null;
    }

    const sessionData = sessions[0];

    // Check if session is expired
    if (new Date(sessionData.expiresAt) < new Date()) {
      await deleteSession(sessionId);
      return null;
    }

    return {
      sessionId: sessionData.sessionId,
      agentId: sessionData.agentId,
      userContext: {
        agentId: sessionData.agentId,
        userId: sessionData.userId || undefined,
        userPreferences: sessionData.userPreferences ? JSON.parse(sessionData.userPreferences) : undefined,
        session_context: sessionData.sessionContext || undefined
      },
      cart: sessionData.cart ? JSON.parse(sessionData.cart) : [],
      created_at: sessionData.createdAt!,
      expires_at: sessionData.expiresAt
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

export async function updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<boolean> {
  try {
    const db = await getDbAsync();
    const updateData: any = {};

    if (updates.userContext) {
      updateData.userId = updates.userContext.userId;
      updateData.userPreferences = JSON.stringify(updates.userContext.userPreferences || {});
      updateData.sessionContext = updates.userContext.session_context;
    }

    if (updates.cart) {
      updateData.cart = JSON.stringify(updates.cart);
    }

    updateData.lastActivity = new Date().toISOString();

    await db.update(mcpSessions)
      .set(updateData)
      .where(eq(mcpSessions.sessionId, sessionId));

    return true;
  } catch (error) {
    console.error('Failed to update session:', error);
    return false;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const db = await getDbAsync();
    await db.delete(mcpSessions)
      .where(eq(mcpSessions.sessionId, sessionId));
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const db = await getDbAsync();
    const result = await db.delete(mcpSessions)
      .where(lt(mcpSessions.expiresAt, new Date().toISOString()));
    
    return result.changes || 0;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

export async function getSessionCart(sessionId: string): Promise<CartItem[]> {
  const session = await getSession(sessionId);
  return session?.cart || [];
}

export async function updateSessionCart(sessionId: string, cart: CartItem[]): Promise<boolean> {
  return updateSession(sessionId, { cart });
}

export async function getActiveSessionsForAgent(agentId: string): Promise<AgentSession[]> {
  try {
    const db = await getDbAsync();
    const sessions = await db.select()
      .from(mcpSessions)
      .where(and(
        eq(mcpSessions.agentId, agentId),
        gte(mcpSessions.expiresAt, new Date().toISOString())
      ));

    return sessions.map(sessionData => ({
      sessionId: sessionData.sessionId,
      agentId: sessionData.agentId,
      userContext: {
        agentId: sessionData.agentId,
        userId: sessionData.userId || undefined,
        userPreferences: sessionData.userPreferences ? JSON.parse(sessionData.userPreferences) : undefined,
        session_context: sessionData.sessionContext || undefined
      },
      cart: sessionData.cart ? JSON.parse(sessionData.cart) : [],
      created_at: sessionData.createdAt!,
      expires_at: sessionData.expiresAt
    }));
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    return [];
  }
}