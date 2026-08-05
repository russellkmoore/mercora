import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  authenticateRequest: vi.fn(),
  where: vi.fn(),
  records: [] as any[],
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/auth/unified-auth', () => ({
  PERMISSIONS: { ORDERS_READ: ['orders:read'], ORDERS_UPDATE: ['orders:update'] },
  authenticateRequest: mocks.authenticateRequest,
}));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => null), getClientIp: vi.fn(() => 'test') }));
vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: (predicate: unknown) => {
          mocks.where(predicate);
          const result = {
            orderBy: async () => mocks.records,
            limit: async () => mocks.records,
            then: (resolve: (value: any[]) => unknown) => Promise.resolve(mocks.records).then(resolve),
          };
          return result;
        },
        orderBy: async () => mocks.records,
      }),
    }),
  })),
}));
vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class extends Error {},
  finalizeOrderPayment: vi.fn(),
}));

import { GET as getOrder } from '@/app/api/orders/[id]/route';
import { GET as listOrders } from '@/app/api/orders/route';

const record = {
  id: 'WEB-OWNER-1-AAAA', customer_id: 'owner', status: 'pending',
  total_amount: { amount: 100, currency: 'USD' }, currency_code: 'USD',
  shipping_address: null, billing_address: null, items: [], shipping_method: null,
  payment_method: null, payment_status: 'pending', tracking_number: null,
  shipped_at: null, delivered_at: null, notes: 'manual review pi_legacy_secret',
  extensions: {
    payment_intent_id: 'pi_secret',
    checkout_tender_state: { reservation: 'opaque-secret' },
    public_note: 'visible',
  },
  external_references: { payment_intent_id: 'pi_secret', erp: 'internal' },
  created_at: null, updated_at: null,
};

beforeEach(() => {
  mocks.records = [record];
  mocks.auth.mockResolvedValue({ userId: 'owner' });
  mocks.authenticateRequest.mockResolvedValue({ success: false, response: NextResponse.json({ error: 'denied' }, { status: 403 }) });
});

describe('order read authorization', () => {
  it('allows the owner without invoking admin auth', async () => {
    const response = await getOrder(
      new NextRequest('http://localhost/api/orders/WEB-OWNER-1-AAAA'),
      { params: Promise.resolve({ id: record.id }) }
    );
    expect(response.status).toBe(200);
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
    const body = await response.json() as any;
    expect(body.data).not.toHaveProperty('extensions');
    expect(body.data).not.toHaveProperty('external_references');
    expect(body.data).not.toHaveProperty('notes');
  });

  it('fails closed for foreign and guest receipt reads', async () => {
    mocks.auth.mockResolvedValueOnce({ userId: 'attacker' });
    let response = await getOrder(
      new NextRequest(`http://localhost/api/orders/${record.id}`),
      { params: Promise.resolve({ id: record.id }) }
    );
    expect(response.status).toBe(403);

    mocks.auth.mockResolvedValueOnce({ userId: null });
    response = await getOrder(
      new NextRequest(`http://localhost/api/orders/${record.id}`),
      { params: Promise.resolve({ id: record.id }) }
    );
    expect(response.status).toBe(403);
  });

  it('allows a non-owner with explicit admin order-read permission', async () => {
    mocks.auth.mockResolvedValue({ userId: 'admin' });
    mocks.authenticateRequest.mockResolvedValue({ success: true });
    const response = await getOrder(
      new NextRequest(`http://localhost/api/orders/${record.id}`),
      { params: Promise.resolve({ id: record.id }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.data.extensions.payment_intent_id).toBe('pi_secret');
    expect(body.data.external_references.payment_intent_id).toBe('pi_secret');
  });

  it('adds an owner predicate to customer history queries', async () => {
    mocks.auth.mockResolvedValue({ userId: 'owner' });
    const response = await listOrders(
      new NextRequest('http://localhost/api/orders?userId=owner')
    );
    expect(response.status).toBe(200);
    expect(mocks.where).toHaveBeenCalledWith(expect.anything());
    const body = await response.json() as any;
    expect(body.data[0]).not.toHaveProperty('extensions');
    expect(body.data[0]).not.toHaveProperty('external_references');
    expect(body.data[0]).not.toHaveProperty('notes');
  });

  it.each(['0', '-1', '1.5', 'NaN', '101'])('rejects invalid limit %s', async (limit) => {
    const response = await listOrders(
      new NextRequest(`http://localhost/api/orders?userId=owner&limit=${limit}`)
    );
    expect(response.status).toBe(400);
  });

  it.each(['-1', '1.5', 'NaN'])('rejects invalid offset %s', async (offset) => {
    const response = await listOrders(
      new NextRequest(`http://localhost/api/orders?userId=owner&offset=${offset}`)
    );
    expect(response.status).toBe(400);
  });

  it('points last at the final populated page for exact multiples', async () => {
    mocks.records = Array.from({ length: 100 }, (_, index) => ({
      ...record,
      id: `WEB-OWNER-${index}`,
    }));
    const response = await listOrders(
      new NextRequest('http://localhost/api/orders?userId=owner&limit=50')
    );
    const body = await response.json() as any;
    expect(body.links.last).toBe('/api/orders?limit=50&offset=50');
  });
});
