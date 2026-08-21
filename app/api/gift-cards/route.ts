import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { listCustomerGiftCardPresentations } from '@/lib/gift-cards/presentations';

const CUSTOMER_CARD_LIMIT = 100;

/** List cards purchased by the authenticated customer without exposing codes or card identities. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const limited = await enforceRateLimit('PUBLIC_RATE_LIMITER', `gift-card-account:${userId}`);
  if (limited) return limited;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (String(environment.STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() !== 'true') {
      return NextResponse.json({ cards: [] });
    }
    if (!environment.DB) return NextResponse.json({ error: 'Gift cards are temporarily unavailable' }, { status: 503 });
    const cards = await listCustomerGiftCardPresentations({
      database: environment.DB,
      customerId: userId,
      now: Math.floor(Date.now() / 1_000),
      limit: CUSTOMER_CARD_LIMIT,
    });
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ error: 'Gift cards are temporarily unavailable' }, { status: 503 });
  }
}
