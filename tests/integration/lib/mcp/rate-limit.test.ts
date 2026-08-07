import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@/lib/db/schema';
import { checkRateLimit, getRateLimitWindowStarts, updateRateLimit } from '@/lib/mcp/auth';
import { applyTestMigrations } from '../../helpers/d1';

beforeEach(async () => {
  await applyTestMigrations();
});

async function rateRow(agentId: string, window: string) {
  return env.DB.prepare(`
    SELECT count, window_start FROM mcp_rate_limits
    WHERE agent_id = ? AND window = ?
  `).bind(agentId, window).first<{ count: number; window_start: string }>();
}

describe('MCP rate limits on real D1', () => {
  it('does not consume the hourly order allowance for non-order tools', async () => {
    const database = drizzle(env.DB, { schema });
    for (let count = 0; count < 6; count += 1) {
      expect((await checkRateLimit('reader', 100, 2, false, database)).success).toBe(true);
    }
    expect(await rateRow('reader', 'hour')).toBeNull();
  });

  it('blocks the first order operation above the hourly allowance', async () => {
    const database = drizzle(env.DB, { schema });
    expect((await checkRateLimit('buyer', 100, 2, true, database)).success).toBe(true);
    expect((await checkRateLimit('buyer', 100, 2, true, database)).success).toBe(true);
    const blocked = await checkRateLimit('buyer', 100, 2, true, database);
    expect(blocked.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    expect((await rateRow('buyer', 'hour'))?.count).toBe(2);
  });

  it('enforces the minute allowance for every tool', async () => {
    const database = drizzle(env.DB, { schema });
    expect((await checkRateLimit('minute', 1, 100, false, database)).success).toBe(true);
    expect((await checkRateLimit('minute', 1, 100, false, database)).error?.code)
      .toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets a stale counter when its window advances', async () => {
    const database = drizzle(env.DB, { schema });
    await env.DB.prepare(`
      INSERT INTO mcp_rate_limits (agent_id, window, count, window_start)
      VALUES (?, 'hour', 99, ?)
    `).bind('rollover', '2000-01-01T00:00:00.000Z').run();
    const { hourStart } = getRateLimitWindowStarts();
    await updateRateLimit('rollover', 'hour', hourStart, database);
    const row = await rateRow('rollover', 'hour');
    expect(row).toEqual({ count: 1, window_start: hourStart });
  });
});
