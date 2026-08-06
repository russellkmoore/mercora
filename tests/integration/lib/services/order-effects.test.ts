import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  claimNextOrderEffect,
  completeOrderEffect,
  drainOrderEffects,
  failOrderEffect,
  stagePaidOrderEffects,
  type ClaimedOrderEffect,
} from '@/lib/services/order-effects';
import type { Order } from '@/lib/types/order';
import { Money } from '@/lib/money';
import { applyTestMigrations } from '../../helpers/d1';

const start = new Date('2026-08-05T18:00:00.000Z');

function order(paymentStatus: Order['payment_status'] = 'pending'): Order {
  return {
    id: 'WEB-RECOVERY-1',
    customer_id: 'customer-1',
    status: paymentStatus === 'paid' ? 'processing' : 'pending',
    payment_status: paymentStatus,
    total_amount: Money.fromMinor(2_500).toJSON(),
    currency_code: 'USD',
    shipping_address: {
      line1: '1 Main St', city: 'Denver', region: 'CO', postal_code: '80202',
      country: 'US', recipient: 'Customer', email: 'customer@example.com',
    },
    items: [{
      id: 'line-1', product_id: 'product-1', variant_id: 'variant-1', sku: 'SKU-1',
      quantity: 1, unit_price: Money.fromMinor(2_000).toJSON(),
      total_price: Money.fromMinor(2_000).toJSON(), product_name: 'Product',
    }],
    extensions: {
      email: 'customer@example.com',
      discount_codes: [' save ', 'ALPHA', 'SAVE'],
      checkout_discount: Money.fromMinor(100).toJSON(),
      checkout_catalog_subtotal: Money.fromMinor(2_000).toJSON(),
      checkout_shipping: Money.fromMinor(300).toJSON(),
      checkout_tax: Money.fromMinor(200).toJSON(),
      checkout_tender: Money.zero('USD').toJSON(),
      checkout_tender_state: { reservation: 'tender-1' },
    },
  };
}

async function insertOrder(value: Order = order()): Promise<void> {
  await env.DB.prepare(`
INSERT INTO orders (
  id, customer_id, status, total_amount, currency_code, shipping_address,
  items, payment_status, extensions, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
    value.id,
    null,
    value.status,
    JSON.stringify(value.total_amount),
    value.currency_code,
    JSON.stringify(value.shipping_address),
    JSON.stringify(value.items),
    value.payment_status,
    JSON.stringify(value.extensions ?? {}),
    start.toISOString(),
    start.toISOString()
  ).run();
}

async function keepOnly(effectType: string): Promise<void> {
  await env.DB.prepare('DELETE FROM order_effects WHERE effect_type <> ?').bind(effectType).run();
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.exec('DROP TRIGGER IF EXISTS reject_subscription_effect');
  await env.DB.prepare('DELETE FROM order_effects WHERE order_id = ?')
    .bind('WEB-RECOVERY-1').run();
  await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind('WEB-RECOVERY-1').run();
});

describe('durable paid-order effects in real D1', () => {
  it('stages the complete deterministic set atomically and idempotently', async () => {
    const pending = order();
    await insertOrder(pending);

    await stagePaidOrderEffects(pending, { database: env.DB, now: start });
    await stagePaidOrderEffects(pending, { database: env.DB, now: start });
    const rows = await env.DB.prepare(`
SELECT effect_key, effect_type, status, attempt_count
FROM order_effects ORDER BY effect_key
`).all<{
      effect_key: string;
      effect_type: string;
      status: string;
      attempt_count: number;
    }>();

    expect(rows.results).toEqual([
      { effect_key: 'paid:WEB-RECOVERY-1:confirmation-email:v1', effect_type: 'confirmation_email', status: 'pending', attempt_count: 0 },
      { effect_key: 'paid:WEB-RECOVERY-1:coupon:ALPHA:v1', effect_type: 'coupon', status: 'pending', attempt_count: 0 },
      { effect_key: 'paid:WEB-RECOVERY-1:coupon:SAVE:v1', effect_type: 'coupon', status: 'pending', attempt_count: 0 },
      { effect_key: 'paid:WEB-RECOVERY-1:gift-card:v1', effect_type: 'gift_card', status: 'pending', attempt_count: 0 },
      { effect_key: 'paid:WEB-RECOVERY-1:inventory:v1', effect_type: 'inventory', status: 'pending', attempt_count: 0 },
      { effect_key: 'paid:WEB-RECOVERY-1:subscription:v1', effect_type: 'subscription', status: 'pending', attempt_count: 0 },
    ]);

    await env.DB.prepare(`
CREATE TRIGGER reject_subscription_effect
BEFORE INSERT ON order_effects
WHEN NEW.effect_type = 'subscription'
BEGIN
  SELECT RAISE(ABORT, 'subscription staging failed');
END
`).run();
    await env.DB.exec('DELETE FROM order_effects');
    await expect(stagePaidOrderEffects(pending, {
      database: env.DB,
      now: new Date(start.getTime() + 1_000),
    })).rejects.toThrow();
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM order_effects')
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it('keeps pre-CAS rows dormant and claims them only after authoritative paid state', async () => {
    const pending = order();
    await insertOrder(pending);
    await stagePaidOrderEffects(pending, { database: env.DB, now: start });

    await expect(claimNextOrderEffect(env.DB, {
      orderId: pending.id,
      now: start,
      claimToken: 'owner-pending',
    })).resolves.toBeNull();

    await env.DB.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?")
      .bind(pending.id).run();
    await expect(claimNextOrderEffect(env.DB, {
      orderId: pending.id,
      now: start,
      claimToken: 'owner-paid',
    })).resolves.toMatchObject({ claim_token: 'owner-paid', attempt_count: 1 });
  });

  it('serializes concurrent claims and rejects a stale owner after lease takeover', async () => {
    const paid = order('paid');
    await insertOrder(paid);
    await stagePaidOrderEffects(paid, { database: env.DB, now: start, includeEmail: false });
    await keepOnly('inventory');

    const concurrent = await Promise.all([
      claimNextOrderEffect(env.DB, { now: start, claimToken: 'owner-a', leaseDurationMs: 1_000 }),
      claimNextOrderEffect(env.DB, { now: start, claimToken: 'owner-b', leaseDurationMs: 1_000 }),
    ]);
    expect(concurrent.filter(Boolean)).toHaveLength(1);
    const stale = concurrent.find(Boolean)!;
    const current = await claimNextOrderEffect(env.DB, {
      now: new Date(start.getTime() + 1_001),
      claimToken: 'owner-current',
      leaseDurationMs: 1_000,
    });
    expect(current).toMatchObject({ claim_token: 'owner-current', attempt_count: 2 });

    await expect(completeOrderEffect(env.DB, stale, { late: true }, new Date(start.getTime() + 1_002)))
      .resolves.toBe(false);
    await expect(failOrderEffect(env.DB, stale, new Error('late'), new Date(start.getTime() + 1_002)))
      .resolves.toBe(false);
    await expect(completeOrderEffect(env.DB, current!, { applied: true }, new Date(start.getTime() + 1_003)))
      .resolves.toBe(true);
    const row = await env.DB.prepare(`
SELECT status, attempt_count, claim_token, result FROM order_effects
`).first<{ status: string; attempt_count: number; claim_token: string | null; result: string }>();
    expect(row).toEqual({
      status: 'succeeded',
      attempt_count: 2,
      claim_token: null,
      result: JSON.stringify({ applied: true }),
    });
  });

  it('uses five-minute exponential retry and caps long-lived attempts at six hours', async () => {
    const paid = order('paid');
    await insertOrder(paid);
    await stagePaidOrderEffects(paid, { database: env.DB, now: start, includeEmail: false });
    await keepOnly('inventory');
    const first = await claimNextOrderEffect(env.DB, {
      now: start,
      claimToken: 'owner-first',
    });
    expect(first).not.toBeNull();
    await failOrderEffect(env.DB, first!, new Error('temporary'), start);
    const retryRow = await env.DB.prepare(`
SELECT status, next_attempt_at, last_error FROM order_effects
`).first<{ status: string; next_attempt_at: string; last_error: string }>();
    expect(retryRow).toEqual({
      status: 'failed',
      next_attempt_at: new Date(start.getTime() + 5 * 60 * 1_000).toISOString(),
      last_error: 'temporary',
    });
    await expect(claimNextOrderEffect(env.DB, {
      now: new Date(start.getTime() + 5 * 60 * 1_000 - 1),
      claimToken: 'too-early',
    })).resolves.toBeNull();

    await env.DB.prepare(`
UPDATE order_effects
SET status = 'processing', attempt_count = 99, claim_token = 'owner-old',
    lease_expires_at = ?, next_attempt_at = NULL
`).bind(new Date(start.getTime() + 60_000).toISOString()).run();
    const old: ClaimedOrderEffect = {
      ...first!,
      attempt_count: 99,
      claim_token: 'owner-old',
    };
    await failOrderEffect(env.DB, old, new Error('still failing'), start);
    const capped = await env.DB.prepare('SELECT next_attempt_at FROM order_effects')
      .first<{ next_attempt_at: string }>();
    expect(capped?.next_attempt_at).toBe(
      new Date(start.getTime() + 6 * 60 * 60 * 1_000).toISOString()
    );
  });

  it('recovers stage→paid→skipped-inline work and invokes every idempotent recipient', async () => {
    const pending = order();
    const paid = order('paid');
    await insertOrder(pending);
    await stagePaidOrderEffects(pending, { database: env.DB, now: start });
    await env.DB.prepare("UPDATE orders SET payment_status = 'paid', status = 'processing' WHERE id = ?")
      .bind(pending.id).run();

    const runInventory = vi.fn(async (_order: Order, effect: ClaimedOrderEffect) => ({
      adjustment: effect.effect_key,
    }));
    const redeem = vi.fn(async () => ({ redeemed: true, alreadyRedeemed: false }));
    const applyTender = vi.fn(async () => undefined);
    const orderPaid = vi.fn(async () => undefined);
    const sendConfirmation = vi.fn(async () => ({ success: true, id: 'email-1' }));
    const result = await drainOrderEffects({
      database: env.DB,
      getOrder: vi.fn(async () => paid),
      runInventory,
      redeem,
      capabilities: {
        giftCards: {
          resolveTender: vi.fn(),
          verifyReservedTender: vi.fn(),
          applyTender,
        },
        subscriptions: { validateCheckout: vi.fn(), orderPaid },
      },
      sendConfirmation,
      now: () => new Date(start.getTime() + 1_000),
      limit: 25,
    });

    expect(result).toEqual({ claimed: 6, succeeded: 6, failed: 0 });
    expect(runInventory).toHaveBeenCalledOnce();
    expect(redeem).toHaveBeenCalledTimes(2);
    expect(applyTender).toHaveBeenCalledOnce();
    expect(orderPaid).toHaveBeenCalledOnce();
    expect(sendConfirmation).toHaveBeenCalledWith(
      paid,
      'order-confirmation/WEB-RECOVERY-1/v1'
    );
    const statuses = await env.DB.prepare('SELECT DISTINCT status FROM order_effects')
      .all<{ status: string }>();
    expect(statuses.results).toEqual([{ status: 'succeeded' }]);
  });

  it('records coupon reconciliation, queues email retry, and terminals missing inventory for review', async () => {
    const paid = order('paid');
    paid.extensions!.discount_codes = ['SAVE'];
    await insertOrder(paid);
    await stagePaidOrderEffects(paid, { database: env.DB, now: start });
    await env.DB.prepare(
      "DELETE FROM order_effects WHERE effect_type NOT IN ('coupon','inventory','confirmation_email')"
    ).run();
    const reconcile = vi.fn(async () => undefined);
    const result = await drainOrderEffects({
      database: env.DB,
      getOrder: vi.fn(async () => paid),
      redeem: vi.fn(async () => ({ redeemed: false, alreadyRedeemed: false })),
      recordCouponReconciliation: reconcile,
      sendConfirmation: vi.fn(async () => ({ success: false, error: 'provider unavailable' })),
      now: () => start,
      limit: 10,
    });

    expect(result).toEqual({ claimed: 3, succeeded: 2, failed: 1 });
    expect(reconcile).toHaveBeenCalledWith({ orderId: paid.id, code: 'SAVE' });
    const rows = await env.DB.prepare(`
SELECT effect_type, status, next_attempt_at, last_error
FROM order_effects ORDER BY effect_type
`).all<{
      effect_type: string;
      status: string;
      next_attempt_at: string | null;
      last_error: string | null;
    }>();
    expect(rows.results).toEqual([
      { effect_type: 'confirmation_email', status: 'failed', next_attempt_at: new Date(start.getTime() + 300_000).toISOString(), last_error: 'provider unavailable' },
      { effect_type: 'coupon', status: 'succeeded', next_attempt_at: null, last_error: null },
      { effect_type: 'inventory', status: 'succeeded', next_attempt_at: null, last_error: null },
    ]);
    const adjustment = await env.DB.prepare(`
SELECT status, result FROM inventory_adjustments WHERE order_id = ?
`).bind(paid.id).first<{ status: string; result: string }>();
    expect(adjustment).toMatchObject({ status: 'needs_review' });
    expect(JSON.parse(adjustment!.result)).toMatchObject({
      outcome: 'needs_review',
      variantId: 'variant-1',
    });
  });
});
