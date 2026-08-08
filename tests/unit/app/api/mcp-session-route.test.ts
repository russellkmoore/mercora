import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAgent: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  parseAgentContext: vi.fn(),
}));

vi.mock('@/lib/mcp/auth', () => ({ authenticateAgent: mocks.authenticateAgent }));
vi.mock('@/lib/mcp/session', () => ({
  getSession: mocks.getSession,
  updateSession: mocks.updateSession,
  deleteSession: vi.fn(),
}));
vi.mock('@/lib/mcp/context', () => ({ parseAgentContext: mocks.parseAgentContext }));

import { PUT } from '@/app/api/mcp/sessions/[sessionId]/route';

function request(contextHeader: string | null) {
  return {
    headers: { get: (name: string) => name === 'X-Agent-Context' ? contextHeader : null },
    json: vi.fn(async () => ({ cart: [{ price: 1 }] })),
  } as unknown as import('next/server').NextRequest;
}

const session = {
  sessionId: 'session-1',
  agentId: 'agent-1',
  userContext: { agentId: 'agent-1' },
  cart: [],
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateAgent.mockResolvedValue({ success: true, agentId: 'agent-1', permissions: [] });
  mocks.getSession.mockResolvedValue(session);
  mocks.updateSession.mockResolvedValue(true);
  mocks.parseAgentContext.mockReturnValue({
    agentId: 'agent-1',
    userPreferences: { budget: 50 },
  });
});

describe('MCP session update boundary', () => {
  it('rejects a generic update without validated agent context', async () => {
    const response = await PUT(request(null), { params: Promise.resolve({ sessionId: 'session-1' }) });
    expect(response.status).toBe(400);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it('updates only validated context and cannot overwrite the cart', async () => {
    const req = request('{"agentId":"spoofed"}');
    const response = await PUT(req, { params: Promise.resolve({ sessionId: 'session-1' }) });
    expect(response.status).toBe(200);
    expect(req.json).not.toHaveBeenCalled();
    expect(mocks.updateSession).toHaveBeenCalledWith('session-1', {
      userContext: { agentId: 'agent-1', userPreferences: { budget: 50 } },
    });
  });
});
