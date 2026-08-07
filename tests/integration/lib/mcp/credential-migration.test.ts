import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { authenticateAgent } from '@/lib/mcp/auth';
import { sha256Hex } from '@/lib/auth/crypto';
import { applyTestMigrations } from '../../helpers/d1';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@/lib/db/schema';

beforeEach(async () => {
  await applyTestMigrations();
});

function request(apiKey: string): import('next/server').NextRequest {
  return new Request('https://mercora.test/api/mcp', {
    headers: { 'X-Agent-API-Key': apiKey },
  }) as import('next/server').NextRequest;
}

describe('MCP credential expansion on real D1', () => {
  it('removes the public migration-seeded credential', async () => {
    const seeded = await env.DB.prepare(
      'SELECT agent_id FROM mcp_agents WHERE agent_id = ?'
    ).bind('test-agent').first();
    expect(seeded).toBeNull();
  });

  it('upgrades a legacy plaintext row after successful authentication', async () => {
    await env.DB.prepare(`
      INSERT INTO mcp_agents (
        agent_id, name, api_key, permissions, rate_limit_rpm, rate_limit_oph,
        is_active, credential_version
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `).bind(
      'legacy-agent',
      'Legacy Agent',
      'legacy-secret',
      '["read:products"]',
      100,
      10,
    ).run();

    const database = drizzle(env.DB, { schema });
    const result = await authenticateAgent(request('legacy-secret'), { database });
    expect(result).toMatchObject({ success: true, agentId: 'legacy-agent' });

    const row = await env.DB.prepare(`
      SELECT api_key, api_key_hash, api_key_expires_at, credential_version
      FROM mcp_agents WHERE agent_id = ?
    `).bind('legacy-agent').first<{
      api_key: string;
      api_key_hash: string;
      api_key_expires_at: string;
      credential_version: number;
    }>();
    expect(row?.api_key).toMatch(/^retired:legacy-agent:/);
    expect(row?.api_key_hash).toBe(await sha256Hex('legacy-secret'));
    expect(row?.api_key_expires_at).toBeTruthy();
    expect(row?.credential_version).toBe(2);

    await expect(authenticateAgent(request('legacy-secret'), { database })).resolves.toMatchObject({ success: true });
  });

  it('rejects an expired hashed credential', async () => {
    await env.DB.prepare(`
      INSERT INTO mcp_agents (
        agent_id, name, api_key, api_key_hash, api_key_expires_at,
        credential_version, permissions, is_active
      ) VALUES (?, ?, ?, ?, ?, 2, '[]', 1)
    `).bind(
      'expired-agent',
      'Expired Agent',
      'retired:expired-agent:test',
      await sha256Hex('expired-secret'),
      '2000-01-01T00:00:00.000Z',
    ).run();

    const database = drizzle(env.DB, { schema });
    const result = await authenticateAgent(request('expired-secret'), { database });
    expect(result.error?.code).toBe('API_KEY_EXPIRED');
  });

  it('does not accept a stale plaintext value after a hash is installed', async () => {
    await env.DB.prepare(`
      INSERT INTO mcp_agents (
        agent_id, name, api_key, api_key_hash, api_key_expires_at,
        credential_version, permissions, is_active
      ) VALUES (?, ?, ?, ?, ?, 2, '[]', 1)
    `).bind(
      'rotated-agent',
      'Rotated Agent',
      'stale-plaintext-secret',
      await sha256Hex('current-secret'),
      new Date(Date.now() + 60_000).toISOString(),
    ).run();

    const database = drizzle(env.DB, { schema });
    await expect(authenticateAgent(request('current-secret'), { database }))
      .resolves.toMatchObject({ success: true, agentId: 'rotated-agent' });
    await expect(authenticateAgent(request('stale-plaintext-secret'), { database }))
      .resolves.toMatchObject({ success: false, error: { code: 'INVALID_API_KEY' } });
  });
});
