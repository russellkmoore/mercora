import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Money } from '@/lib/money';
import { redeemCoupon } from '@/lib/models/mach/couponInstance';
import {
  hydrateOrder,
  recordCouponReconciliation,
} from '@/lib/models/mach/orders';
import { orders } from '@/lib/db/schema/order';
import {
  noOpCommerceCapabilities,
  type CommerceCapabilities,
} from '@/lib/commerce/capabilities';
import type { Order } from '@/lib/types/order';
import {
  sendMerchantOrderNotification,
  sendOrderConfirmation,
} from '@/lib/services/order-confirmation';
import { runPaidOrderInventoryEffect } from '@/lib/services/inventory-adjustments';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { subscriptionAcquisitionIdFromOrder } from '@/lib/commerce/capabilities';

const EFFECT_LEASE_MS = 5 * 60 * 1000;
const MAX_EFFECT_ERROR = 2_000;

export type OrderEffectType =
  | 'inventory'
  | 'coupon'
  | 'gift_card'
  | 'subscription'
  | 'confirmation_email'
  | 'merchant_notification';

export interface ClaimedOrderEffect {
  effect_key: string;
  order_id: string;
  effect_type: OrderEffectType;
  attempt_count: number;
  claim_token: string;
}

interface EffectDefinition {
  key: string;
  type: OrderEffectType;
}

export interface OrderEffectRuntime {
  database?: D1Database;
  capabilities?: CommerceCapabilities;
  getOrder?: (orderId: string) => Promise<Order | null>;
  redeem?: typeof redeemCoupon;
  recordCouponReconciliation?: typeof recordCouponReconciliation;
  sendConfirmation?: typeof sendOrderConfirmation;
  sendMerchantNotification?: typeof sendMerchantOrderNotification;
  runInventory?: (order: Order, effect: ClaimedOrderEffect) => Promise<unknown>;
  now?: () => Date;
}

export interface OrderEffectDrainResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

export interface StagePaidOrderEffectOptions {
  includeEmail?: boolean;
  includeGiftCard?: boolean;
  /** Renewal invoice orders suppress this to avoid recursive acquisition. */
  includeSubscription?: boolean;
  now?: Date;
}

class EffectNeedsReviewError extends Error {}

async function resolveDatabase(database?: D1Database): Promise<D1Database> {
  if (database) return database;
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function normalizedCodes(order: Order): string[] {
  const codes = order.extensions?.discount_codes;
  if (!Array.isArray(codes)) return [];
  if (codes.length > 25) throw new Error('Paid order contains too many discount codes');
  const normalized = codes.map((code) => {
    if (typeof code !== 'string' || !code.trim() || code.length > 128) {
      throw new Error('Paid order contains an invalid discount code');
    }
    return code.trim().toUpperCase();
  });
  return [...new Set(normalized)].sort();
}

function couponEffectKey(orderId: string, code: string): string {
  return `paid:${orderId}:coupon:${code}:v1`;
}

function effectDefinitions(
  order: Order,
  includeEmail: boolean,
  includeSubscription: boolean,
  includeGiftCard: boolean,
): EffectDefinition[] {
  if (!order.id) throw new Error('Cannot stage effects for an order without an id');
  const definitions: EffectDefinition[] = [
    { key: `paid:${order.id}:inventory:v1`, type: 'inventory' },
    ...normalizedCodes(order).map((code) => ({
      key: couponEffectKey(order.id!, code),
      type: 'coupon' as const,
    })),
  ];
  if (includeGiftCard) {
    definitions.push({ key: `paid:${order.id}:gift-card:v1`, type: 'gift_card' });
  }
  if (includeSubscription && subscriptionAcquisitionIdFromOrder(order)) {
    definitions.push({
      key: `paid:${order.id}:subscription:v1`,
      type: 'subscription',
    });
  }
  if (includeEmail) {
    definitions.push({
      key: `paid:${order.id}:confirmation-email:v1`,
      type: 'confirmation_email',
    });
    definitions.push({
      key: `paid:${order.id}:merchant-notification:v1`,
      type: 'merchant_notification',
    });
  }
  return definitions;
}

/**
 * Stage deterministic dormant recovery rows before the paid CAS. Effect
 * runners only claim rows whose order is authoritatively paid.
 */
export async function stagePaidOrderEffects(
  order: Order,
  options: StagePaidOrderEffectOptions & { database?: D1Database } = {}
): Promise<void> {
  const database = await resolveDatabase(options.database);
  await database.batch(preparePaidOrderEffectStatements(database, order, options));
}

/** Build effect inserts for callers that must compose them into a larger D1 batch. */
export function preparePaidOrderEffectStatements(
  database: D1Database,
  order: Order,
  options: StagePaidOrderEffectOptions = {},
): D1PreparedStatement[] {
  if (!order.id) throw new Error('Cannot stage effects for an order without an id');
  const now = (options.now ?? new Date()).toISOString();
  return effectDefinitions(
    order,
    options.includeEmail !== false,
    options.includeSubscription !== false,
    options.includeGiftCard !== false,
  ).map(({ key, type }) =>
    database.prepare(`
INSERT INTO order_effects (
  effect_key, order_id, effect_type, status, attempt_count,
  claim_token, lease_expires_at, next_attempt_at, last_error, result,
  created_at, updated_at, completed_at
) VALUES (?, ?, ?, 'pending', 0, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL)
ON CONFLICT(effect_key) DO NOTHING
`).bind(key, order.id!, type, now, now)
  );
}

const CLAIM_SQL = `
UPDATE order_effects
SET status = 'processing',
    attempt_count = attempt_count + 1,
    claim_token = ?,
    lease_expires_at = ?,
    next_attempt_at = NULL,
    last_error = NULL,
    updated_at = ?
WHERE effect_key = (
  SELECT oe.effect_key
  FROM order_effects oe
  JOIN orders o ON o.id = oe.order_id
  WHERE o.payment_status = 'paid'
    AND (? IS NULL OR oe.order_id = ?)
    AND (
      oe.status = 'pending'
      OR (oe.status = 'failed' AND oe.next_attempt_at IS NOT NULL AND oe.next_attempt_at <= ?)
      OR (oe.status = 'processing' AND oe.lease_expires_at <= ?)
    )
  ORDER BY oe.created_at, oe.effect_key
  LIMIT 1
)
RETURNING effect_key, order_id, effect_type, attempt_count, claim_token
`;

export async function claimNextOrderEffect(
  database: D1Database,
  options: {
    orderId?: string;
    now?: Date;
    claimToken?: string;
    leaseDurationMs?: number;
  } = {}
): Promise<ClaimedOrderEffect | null> {
  const now = options.now ?? new Date();
  const leaseDurationMs = options.leaseDurationMs ?? EFFECT_LEASE_MS;
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
    throw new Error('Order effect lease duration must be a positive integer');
  }
  const claimToken = options.claimToken ?? crypto.randomUUID();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
  return database.prepare(CLAIM_SQL).bind(
    claimToken,
    leaseExpiresAt,
    nowIso,
    options.orderId ?? null,
    options.orderId ?? null,
    nowIso,
    nowIso
  ).first<ClaimedOrderEffect>();
}

function findCoupon(order: Order, effectKey: string): string {
  if (!order.id) throw new Error('Coupon effect order has no id');
  const code = normalizedCodes(order).find(
    (candidate) => couponEffectKey(order.id!, candidate) === effectKey
  );
  if (!code) throw new Error('Coupon effect no longer matches the paid order');
  return code;
}

async function executeEffect(
  effect: ClaimedOrderEffect,
  order: Order,
  runtime: OrderEffectRuntime
): Promise<unknown> {
  const capabilities = runtime.capabilities ?? noOpCommerceCapabilities;
  const extensions = order.extensions ?? {};
  switch (effect.effect_type) {
    case 'inventory':
      return runtime.runInventory
        ? runtime.runInventory(order, effect)
        : runPaidOrderInventoryEffect(order, {
            database: runtime.database,
            now: runtime.now,
          });
    case 'coupon': {
      const code = findCoupon(order, effect.effect_key);
      const codes = normalizedCodes(order);
      const redeem = runtime.redeem ?? redeemCoupon;
      const redemption = await redeem(code, {
        orderId: order.id!,
        customerId: order.customer_id,
        channel: 'web',
        discountAmount: codes.length === 1
          ? Money.fromStored(extensions.checkout_discount ?? 0, order.currency_code).toMach()
          : undefined,
      });
      if (!redemption.redeemed && !redemption.alreadyRedeemed) {
        const reconcile = runtime.recordCouponReconciliation ?? recordCouponReconciliation;
        await reconcile({ orderId: order.id!, code });
        return { reconciliationRequired: true, code };
      }
      return { code, alreadyRedeemed: redemption.alreadyRedeemed === true };
    }
    case 'gift_card':
      await capabilities.giftCards.applyTender({
        order,
        state: extensions.checkout_tender_state,
      });
      return { applied: true };
    case 'subscription':
      await capabilities.subscriptions.orderPaid(order);
      return { applied: true };
    case 'confirmation_email': {
      const send = runtime.sendConfirmation ?? sendOrderConfirmation;
      const result = await send(order, `order-confirmation/${order.id}/v1`);
      if (result.needsReview) throw new EffectNeedsReviewError(result.error || 'Confirmation email requires review');
      if (!result.success) throw new Error(result.error || 'Confirmation email failed');
      return { providerId: result.id ?? null, skipped: result.skipped === true };
    }
    case 'merchant_notification': {
      const send = runtime.sendMerchantNotification ?? sendMerchantOrderNotification;
      const result = await send(order, `merchant-notification/${order.id}/v1`);
      if (result.needsReview) throw new EffectNeedsReviewError(result.error || 'Merchant notification requires review');
      if (!result.success) throw new Error(result.error || 'Merchant notification failed');
      return { providerId: result.id ?? null, skipped: result.skipped === true };
    }
  }
}

function serializeEffectResult(result: unknown): string {
  try {
    const serialized = JSON.stringify(result ?? null);
    return serialized.length <= 8_192
      ? serialized
      : JSON.stringify({ truncated: true, originalLength: serialized.length });
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

export async function completeOrderEffect(
  database: D1Database,
  effect: ClaimedOrderEffect,
  result: unknown,
  now: Date
): Promise<boolean> {
  const serialized = serializeEffectResult(result);
  const response = await database.prepare(`
UPDATE order_effects
SET status = 'succeeded',
    claim_token = NULL,
    lease_expires_at = NULL,
    next_attempt_at = NULL,
    last_error = NULL,
    result = ?,
    completed_at = ?,
    updated_at = ?
WHERE effect_key = ?
  AND status = 'processing'
  AND claim_token = ?
`).bind(
    serialized,
    now.toISOString(),
    now.toISOString(),
    effect.effect_key,
    effect.claim_token
  ).run();
  return response.meta.changes === 1;
}

export async function failOrderEffect(
  database: D1Database,
  effect: ClaimedOrderEffect,
  error: unknown,
  now: Date,
  options: { needsReview?: boolean } = {}
): Promise<boolean> {
  const delayMs = Math.min(
    6 * 60 * 60 * 1000,
    5 * 60 * 1000 * 2 ** Math.min(effect.attempt_count - 1, 10)
  );
  const nextAttemptAt = options.needsReview ? null : new Date(now.getTime() + delayMs).toISOString();
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_EFFECT_ERROR);
  const reviewResult = options.needsReview
    ? serializeEffectResult({ needsReview: true, error: message })
    : null;
  const response = await database.prepare(`
UPDATE order_effects
SET status = 'failed',
    claim_token = NULL,
    lease_expires_at = NULL,
    next_attempt_at = ?,
    last_error = ?,
    result = ?,
    updated_at = ?
WHERE effect_key = ?
  AND status = 'processing'
  AND claim_token = ?
`).bind(
    nextAttemptAt,
    message,
    reviewResult,
    now.toISOString(),
    effect.effect_key,
    effect.claim_token
  ).run();
  return response.meta.changes === 1;
}

export async function drainOrderEffects(
  options: OrderEffectRuntime & { orderId?: string; limit?: number } = {}
): Promise<OrderEffectDrainResult> {
  const database = await resolveDatabase(options.database);
  const getOrder = options.getOrder ?? (async (orderId: string) => {
    const record = await database.prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first<typeof orders.$inferSelect>();
    return record ? hydrateOrder(record) : null;
  });
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Order effect drain limit must be between 1 and 100');
  }
  const result: OrderEffectDrainResult = { claimed: 0, succeeded: 0, failed: 0 };

  for (let index = 0; index < limit; index += 1) {
    const now = options.now?.() ?? new Date();
    const effect = await claimNextOrderEffect(database, {
      orderId: options.orderId,
      now,
    });
    if (!effect) break;
    result.claimed += 1;
    try {
      const order = await getOrder(effect.order_id);
      if (!order || order.payment_status !== 'paid') {
        throw new Error('Order effect lost its paid order');
      }
      const effectResult = await executeEffect(effect, order, options);
      if (!await completeOrderEffect(database, effect, effectResult, options.now?.() ?? new Date())) {
        throw new Error('Order effect ownership expired before completion');
      }
      result.succeeded += 1;
    } catch (error) {
      const needsReview = error instanceof EffectNeedsReviewError;
      await failOrderEffect(database, effect, error, options.now?.() ?? new Date(), {
        needsReview,
      });
      recordTelemetry(
        effect.attempt_count >= 3
          ? 'paid_effect.repeated_failure'
          : 'paid_effect.first_attempt_failed',
        {
          operation: 'process', outcome: needsReview ? 'needs_review' : 'retry_scheduled',
          effect_type: effect.effect_type, attempt: effect.attempt_count,
          retryable: !needsReview, trigger: options.orderId ? 'request' : 'recovery',
        },
        error,
      );
      result.failed += 1;
    }
  }
  return result;
}
