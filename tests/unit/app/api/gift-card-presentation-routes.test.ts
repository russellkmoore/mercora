import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  context: vi.fn(),
  rateLimit: vi.fn(),
  customerCards: vi.fn(),
  adminCards: vi.fn(),
  adminAuth: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.context }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: mocks.rateLimit }));
vi.mock('@/lib/gift-cards/presentations', () => ({
  listCustomerGiftCardPresentations: mocks.customerCards,
  listAdminGiftCardPresentations: mocks.adminCards,
}));
vi.mock('@/lib/auth/admin-middleware', () => ({ checkAdminPermissions: mocks.adminAuth }));

import { GET as customerGet } from '@/app/api/gift-cards/route';
import { GET as adminGet } from '@/app/api/admin/gift-cards/route';

const safeCard = {
  issuedAmount: { amount: 25, currency: 'USD', precision: 2 },
  availableBalance: { amount: 20, currency: 'USD', precision: 2 },
  status: 'active',
  createdAt: 1_700_000_000,
  delivery: { status: 'sent', attempts: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user_owner' });
  mocks.rateLimit.mockResolvedValue(null);
  mocks.context.mockResolvedValue({ env: { DB: {} } });
  mocks.customerCards.mockResolvedValue([safeCard]);
  mocks.adminAuth.mockResolvedValue({ success: true, userId: 'admin_one' });
  mocks.adminCards.mockResolvedValue({ cards: [{ ...safeCard, issuedOrderId: 'WEB-1', issuedLineId: 'line_1' }], total: 1 });
});

describe('gift-card presentation routes', () => {
  it('requires customer authentication before rate limiting or D1', async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await customerGet();
    expect(response.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it('keeps purchased-card visibility available under reconciliation-only mode', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true', STORE_FEATURE_GIFT_CARD_ACQUISITION: 'false' } });
    const response = await customerGet();
    expect(response.status).toBe(200);
    expect(mocks.customerCards).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'user_owner', limit: 100 }));
    const body = await response.json() as { cards: Array<Record<string, unknown>> };
    expect(body.cards).toEqual([safeCard]);
    expect(JSON.stringify(body)).not.toMatch(/code|hash|cipher|nonce|gift_card_id/i);
  });

  it('returns an empty customer projection without touching D1 while reconciliation is disabled', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'false' } });
    const response = await customerGet();
    await expect(response.json()).resolves.toEqual({ cards: [] });
    expect(mocks.customerCards).not.toHaveBeenCalled();
  });

  it('authenticates administrators before validating or reading the queue', async () => {
    mocks.adminAuth.mockResolvedValue({ success: false, error: 'Admin access required' });
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards?limit=999'));
    expect(response.status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it('uses bounded admin pagination and a safe operational projection', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true' } });
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards?status=active&limit=10&offset=2'));
    expect(response.status).toBe(200);
    expect(mocks.adminCards).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', limit: 10, offset: 2 }));
    const body = await response.json() as { cards: Array<Record<string, unknown>> };
    expect(body.cards[0]).toMatchObject({ ...safeCard, issuedOrderId: 'WEB-1' });
    expect(JSON.stringify(body)).not.toMatch(/code|hash|cipher|nonce|gift_card_id/i);
  });

  it.each(['status=unknown', 'status=active&status=disabled', 'limit=0', 'limit=101', 'offset=-1', 'offset=1000001'])(
    'rejects malformed administrative queries: %s',
    async (query) => {
      const response = await adminGet(new NextRequest(`https://store.example/api/admin/gift-cards?${query}`));
      expect(response.status).toBe(400);
      expect(mocks.context).not.toHaveBeenCalled();
    },
  );
});
