import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  context: vi.fn(),
  rateLimit: vi.fn(),
  adminCards: vi.fn(),
  adminAuth: vi.fn(),
  resolveHonorEffective: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.context }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: mocks.rateLimit, getClientIp: () => '203.0.113.1' }));
vi.mock('@/lib/gift-cards/presentations', () => ({
  listAdminGiftCardPresentations: mocks.adminCards,
}));
vi.mock('@/lib/auth/admin-middleware', () => ({ checkAdminPermissions: mocks.adminAuth }));
// The admin queue asks the single owner of the money decision (D-18), the same
// function `/admin/gift-cards` asks, rather than reaching a layer lower.
vi.mock('@/lib/gift-cards/honor-guard', () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));

import { GET as adminGet } from '@/app/api/admin/gift-cards/route';
import { POST as balancePost } from '@/app/api/gift-cards/balance/route';

const safeCard = {
  issuedAmount: { amount: 25, currency: 'USD', precision: 2 },
  availableBalance: { amount: 20, currency: 'USD', precision: 2 },
  status: 'active',
  createdAt: 1_700_000_000,
  delivery: { status: 'sent', attempts: 1 },
};

function balanceRequest(code: string) {
  return new NextRequest('https://store.example/api/gift-cards/balance', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user_owner' });
  mocks.rateLimit.mockResolvedValue(null);
  mocks.context.mockResolvedValue({ env: { DB: {} } });
  mocks.adminAuth.mockResolvedValue({ success: true, userId: 'admin_one' });
  mocks.adminCards.mockResolvedValue({ cards: [{ ...safeCard, issuedOrderId: 'WEB-1', issuedLineId: 'line_1' }], total: 1 });
  mocks.resolveHonorEffective.mockResolvedValue(true);
});

describe('gift-card presentation routes', () => {
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

  it('404s the admin queue when both flags are off and the honor guard is clear (D-17)', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(false);
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));
    expect(response.status).toBe(404);
    expect(mocks.adminCards).not.toHaveBeenCalled();
  });

  it('keeps the admin queue reachable at 200 when honoring is off but the guard is active (D-17)', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(true);
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));
    expect(response.status).toBe(200);
    expect(mocks.adminCards).toHaveBeenCalled();
  });

  it('still 401s an unauthenticated caller when both flags are off, never disclosing flag state', async () => {
    mocks.adminAuth.mockResolvedValue({ success: false, error: 'Admin access required' });
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));
    expect(response.status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it('passes both flags to the decision rather than a bare honor=false (WR-18)', async () => {
    // The route used to call honorIsEffectivelyOn(DB, false, now) — a fifth
    // implementation of the money question, agreeing with the owner only
    // because this gate runs solely under both-off, where the two reduce to the
    // same thing. That was a coincidence, not a contract.
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    mocks.resolveHonorEffective.mockResolvedValue(true);

    await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));

    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      expect.anything(),
      { giftCardAcquisition: false, giftCardReconciliation: false },
      expect.any(Number),
    );
  });

  it('lists cards to an admin with sell on and honor off, which is deliberate (WR-12, D-14)', async () => {
    // The old gate was `reconciliation !== true -> empty`, so this state used
    // to return nothing. Opening it up is the right call and not an accident:
    // this is the admin queue behind checkAdminPermissions, D-14 keeps the card
    // visible to the people who administer it regardless of the flags, and
    // Phase 14's management depends on that. The combination is invalid and
    // should never be deployed (capability resolution throws for anything that
    // resolves capabilities), but hiding an operator's view of outstanding
    // cards is not how an invalid config should be surfaced.
    mocks.context.mockResolvedValue({
      env: { DB: {}, STORE_FEATURE_GIFT_CARD_ACQUISITION: 'true' },
    });
    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));

    expect(response.status).toBe(200);
    // The honor guard is not consulted at all: the both-off gate is the only
    // thing that reads it, and sell is on here.
    expect(mocks.resolveHonorEffective).not.toHaveBeenCalled();
  });

  it('surfaces a configuration throw as a 503 rather than a stack trace', async () => {
    // Whatever throws under this route — a capability configuration error, a
    // D1 failure — an operator gets one fail-closed status and a message that
    // names no internals.
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true' } });
    mocks.adminCards.mockRejectedValue(new Error('CommerceCapabilityConfigurationError'));

    const response = await adminGet(new NextRequest('https://store.example/api/admin/gift-cards'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'gift_cards_read_failed',
      error: 'Gift cards are temporarily unavailable',
    });
  });

  it('404s the public balance route when both flags are off', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {} } });
    const response = await balancePost(balanceRequest('ABC123'));
    expect(response.status).toBe(404);
  });

  it('keeps the balance route single generic invalid response when honoring is on', async () => {
    mocks.context.mockResolvedValue({ env: { DB: {}, STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true' } });
    const response = await balancePost(balanceRequest('ABC123'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: false });
  });
});
