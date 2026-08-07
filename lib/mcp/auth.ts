import { NextRequest } from 'next/server';
import { and, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { sha256Hex } from '../auth/crypto';
import { getDbAsync } from '../db';
import { mcpAgents, mcpRateLimits } from '../db/schema/mcp';
import { MCPError } from './types';

const AGENT_MANAGEMENT_PERMISSIONS = ['admin', '*', 'agents:manage'];
const SUPERUSER_PERMISSIONS = ['admin', '*'];
const DEFAULT_KEY_TTL_DAYS = 90;
const LEGACY_KEY_GRACE_DAYS = 30;

export const COMMERCE_SCOPES = {
  WRITE_CART: 'write:cart',
  PLACE_ORDERS: 'place:orders',
} as const;

export const COMMERCE_TOOL_SCOPES: Record<string, string> = {
  add_to_cart: COMMERCE_SCOPES.WRITE_CART,
  update_cart: COMMERCE_SCOPES.WRITE_CART,
  remove_from_cart: COMMERCE_SCOPES.WRITE_CART,
  bulk_add_to_cart: COMMERCE_SCOPES.WRITE_CART,
  clear_cart: COMMERCE_SCOPES.WRITE_CART,
  place_order: COMMERCE_SCOPES.PLACE_ORDERS,
  create_payment_intent: COMMERCE_SCOPES.PLACE_ORDERS,
};

export interface AgentAuthResult {
  success: boolean;
  agentId?: string;
  permissions?: string[];
  error?: MCPError['error'];
}

export type McpDatabase = Awaited<ReturnType<typeof getDbAsync>>;

export function hasAgentManagementPermission(permissions: string[] | undefined): boolean {
  return permissions?.some((permission) => AGENT_MANAGEMENT_PERMISSIONS.includes(permission)) ?? false;
}

export function hasPermission(permissions: string[] | undefined, required: string): boolean {
  return permissions?.some(
    (permission) => permission === required || SUPERUSER_PERMISSIONS.includes(permission),
  ) ?? false;
}

export function requiredScopeForTool(toolName: string): string | undefined {
  return COMMERCE_TOOL_SCOPES[toolName];
}

export function extractAgentApiKey(request: NextRequest): string | null {
  const directKey = request.headers.get('X-Agent-API-Key')?.trim();
  if (directKey) return directKey;

  const authorization = request.headers.get('Authorization')?.trim();
  const bearer = authorization?.match(/^Bearer\s+(\S+)$/i);
  return bearer?.[1] ?? null;
}

function parsePermissions(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((permission): permission is string => typeof permission === 'string')
      : [];
  } catch {
    return [];
  }
}

function expiryFromNow(days: number): string {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt.toISOString();
}

function normalizeTtlDays(days: number | undefined): number {
  if (days === undefined) return DEFAULT_KEY_TTL_DAYS;
  if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
    throw new Error('API key lifetime must be an integer between 1 and 365 days');
  }
  return days;
}

function retiredLegacyValue(agentId: string): string {
  return `retired:${agentId}:${crypto.randomUUID()}`;
}

export async function authenticateAgent(
  request: NextRequest,
  opts: { isOrderOp?: boolean; database?: McpDatabase } = {},
): Promise<AgentAuthResult> {
  const apiKey = extractAgentApiKey(request);

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'Agent API key required in X-Agent-API-Key or Authorization header',
      },
    };
  }

  try {
    const db = opts.database ?? await getDbAsync();
    const apiKeyHash = await sha256Hex(apiKey);
    const agents = await db.select()
      .from(mcpAgents)
      .where(and(
        eq(mcpAgents.isActive, true),
        or(
          eq(mcpAgents.apiKeyHash, apiKeyHash),
          and(
            isNull(mcpAgents.apiKeyHash),
            eq(mcpAgents.legacyApiKey, apiKey),
          ),
        ),
      ))
      .limit(1);

    const agent = agents[0];
    if (!agent) {
      return {
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid or inactive agent API key' },
      };
    }

    const now = new Date();
    const expiresAt = agent.apiKeyExpiresAt ? new Date(agent.apiKeyExpiresAt) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now)) {
      return {
        success: false,
        error: { code: 'API_KEY_EXPIRED', message: 'Agent API key has expired' },
      };
    }

    // Transitional dual-read: a successful legacy authentication upgrades the
    // row in place, retires the plaintext value, and grants a bounded rotation
    // window. The conditional update makes concurrent upgrades converge.
    if (!agent.apiKeyHash && agent.legacyApiKey === apiKey) {
      await db.update(mcpAgents)
        .set({
          apiKeyHash,
          legacyApiKey: retiredLegacyValue(agent.agentId),
          apiKeyExpiresAt: agent.apiKeyExpiresAt || expiryFromNow(LEGACY_KEY_GRACE_DAYS),
          credentialVersion: 2,
        })
        .where(and(
          eq(mcpAgents.agentId, agent.agentId),
          isNull(mcpAgents.apiKeyHash),
          eq(mcpAgents.legacyApiKey, apiKey),
        ));
    }

    const rateLimit = await checkRateLimit(
      agent.agentId,
      agent.rateLimitRpm ?? 100,
      agent.rateLimitOph ?? 10,
      opts.isOrderOp ?? false,
      db,
    );
    if (!rateLimit.success) return rateLimit;

    await db.update(mcpAgents)
      .set({ lastUsed: now.toISOString() })
      .where(eq(mcpAgents.agentId, agent.agentId));

    return {
      success: true,
      agentId: agent.agentId,
      permissions: parsePermissions(agent.permissions),
    };
  } catch (error) {
    console.error('MCP authentication failed', error);
    return {
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' },
    };
  }
}

export function getRateLimitWindowStarts(now: Date = new Date()): {
  minuteStart: string;
  hourStart: string;
} {
  const minuteStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
  );
  const hourStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
  );
  return { minuteStart: minuteStart.toISOString(), hourStart: hourStart.toISOString() };
}

export async function checkRateLimit(
  agentId: string,
  rpmLimit: number,
  ophLimit: number,
  isOrderOp = false,
  database?: McpDatabase,
): Promise<AgentAuthResult> {
  const { minuteStart, hourStart } = getRateLimitWindowStarts();

  try {
    const db = database ?? await getDbAsync();
    const minuteUsage = await db.select()
      .from(mcpRateLimits)
      .where(and(
        eq(mcpRateLimits.agentId, agentId),
        eq(mcpRateLimits.window, 'minute'),
        gte(mcpRateLimits.windowStart, minuteStart),
      ))
      .limit(1);

    if ((minuteUsage[0]?.count || 0) >= rpmLimit) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded: ${rpmLimit} requests per minute`,
        },
      };
    }

    if (isOrderOp) {
      const hourUsage = await db.select()
        .from(mcpRateLimits)
        .where(and(
          eq(mcpRateLimits.agentId, agentId),
          eq(mcpRateLimits.window, 'hour'),
          gte(mcpRateLimits.windowStart, hourStart),
        ))
        .limit(1);

      if ((hourUsage[0]?.count || 0) >= ophLimit) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded: ${ophLimit} operations per hour`,
          },
        };
      }
    }

    if (isOrderOp) {
      await db.batch([
        buildRateLimitUpsert(db, agentId, 'minute', minuteStart),
        buildRateLimitUpsert(db, agentId, 'hour', hourStart),
      ]);
    } else {
      await db.batch([buildRateLimitUpsert(db, agentId, 'minute', minuteStart)]);
    }

    return { success: true, agentId };
  } catch (error) {
    console.error('MCP rate-limit check failed', error);
    return {
      success: false,
      error: { code: 'RATE_LIMIT_ERROR', message: 'Failed to check rate limits' },
    };
  }
}

function buildRateLimitUpsert(
  db: Awaited<ReturnType<typeof getDbAsync>>,
  agentId: string,
  window: string,
  windowStart: string,
) {
  return db.insert(mcpRateLimits)
    .values({ agentId, window, count: 1, windowStart })
    .onConflictDoUpdate({
      target: [mcpRateLimits.agentId, mcpRateLimits.window],
      set: {
        count: sql`CASE WHEN ${mcpRateLimits.windowStart} = ${windowStart} THEN ${mcpRateLimits.count} + 1 ELSE 1 END`,
        windowStart,
      },
    });
}

export async function updateRateLimit(
  agentId: string,
  window: string,
  windowStart: string,
  database?: McpDatabase,
): Promise<void> {
  const db = database ?? await getDbAsync();
  await buildRateLimitUpsert(db, agentId, window, windowStart);
}

export interface CreateAgentCredentialInput {
  agentId: string;
  name: string;
  description?: string;
  permissions?: string[];
  rateLimitRpm?: number;
  rateLimitOph?: number;
  apiKeyTtlDays?: number;
}

export interface IssuedAgentCredential {
  apiKey: string;
  expiresAt: string;
}

export async function createAgent(
  agentData: CreateAgentCredentialInput,
): Promise<IssuedAgentCredential> {
  const db = await getDbAsync();
  const apiKey = generateApiKey();
  const apiKeyHash = await sha256Hex(apiKey);
  const expiresAt = expiryFromNow(normalizeTtlDays(agentData.apiKeyTtlDays));

  await db.insert(mcpAgents).values({
    agentId: agentData.agentId,
    name: agentData.name,
    description: agentData.description,
    legacyApiKey: retiredLegacyValue(agentData.agentId),
    apiKeyHash,
    apiKeyExpiresAt: expiresAt,
    credentialVersion: 2,
    permissions: JSON.stringify(agentData.permissions || []),
    rateLimitRpm: agentData.rateLimitRpm ?? 100,
    rateLimitOph: agentData.rateLimitOph ?? 10,
    isActive: true,
  });

  return { apiKey, expiresAt };
}

export async function rotateAgentApiKey(
  agentId: string,
  apiKeyTtlDays?: number,
): Promise<IssuedAgentCredential> {
  const db = await getDbAsync();
  const apiKey = generateApiKey();
  const apiKeyHash = await sha256Hex(apiKey);
  const expiresAt = expiryFromNow(normalizeTtlDays(apiKeyTtlDays));

  const updated = await db.update(mcpAgents)
    .set({
      legacyApiKey: retiredLegacyValue(agentId),
      apiKeyHash,
      apiKeyExpiresAt: expiresAt,
      credentialVersion: sql`${mcpAgents.credentialVersion} + 1`,
    })
    .where(eq(mcpAgents.agentId, agentId))
    .returning({ agentId: mcpAgents.agentId });

  if (updated.length === 0) throw new Error('Agent not found');
  return { apiKey, expiresAt };
}

export function generateApiKey(): string {
  return `mcp_${crypto.randomUUID().replace(/-/g, '')}`;
}
