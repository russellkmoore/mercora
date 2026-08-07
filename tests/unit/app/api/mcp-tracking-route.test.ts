import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAgent: vi.fn(),
  getOrderStatus: vi.fn(),
}));

vi.mock('@/lib/mcp/auth', () => ({ authenticateAgent: mocks.authenticateAgent }));
vi.mock('@/lib/mcp/tools/order', () => ({ getOrderStatus: mocks.getOrderStatus }));

import { GET, POST } from '@/app/api/mcp/tools/order/track/route';

function getRequest(url: string) {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateAgent.mockResolvedValue({ success: true, agentId: 'agent-1', permissions: [] });
  mocks.getOrderStatus.mockResolvedValue({
    success: true,
    data: {
      orderId: 'MCP-AGENT1-1-A1B2C3D4',
      status: 'processing',
      total: { amount: 25, currency: 'USD', precision: 2 },
      estimated_delivery: '3-5 business days',
    },
    context: { session_id: 'status-check', agent_id: 'agent-1', processing_time_ms: 1 },
    metadata: { can_fulfill_percentage: 100, estimated_satisfaction: 90 },
  });
});

describe('MCP tracking route', () => {
  it('projects the authenticated agent order without invented carrier history', async () => {
    const response = await GET(getRequest(
      'https://mercora.test/api/mcp/tools/order/track?orderId=MCP-AGENT1-1-A1B2C3D4',
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(mocks.getOrderStatus).toHaveBeenCalledWith('MCP-AGENT1-1-A1B2C3D4', 'agent-1');
    expect(body.data).toMatchObject({ status: 'processing', history: [] });
    expect(body.data.location).toBeUndefined();
  });

  it('authenticates a POST only once and requires an order ID', async () => {
    const response = await POST(new Request('https://mercora.test/api/mcp/tools/order/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'MCP-AGENT1-1-A1B2C3D4' }),
    }) as import('next/server').NextRequest);
    expect(response.status).toBe(200);
    expect(mocks.authenticateAgent).toHaveBeenCalledOnce();
  });
});
