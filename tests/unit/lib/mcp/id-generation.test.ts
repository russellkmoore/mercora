import { describe, expect, it } from 'vitest';
import { generateApiKey } from '@/lib/mcp/auth';
import { createAgentSessionId, parseAgentContext } from '@/lib/mcp/context';

function contextRequest(value?: unknown) {
  return {
    headers: {
      get: () => value === undefined ? null : JSON.stringify(value),
    },
  } as unknown as import('next/server').NextRequest;
}

describe('MCP security identifiers', () => {
  it('generates prefixed, high-entropy API keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(/^mcp_[0-9a-f]{32}$/);
    }
  });

  it('generates unique session ids with a CSPRNG UUID suffix', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createAgentSessionId('agent-x')));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toMatch(/^agent-x_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('uses authenticated identity even when no client context header exists', () => {
    expect(parseAgentContext(contextRequest(), 'authenticated-agent'))
      .toEqual({ agentId: 'authenticated-agent' });
  });

  it('overrides a spoofed context identity', () => {
    expect(parseAgentContext(contextRequest({ agentId: 'attacker' }), 'authenticated-agent'))
      .toEqual({ agentId: 'authenticated-agent' });
  });
});
