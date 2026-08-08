import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAgent: vi.fn(),
  createAgent: vi.fn(),
  addToCart: vi.fn(),
}));

vi.mock('@/lib/mcp/auth', () => ({
  authenticateAgent: mocks.authenticateAgent,
  hasAgentManagementPermission: (permissions: string[] | undefined) =>
    permissions?.some((permission) => ['admin', '*', 'agents:manage'].includes(permission)) ?? false,
  hasPermission: (permissions: string[] | undefined, required: string) =>
    permissions?.some((permission) => permission === required || permission === 'admin' || permission === '*') ?? false,
  requiredScopeForTool: (tool: string) => ({
    add_to_cart: 'write:cart',
    create_payment_intent: 'place:orders',
    place_order: 'place:orders',
  } as Record<string, string>)[tool],
}));
vi.mock('@/lib/mcp/context', () => ({ parseAgentContext: vi.fn(() => null) }));
vi.mock('@/lib/mcp/tools/agent', () => ({ createAgent: mocks.createAgent }));
vi.mock('@/lib/mcp/tools/cart', () => ({ addToCart: mocks.addToCart }));
vi.mock('@/lib/mcp/catalog', () => ({ getCatalogCapabilities: vi.fn() }));

import { POST as dispatch } from '@/app/api/mcp/route';
import { POST as createAgent } from '@/app/api/mcp/tools/agents/create/route';
import { POST as addCart } from '@/app/api/mcp/tools/cart/add/route';

function request(body: Record<string, unknown>) {
  return {
    json: vi.fn(async () => body),
    headers: { get: vi.fn(() => null) },
  } as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateAgent.mockResolvedValue({
    success: true,
    agentId: 'plain-agent',
    permissions: ['read:products'],
  });
});

describe('MCP authorization is enforced on every entry point', () => {
  it('blocks agent management through the JSON dispatcher', async () => {
    const response = await dispatch(request({ tool: 'create_agent', params: {} }));
    expect(response.status).toBe(403);
    expect(mocks.createAgent).not.toHaveBeenCalled();
  });

  it('blocks cart mutation through the JSON dispatcher without write:cart', async () => {
    const response = await dispatch(request({ tool: 'add_to_cart', params: {}, session_id: 's' }));
    expect(response.status).toBe(403);
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });

  it('blocks agent management through its REST route', async () => {
    const response = await createAgent(request({ agentId: 'new', name: 'New Agent' }));
    expect(response.status).toBe(403);
    expect(mocks.createAgent).not.toHaveBeenCalled();
  });

  it('blocks cart mutation through its REST route without write:cart', async () => {
    const response = await addCart(request({ productId: 1, variantId: 1, session_id: 's' }));
    expect(response.status).toBe(403);
    expect(mocks.addToCart).not.toHaveBeenCalled();
  });
});
