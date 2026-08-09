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
      tracking_number: '1Z999',
      shipment: {
        carrier: 'ups',
        carrier_label: 'UPS',
        tracking_number: '1Z999',
        tracking_url: 'https://carrier.example/1Z999',
      },
      tracking_history: [{
        date: '2026-08-02T00:00:00.000Z',
        status: 'shipped',
        description: 'Package shipped',
      }],
      estimated_delivery: '3-5 business days',
    },
    context: { session_id: 'status-check', agent_id: 'agent-1', processing_time_ms: 1 },
    metadata: { can_fulfill_percentage: 100, estimated_satisfaction: 90 },
  });
});

describe('MCP tracking route', () => {
  it('projects configured carrier data and real fulfillment history without invented location', async () => {
    const response = await GET(getRequest(
      'https://mercora.test/api/mcp/tools/order/track?orderId=MCP-AGENT1-1-A1B2C3D4',
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Record<string, unknown> };
    expect(mocks.getOrderStatus).toHaveBeenCalledWith('MCP-AGENT1-1-A1B2C3D4', 'agent-1');
    expect(body.data).toMatchObject({
      status: 'processing',
      trackingNumber: '1Z999',
      carrier: 'ups',
      carrierLabel: 'UPS',
      trackingUrl: 'https://carrier.example/1Z999',
      history: [{ status: 'shipped' }],
    });
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

  it('rejects an oversized POST before reading order state', async () => {
    const response = await POST(new Request('https://mercora.test/api/mcp/tools/order/track', {
      method: 'POST',
      body: JSON.stringify({ orderId: 'MCP-OK', pad: 'x'.repeat(1_100) }),
    }) as import('next/server').NextRequest);
    expect(response.status).toBe(413);
    expect(mocks.getOrderStatus).not.toHaveBeenCalled();
  });

  it.each(['GET', 'POST'])('returns a structured generic error when %s projection fails', async (method) => {
    mocks.getOrderStatus.mockRejectedValue(new Error('private database detail'));
    const response = method === 'GET'
      ? await GET(getRequest(
        'https://mercora.test/api/mcp/tools/order/track?orderId=MCP-AGENT1-1-A1B2C3D4',
      ))
      : await POST(new Request('https://mercora.test/api/mcp/tools/order/track', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'MCP-AGENT1-1-A1B2C3D4' }),
      }) as import('next/server').NextRequest);

    expect(response.status).toBe(500);
    const body = await response.json() as { error: { code: string; message: string } };
    expect(body.error).toEqual({
      code: 'ORDER_TRACKING_ERROR',
      message: 'Failed to get order tracking',
    });
    expect(JSON.stringify(body)).not.toContain('private database detail');
  });
});
