import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { toWireMoney } from '@/lib/money';
import { parseGiftCardCodeKeyRing } from '@/lib/gift-cards/config';
import { giftCardLookupCandidates } from '@/lib/gift-cards/code';
import { createGiftCardRepository } from '@/lib/gift-cards/repository';
import { resolveHonorEffective } from '@/lib/gift-cards/honor-guard';
import { giftCardSurfacesHidden } from '@/lib/gift-cards/visibility';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';
import { isBoundedString, isPlainRecord } from '@/lib/public-request-validation';

/**
 * Public balance lookup intentionally has one generic invalid response. It
 * reveals neither account IDs nor code-hash rotation state and never logs the
 * submitted bearer code.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit('PUBLIC_RATE_LIMITER', `gift-card-balance:${getClientIp(request)}`);
  if (limited) return limited;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ valid: false }); }
  if (!isPlainRecord(body) || !isBoundedString(body.code, 512)) {
    return NextResponse.json({ valid: false });
  }
  try {
    const { env } = await getCloudflareContext({ async: true });
    const raw = env as unknown as Record<string, unknown> & { DB?: D1Database };
    const giftCardAcquisition = String(raw.STORE_FEATURE_GIFT_CARD_ACQUISITION ?? '').trim().toLowerCase() === 'true';
    const giftCardReconciliation = String(raw.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() === 'true';
    // Both flags off: gift cards do not exist for a visitor at all (D-10).
    // Configured flags only, and applied before the guard is consulted — the
    // honor guard is a money decision and never widens a public surface
    // (D-18). The checkout page applies the identical gate in the same order.
    const flags = { giftCardAcquisition, giftCardReconciliation };
    if (giftCardSurfacesHidden(flags)) {
      return NextResponse.json({ code: 'gift_cards_unavailable', error: 'Gift cards are not available' }, { status: 404 });
    }
    // Existing-card redemption and balance checks remain available during a
    // sales rollback; only new issuance is controlled by acquisition.
    //
    // The *effective* honor value, not the configured flag. With honor off and
    // balances still outstanding the runtime keeps redeeming and settling
    // (D-04), so answering `{ valid: false }` for a card the checkout would
    // accept is a lie to the one shopper the guard exists for. Configured-on
    // short-circuits inside `resolveHonorEffective` without reading D1, and any
    // failure reading the guard row answers "keep honoring".
    if (!raw.DB) return NextResponse.json({ valid: false });
    const honorEffective = await resolveHonorEffective(
      raw.DB,
      flags,
      Math.floor(Date.now() / 1_000),
    );
    if (!honorEffective) {
      return NextResponse.json({ valid: false });
    }
    const keyRing = parseGiftCardCodeKeyRing(raw);
    const candidates = await giftCardLookupCandidates(body.code, keyRing);
    const repository = createGiftCardRepository(raw.DB);
    const found = await Promise.all(candidates.map((candidate) => repository.findAccountByCodeHash(candidate)));
    const accounts = [...new Map(found.filter(Boolean).map((account) => [account!.id, account!])).values()];
    if (accounts.length !== 1 || accounts[0].status !== 'active') return NextResponse.json({ valid: false });
    const balance = await repository.readBalance(accounts[0].id, Math.floor(Date.now() / 1_000));
    if (!balance || balance.availableBalance.isZero()) return NextResponse.json({ valid: false });
    return NextResponse.json({ valid: true, balance: toWireMoney(balance.availableBalance.toJSON()) });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
