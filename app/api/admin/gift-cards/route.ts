import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';
import { actorFrom, giftCardAdminFlags, jsonError, readBoundedJsonBody } from '@/lib/gift-cards/admin-http';
import { assertGiftCardReason } from '@/lib/gift-cards/domain';
import { appendGiftCardEvent } from '@/lib/gift-cards/events';
import { resolveHonorEffective } from '@/lib/gift-cards/honor-guard';
import { listAdminGiftCardPresentations } from '@/lib/gift-cards/presentations';
import { giftCardSurfacesHidden } from '@/lib/gift-cards/visibility';
import { validateGiftCardRecipientEmail, GiftCardCustomizationValidationError } from '@/lib/gift-cards/customization';
import { issueAdminGiftCard } from '@/lib/services/gift-card-fulfillment';
import { Money } from '@/lib/money';
import { resolveStoreConfig, type Environment } from '@/lib/store-config';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1_000_000;
/** D-15: the longest of the three match forms (order id, email, suffix) an admin might search by. */
const MAX_QUERY_LENGTH = 254;

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
  const rawQ = params.get('q');
  const qDuplicate = params.getAll('q').length > 1;
  const qTooLong = typeof rawQ === 'string' && rawQ.length > MAX_QUERY_LENGTH;
  if (params.getAll('status').length > 1 || (rawStatus !== null && !status)
    || params.getAll('limit').length > 1 || params.getAll('offset').length > 1
    || limit === null || limit < 1 || offset === null
    || qDuplicate || qTooLong) {
    return NextResponse.json({ code: 'invalid_query', error: 'Invalid gift-card queue query' }, { status: 400 });
  }
  const q = rawQ !== null && rawQ.trim().length > 0 ? rawQ.trim() : undefined;
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
      q,
    });
    return NextResponse.json({ ...result, meta: { limit, offset, total: result.total } });
  } catch {
    return NextResponse.json({ code: 'gift_cards_read_failed', error: 'Gift cards are temporarily unavailable' }, { status: 503 });
  }
}

/**
 * D-07/D-13/D-19: create a card by hand with a required, audited reason. The
 * client-supplied `requestId` is what makes a double-submit converge on one
 * card — `issueAdminGiftCard` derives the new card's id from it.
 */
export async function POST(request: NextRequest) {
  const auth = await checkAdminPermissions(request);
  if (!auth.success) {
    return jsonError('unauthorized', auth.error ?? 'Admin access required', 401);
  }

  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) {
    return jsonError(bodyResult.code, bodyResult.error, bodyResult.status);
  }

  const body = bodyResult.body;
  if (typeof body !== 'object' || body === null) {
    return jsonError('invalid_body', 'Request body must be an object', 400);
  }
  const record = body as Record<string, unknown>;

  const amountMinor = record.amountMinor;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return jsonError('invalid_body', 'amountMinor must be a positive integer', 400);
  }

  const recipientEmail = record.recipientEmail;
  if (typeof recipientEmail !== 'string' || validateGiftCardRecipientEmail(recipientEmail) !== null) {
    return jsonError('invalid_body', 'A valid recipientEmail is required', 400);
  }

  const recipientName = record.recipientName;
  if (recipientName !== undefined && typeof recipientName !== 'string') {
    return jsonError('invalid_body', 'recipientName must be a string', 400);
  }

  const reason = record.reason;
  try {
    assertGiftCardReason(reason, 'gift-card admin-create reason', 500);
  } catch {
    return jsonError('invalid_body', 'A reason between 1 and 500 characters is required', 400);
  }

  const requestId = record.requestId;
  if (typeof requestId !== 'string' || requestId.trim().length === 0 || requestId.length > 128) {
    return jsonError('invalid_body', 'requestId is required', 400);
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const environment = env as unknown as Record<string, unknown> & { DB?: D1Database };
    if (!environment.DB) throw new Error('D1 binding unavailable');

    const flags = giftCardAdminFlags(environment);
    const nowSeconds = Math.floor(Date.now() / 1_000);
    if (giftCardSurfacesHidden(flags)) {
      const guardActive = await resolveHonorEffective(environment.DB, flags, nowSeconds);
      if (!guardActive) {
        return jsonError('gift_cards_unavailable', 'Gift cards are not available', 404);
      }
    }

    const currencyInput = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : undefined;
    const currency = currencyInput && /^[A-Z]{3}$/.test(currencyInput)
      ? currencyInput
      : resolveStoreConfig(environment as unknown as Environment).commerce.currency;

    const amount = Money.fromMinor(amountMinor, currency);

    let result;
    try {
      result = await issueAdminGiftCard({
        requestId,
        amount,
        recipientEmail,
        ...(typeof recipientName === 'string' && recipientName.trim() ? { recipientName } : {}),
        environment,
        now: nowSeconds,
      });
    } catch (error) {
      if (
        error instanceof RangeError
        || error instanceof TypeError
        || error instanceof GiftCardCustomizationValidationError
      ) {
        return jsonError('invalid_body', error.message, 400);
      }
      throw error;
    }

    if (result.created) {
      // D-07: the audit event carries the reason, amount, and recipient — and
      // nothing else — written once, only for a genuinely new card. An
      // idempotent retry (created: false) must not duplicate the event.
      await appendGiftCardEvent({
        giftCardId: result.giftCardId,
        eventType: 'admin_created',
        actor: actorFrom(auth),
        details: { reason, amount_minor: amountMinor, recipient_email: recipientEmail },
        createdAt: nowSeconds,
      });
    }

    return NextResponse.json(
      { giftCardId: result.giftCardId, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch {
    return jsonError('gift_cards_write_failed', 'Failed to create gift card', 503);
  }
}
