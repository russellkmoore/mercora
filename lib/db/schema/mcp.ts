import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const mcpSessions = sqliteTable('mcp_sessions', {
  sessionId: text('session_id').primaryKey(),
  agentId: text('agent_id').notNull(),
  userId: text('user_id'),
  userPreferences: text('user_preferences'), // JSON string
  sessionContext: text('session_context'),
  cart: text('cart'), // JSON string of CartItem[]
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at').notNull(),
  lastActivity: text('last_activity').default(sql`CURRENT_TIMESTAMP`),
});

export const mcpAgents = sqliteTable('mcp_agents', {
  agentId: text('agent_id').primaryKey(),
  name: text('name'),
  description: text('description'),
  apiKey: text('api_key').unique().notNull(),
  permissions: text('permissions'), // JSON string array
  rateLimitRpm: integer('rate_limit_rpm').default(100),
  rateLimitOph: integer('rate_limit_oph').default(10),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastUsed: text('last_used'),
});

export const mcpUsage = sqliteTable('mcp_usage', {
  id: integer('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  sessionId: text('session_id'),
  toolName: text('tool_name').notNull(),
  requestSize: integer('request_size'),
  responseSize: integer('response_size'),
  processingTimeMs: integer('processing_time_ms'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorCode: text('error_code'),
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`),
});

export const mcpRateLimits = sqliteTable('mcp_rate_limits', {
  agentId: text('agent_id').notNull(),
  window: text('window').notNull(), // 'minute' | 'hour' | 'day'
  count: integer('count').default(0),
  windowStart: text('window_start').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.agentId, table.window] }),
}));