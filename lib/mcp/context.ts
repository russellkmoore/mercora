import { NextRequest } from 'next/server';
import { AgentContext } from './types';

export function parseAgentContext(
  request: NextRequest,
  authenticatedAgentId?: string,
): AgentContext | null {
  try {
    const contextHeader = request.headers.get('X-Agent-Context');
    if (!contextHeader) {
      return authenticatedAgentId ? { agentId: authenticatedAgentId } : null;
    }

    const context: AgentContext = JSON.parse(contextHeader);
    
    // Validate required fields
    if (!context.agentId || typeof context.agentId !== 'string') {
      throw new Error('agentId is required and must be a string');
    }

    // Validate optional fields
    if (context.userPreferences) {
      validateUserPreferences(context.userPreferences);
    }

    // Validate context size (max 1024 bytes)
    const contextSize = new TextEncoder().encode(contextHeader).length;
    if (contextSize > 1024) {
      throw new Error(`Agent context too large: ${contextSize} bytes (max 1024)`);
    }

    // X-Agent-Context is client-controlled. Authentication, not this header,
    // owns identity attribution.
    if (authenticatedAgentId) {
      context.agentId = authenticatedAgentId;
    }

    return context;
  } catch (error) {
    console.error('Failed to parse agent context:', error);
    return null;
  }
}

function validateUserPreferences(preferences: AgentContext['userPreferences']): void {
  if (!preferences) return;

  if (
    preferences.budget !== undefined &&
    (typeof preferences.budget !== 'number' || !Number.isFinite(preferences.budget) || preferences.budget < 0)
  ) {
    throw new Error('budget must be a non-negative finite number');
  }

  if (preferences.brands) {
    validateStringList(preferences.brands, 'brands');
  }

  if (preferences.activities) {
    validateStringList(preferences.activities, 'activities');
  }

  if (preferences.location && (typeof preferences.location !== 'string' || preferences.location.length > 256)) {
    throw new Error('location must be a string of at most 256 characters');
  }

  if (
    preferences.experience_level &&
    (typeof preferences.experience_level !== 'string' || preferences.experience_level.length > 64)
  ) {
    throw new Error('experience_level must be a string of at most 64 characters');
  }
}

function validateStringList(value: unknown, name: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((entry) => typeof entry !== 'string' || entry.length < 1 || entry.length > 128)
  ) {
    throw new Error(`${name} must contain at most 50 non-empty strings of at most 128 characters`);
  }
}

export function enhanceUserContext(agentContext: AgentContext | null, existingUserData?: any): any {
  if (!agentContext?.userPreferences) {
    return existingUserData || {};
  }

  return {
    ...existingUserData,
    budget: agentContext.userPreferences.budget,
    preferredBrands: agentContext.userPreferences.brands,
    activities: agentContext.userPreferences.activities,
    location: agentContext.userPreferences.location,
    experienceLevel: agentContext.userPreferences.experience_level,
    agentContext: agentContext.session_context
  };
}

export function createAgentSessionId(agentId: string): string {
  return `${agentId}_${crypto.randomUUID()}`;
}
