import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS } from '@/lib/gift-cards/events';

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  adminAuth: vi.fn(),
  resolveHonorEffective: vi.fn(),
  findAccountById: vi.fn(),
  findReservations: vi.fn(),
  getAdminGiftCardPresentation: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.context }));
vi.mock('@/lib/auth/admin-middleware', () => ({ checkAdminPermissions: mocks.adminAuth }));
// The detail and events routes ask the single owner of the money decision
// (D-16), the same function `/api/admin/gift-cards` asks.
vi.mock('@/lib/gift-cards/honor-guard', () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));
vi.mock('@/lib/gift-cards/repository', () => ({
  createGiftCardRepository: () => ({
    findAccountById: mocks.findAccountById,
    findReservations: mocks.findReservations,
  }),
  classifyGiftCardReservation: (
    reservation: { releasedAt?: number; committedAt?: number; expiresAt: number },
    now: number,
  ) => {
    if (reservation.releasedAt !== undefined) return 'released';
    if (reservation.committedAt !== undefined) return 'committed_unsettled';
    return reservation.expiresAt > now ? 'open' : 'expired';
  },
}));
vi.mock('@/lib/gift-cards/presentations', () => ({
  getAdminGiftCardPresentation: mocks.getAdminGiftCardPresentation,
}));
vi.mock('@/lib/utils/settings', () => ({ getSettings: mocks.getSettings }));

import { GET as detailGet } from '@/app/api/admin/gift-cards/[id]/route';

function detailRequest(id: string, query = '') {
  return {
    request: new NextRequest(`https://store.example/api/admin/gift-cards/${id}${query}`),
    params: Promise.resolve({ id }),
  };
}

const samplePresentation = {
  id: 'gift_card_1',
  issuedAmount: { amount: 25, currency: 'USD', precision: 2 },
  availableBalance: { amount: 20, currency: 'USD', precision: 2 },
  status: 'active',
  createdAt: 1_700_000_000,
  delivery: { status: 'sent', attempts: 1 },
  issuedOrderId: 'WEB-1',
  issuedLineId: 'line_1',
  codeSuffix: 'AB12',
  maskedCode: 'GC-****-****-AB12',
  recipientEmail: 'shopper@example.com',
  purchaser: 'Jane Shopper',
};

const sampleAccount = {
  id: 'gift_card_1',
  status: 'active' as const,
  createdAt: 1_700_000_000,
  disabledAt: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true' } });
  mocks.adminAuth.mockResolvedValue({ success: true, userId: 'admin_one' });
  mocks.resolveHonorEffective.mockResolvedValue(true);
  mocks.findAccountById.mockResolvedValue(sampleAccount);
  mocks.getAdminGiftCardPresentation.mockResolvedValue(samplePresentation);
  mocks.findReservations.mockResolvedValue([]);
  mocks.getSettings.mockResolvedValue({ 'gift_cards.code_reveal_enabled': false });
});

describe('GET /api/admin/gift-cards/[id]', () => {
  it('401s an unauthenticated caller', async () => {
    mocks.adminAuth.mockResolvedValue({ success: false, error: 'Admin access required' });
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it('404s with gift_card_not_found for an unknown id', async () => {
    mocks.findAccountById.mockResolvedValue(undefined);
    const { request, params } = detailRequest('gift_card_missing');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'gift_card_not_found' });
  });

  it('404s with gift_cards_unavailable when both flags are off and the honor guard is clear (D-16)', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(false);
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'gift_cards_unavailable' });
    expect(mocks.findAccountById).not.toHaveBeenCalled();
  });

  it('serves normally when both flags are off but the honor guard is active (D-16)', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(true);
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(200);
  });

  it('calls resolveHonorEffective with both flags rather than a bare boolean', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    const { request, params } = detailRequest('gift_card_1');
    await detailGet(request, { params });
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      expect.anything(),
      { giftCardAcquisition: false, giftCardReconciliation: false },
      expect.any(Number),
    );
  });

  it('returns a full card view with reservations classified and capabilities from the stored setting', async () => {
    mocks.getSettings.mockResolvedValue({ 'gift_cards.code_reveal_enabled': true });
    mocks.findReservations.mockResolvedValue([{
      id: 'res_1',
      giftCardId: 'gift_card_1',
      amount: { toMinorUnits: () => 500 },
      reservedAt: 1_700_000_100,
      expiresAt: 1_700_100_000,
      committedOrderId: undefined,
      committedAt: undefined,
      releasedAt: undefined,
      releaseReason: undefined,
    }]);
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.card).toMatchObject({
      id: 'gift_card_1',
      maskedCode: 'GC-****-****-AB12',
      codeSuffix: 'AB12',
      status: 'active',
      issuedOrderId: 'WEB-1',
      recipientEmail: 'shopper@example.com',
      purchaser: 'Jane Shopper',
      disabledAt: null,
    });
    expect(body.reservations).toHaveLength(1);
    expect(body.reservations[0]).toMatchObject({ id: 'res_1', amountMinor: 500, classification: 'open' });
    expect(body.capabilities).toEqual({ codeRevealEnabled: true });
  });

  it('carries no forbidden column names in a successful response body', async () => {
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    const text = JSON.stringify(await response.json());
    for (const column of GIFT_CARD_EVENT_FORBIDDEN_DETAIL_KEYS) {
      expect(text).not.toContain(column);
    }
  });

  it('503s on a database failure with code gift_cards_read_failed', async () => {
    mocks.findAccountById.mockRejectedValue(new Error('boom'));
    const { request, params } = detailRequest('gift_card_1');
    const response = await detailGet(request, { params });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'gift_cards_read_failed' });
  });
});
