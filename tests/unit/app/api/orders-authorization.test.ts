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
  shipped_at: null, delivered_at: null, notes: null, external_references: null,
  extensions: null, created_at: null, updated_at: null,
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
  });

  it('adds an owner predicate to customer history queries', async () => {
    mocks.auth.mockResolvedValue({ userId: 'owner' });
    const response = await listOrders(
      new NextRequest('http://localhost/api/orders?userId=owner')
    );
    expect(response.status).toBe(200);
    expect(mocks.where).toHaveBeenCalledWith(expect.anything());
  });
});
