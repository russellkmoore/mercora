import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';
import { listAdminGiftCardPresentations } from '@/lib/gift-cards/presentations';
import { resolveHonorEffective } from '@/lib/gift-cards/honor-guard';
import { giftCardSurfacesHidden } from '@/lib/gift-cards/visibility';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000_000;

function boundedInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

/** Operational queue projection: intentionally no code material, hash, or account identity. */
export async function GET(request: NextRequest) {
  const authorization = await checkAdminPermissions(request);
  if (!authorization.success) {
    return NextResponse.json({ code: 'unauthorized', error: authorization.error ?? 'Admin access required' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const rawStatus = params.get('status');
  const status = rawStatus === 'active' || rawStatus === 'disabled' ? rawStatus : undefined;
  const limit = boundedInteger(params.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = boundedInteger(params.get('offset'), 0, MAX_OFFSET);
  if (params.getAll('status').length > 1 || (rawStatus !== null && !status)
    || params.getAll('limit').length > 1 || params.getAll('offset').length > 1
    || limit === null || limit < 1 || offset === null) {
    return NextResponse.json({ code: 'invalid_query', error: 'Invalid gift-card queue query' }, { status: 400 });
  }
  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error('D1 binding unavailable');
    const giftCardAcquisition = String(environment.STORE_FEATURE_GIFT_CARD_ACQUISITION ?? '').trim().toLowerCase() === 'true';
    const giftCardReconciliation = String(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() === 'true';
    // Both flags off: the surface exists only while the honor guard is
    // active (money still outstanding) — D-17. Either flag on renders as
    // today, unchanged.
    //
    // Through `resolveHonorEffective`, the single owner of that decision
    // (D-18), and not through `honorIsEffectivelyOn` one layer down. This route
    // is the queue that `/admin/gift-cards` fetches, so the page and its data
    // must reach the same answer by the same route — the two agree today only
    // because this gate runs solely under both-off, where the two functions
    // reduce to the same thing. That is a coincidence, not a contract.
    const flags = { giftCardAcquisition, giftCardReconciliation };
    if (giftCardSurfacesHidden(flags)) {
      const nowSeconds = Math.floor(Date.now() / 1_000);
      const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
      if (!guardActive) {
        return NextResponse.json({ code: 'gift_cards_unavailable', error: 'Gift cards are not available' }, { status: 404 });
      }
    }
    const result = await listAdminGiftCardPresentations({
      database: environment.DB,
      now: Math.floor(Date.now() / 1_000),
      limit,
      offset,
      status,
    });
    return NextResponse.json({ ...result, meta: { limit, offset } });
  } catch {
    return NextResponse.json({ code: 'gift_cards_read_failed', error: 'Gift cards are temporarily unavailable' }, { status: 503 });
  }
}
