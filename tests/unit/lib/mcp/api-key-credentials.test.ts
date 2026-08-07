import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@/lib/auth/crypto';

let selectResults: unknown[][] = [];
let insertedValues: Record<string, unknown> | undefined;
const updatedValues: Record<string, unknown>[] = [];

function makeChain(kind: 'select' | 'insert' | 'update') {
  const chain: Record<string, any> = {};
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.where = passthrough;
  chain.orderBy = passthrough;
  chain.offset = passthrough;
  chain.limit = () => Promise.resolve(selectResults.shift() ?? []);
  chain.values = (value: Record<string, unknown>) => {
    if (kind === 'insert') insertedValues = value;
    return chain;
  };
  chain.set = (value: Record<string, unknown>) => {
    updatedValues.push(value);
    return chain;
  };
  chain.onConflictDoUpdate = passthrough;
  chain.returning = () => Promise.resolve([{ agentId: 'agent-1' }]);
  return chain;
}

const fakeDb = {
  select: () => makeChain('select'),
  insert: () => makeChain('insert'),
  update: () => makeChain('update'),
  batch: vi.fn(async () => []),
};

vi.mock('@/lib/db', () => ({ getDbAsync: vi.fn(async () => fakeDb) }));

import {
  authenticateAgent,
  createAgent,
  extractAgentApiKey,
  rotateAgentApiKey,
} from '@/lib/mcp/auth';
import { canManageAgentPermissions } from '@/lib/mcp/tools/agent';

function request(headers: Record<string, string> = {}, queryKey?: string) {
  return {
    headers: { get: (name: string) => headers[name] ?? null },
    nextUrl: { searchParams: { get: () => queryKey ?? null } },
  } as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  selectResults = [];
  insertedValues = undefined;
  updatedValues.length = 0;
  fakeDb.batch.mockClear();
});

describe('MCP agent credentials', () => {
  it('does not let agents:manage control a more privileged credential', () => {
    expect(canManageAgentPermissions(['agents:manage'], ['admin'])).toBe(false);
    expect(canManageAgentPermissions(['agents:manage'], ['agents:manage'])).toBe(true);
    expect(canManageAgentPermissions(['admin'], ['admin', 'place:orders'])).toBe(true);
  });

  it('accepts only X-Agent-API-Key or a well-formed Bearer header', () => {
    expect(extractAgentApiKey(request({ 'X-Agent-API-Key': 'direct' }))).toBe('direct');
    expect(extractAgentApiKey(request({ Authorization: 'Bearer bearer-key' }))).toBe('bearer-key');
    expect(extractAgentApiKey(request({ Authorization: 'Basic abc' }))).toBeNull();
    expect(extractAgentApiKey(request({}, 'query-secret'))).toBeNull();
  });

  it('stores a hash and retirement marker, never the issued raw key', async () => {
    const issued = await createAgent({ agentId: 'agent-1', name: 'Agent One' });

    expect(issued.apiKey).toMatch(/^mcp_/);
    expect(insertedValues?.apiKeyHash).toBe(await sha256Hex(issued.apiKey));
    expect(insertedValues?.legacyApiKey).toMatch(/^retired:agent-1:/);
    expect(insertedValues?.apiKeyExpiresAt).toBe(issued.expiresAt);
    expect(Object.values(insertedValues ?? {})).not.toContain(issued.apiKey);
  });

  it('authenticates a hashed key and returns fail-closed parsed permissions', async () => {
    selectResults = [[{
      agentId: 'agent-1',
      legacyApiKey: 'retired:agent-1:value',
      apiKeyHash: await sha256Hex('presented'),
      apiKeyExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      permissions: '["write:cart",42]',
      rateLimitRpm: 100,
      rateLimitOph: 10,
      isActive: true,
    }], []];

    const result = await authenticateAgent(request({ 'X-Agent-API-Key': 'presented' }));
    expect(result).toMatchObject({ success: true, agentId: 'agent-1', permissions: ['write:cart'] });
    expect(fakeDb.batch).toHaveBeenCalledOnce();
  });

  it('upgrades a successfully used plaintext credential in place', async () => {
    selectResults = [[{
      agentId: 'legacy-agent',
      legacyApiKey: 'legacy-secret',
      apiKeyHash: null,
      apiKeyExpiresAt: null,
      permissions: '[]',
      rateLimitRpm: 100,
      rateLimitOph: 10,
      isActive: true,
    }], []];

    const result = await authenticateAgent(request({ 'X-Agent-API-Key': 'legacy-secret' }));
    expect(result.success).toBe(true);
    expect(updatedValues[0]).toMatchObject({
      apiKeyHash: await sha256Hex('legacy-secret'),
      credentialVersion: 2,
    });
    expect(updatedValues[0].legacyApiKey).toMatch(/^retired:legacy-agent:/);
  });

  it('rejects an expired credential before consuming rate-limit capacity', async () => {
    selectResults = [[{
      agentId: 'expired-agent',
      legacyApiKey: 'retired:expired-agent:value',
      apiKeyHash: await sha256Hex('expired'),
      apiKeyExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      permissions: '[]',
      rateLimitRpm: 100,
      rateLimitOph: 10,
      isActive: true,
    }]];

    const result = await authenticateAgent(request({ Authorization: 'Bearer expired' }));
    expect(result.error?.code).toBe('API_KEY_EXPIRED');
    expect(fakeDb.batch).not.toHaveBeenCalled();
  });

  it('rejects an invalid credential expiry instead of failing open', async () => {
    selectResults = [[{
      agentId: 'invalid-expiry-agent',
      legacyApiKey: 'retired:invalid-expiry-agent:value',
      apiKeyHash: await sha256Hex('presented'),
      apiKeyExpiresAt: 'not-a-date',
      permissions: '[]',
      rateLimitRpm: 100,
      rateLimitOph: 10,
      isActive: true,
    }]];

    const result = await authenticateAgent(request({ Authorization: 'Bearer presented' }));
    expect(result.error?.code).toBe('API_KEY_EXPIRED');
    expect(fakeDb.batch).not.toHaveBeenCalled();
  });

  it('rotates a credential and returns the raw replacement once', async () => {
    const rotated = await rotateAgentApiKey('agent-1', 30);
    expect(rotated.apiKey).toMatch(/^mcp_/);
    expect(updatedValues[0].apiKeyHash).toBe(await sha256Hex(rotated.apiKey));
    expect(updatedValues[0].legacyApiKey).toMatch(/^retired:agent-1:/);
    expect(Object.values(updatedValues[0])).not.toContain(rotated.apiKey);
  });
});
