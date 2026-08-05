import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ updateWhere: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(async () => ({ userId: null })) }));
vi.mock('@/lib/auth/unified-auth', () => ({
  PERMISSIONS: { ORDERS_UPDATE: ['orders:update'], ORDERS_READ: ['orders:read'] },
  authenticateRequest: vi.fn(async () => ({ success: true, tokenInfo: { tokenName: 'test' } })),
}));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => null), getClientIp: vi.fn(() => 'test') }));
vi.mock('@/lib/services/order-finalization', () => ({
  PaymentVerificationError: class extends Error {},
  finalizeOrderPayment: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  getDbAsync: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{
      id: 'WEB-USER-1-AAAA', status: 'pending', payment_status: 'pending',
      updated_at: '2026-08-05T00:00:00Z', extensions: {}, external_references: {},
    }] }) }) }),
    update: () => ({
      set: () => ({
        where: (predicate: unknown) => {
          mocks.updateWhere(predicate);
          return { returning: async () => [] };
        },
      }),
    }),
  })),
}));

import { PUT } from '@/app/api/orders/route';

describe('order metadata compare-and-swap', () => {
  it('returns 409 when updated_at changed before the write', async () => {
    const response = await PUT(new NextRequest('http://localhost/api/orders', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'WEB-USER-1-AAAA', notes: 'metadata only' }),
    }));
    expect(mocks.updateWhere).toHaveBeenCalledWith(expect.anything());
    expect(response.status).toBe(409);
  });
});
