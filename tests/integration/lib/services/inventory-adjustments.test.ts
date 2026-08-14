import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  InventoryUnavailableError,
  applyClaimedInventoryAdjustment,
  assertCheckoutInventoryAvailable,
  claimNextInventoryAdjustment,
  drainInventoryAdjustments,
  stageInventoryAdjustments,
  stagePaidInventoryAdjustments,
} from '@/lib/services/inventory-adjustments';
import { drainOrderEffects, stagePaidOrderEffects } from '@/lib/services/order-effects';
import type { Order, OrderItem } from '@/lib/types/order';
import { Money } from '@/lib/money';
import { applyTestMigrations } from '../../helpers/d1';

const start = new Date('2026-08-05T20:00:00.000Z');
const productId = 'u09-inventory-product';

function line(variantId: string, quantity: number, id = `line-${variantId}`): OrderItem {
  return {
    id,
    product_id: productId,
    variant_id: variantId,
    sku: `SKU-${variantId}`,
    quantity,
    unit_price: Money.fromMinor(1_000).toJSON(),
    total_price: Money.fromMinor(1_000 * quantity).toJSON(),
    product_name: 'Inventory test product',
  };
}

function order(id: string, items: OrderItem[], paymentStatus: Order['payment_status'] = 'paid'): Order {
  return {
    id,
    status: paymentStatus === 'paid' ? 'processing' : 'pending',
    payment_status: paymentStatus,
    total_amount: Money.fromMinor(1_000).toJSON(),
    currency_code: 'USD',
    items,
    extensions: {},
  };
}

async function insertOrder(value: Order): Promise<void> {
  await env.DB.prepare(`
INSERT INTO orders (id, status, total_amount, currency_code, items, payment_status,
                    extensions, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
`).bind(
    value.id,
    value.status,
    JSON.stringify(value.total_amount),
    value.currency_code,
    JSON.stringify(value.items),
    value.payment_status,
    start.toISOString(),
    start.toISOString()
  ).run();
}

async function insertVariant(
  id: string,
  inventory: Record<string, unknown>,
  status = 'active'
): Promise<void> {
  await env.DB.prepare(`
INSERT INTO product_variants (
  id, product_id, sku, option_values, price, status, inventory, created_at, updated_at
) VALUES (?, ?, ?, '[]', ?, ?, ?, ?, ?)
`).bind(
    id,
    productId,
    `U09-${id}`,
    JSON.stringify(Money.fromMinor(1_000).toJSON()),
    status,
    JSON.stringify(inventory),
    start.toISOString(),
    start.toISOString()
  ).run();
}

async function quantity(variantId: string): Promise<number> {
  const row = await env.DB.prepare(`
SELECT json_extract(inventory, '$.quantity') AS quantity
FROM product_variants WHERE id = ?
`).bind(variantId).first<{ quantity: number }>();
  return row!.quantity;
}

async function adjustmentStatuses(): Promise<Array<{ adjustment_key: string; status: string }>> {
  const rows = await env.DB.prepare(`
SELECT adjustment_key, status FROM inventory_adjustments ORDER BY adjustment_key
`).all<{ adjustment_key: string; status: string }>();
  return rows.results;
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.exec('DROP TRIGGER IF EXISTS u09_reject_inventory_terminal');
  await env.DB.prepare("DELETE FROM inventory_adjustments WHERE order_id LIKE 'U09-%'").run();
  await env.DB.prepare("DELETE FROM order_effects WHERE order_id LIKE 'U09-%'").run();
  await env.DB.prepare("DELETE FROM orders WHERE id LIKE 'U09-%'").run();
  await env.DB.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(productId).run();
  await env.DB.prepare(`
INSERT INTO products (id, name, status, created_at, updated_at)
VALUES (?, 'Inventory test product', 'active', ?, ?)
ON CONFLICT(id) DO NOTHING
`).bind(productId, start.toISOString(), start.toISOString()).run();
});

describe('authoritative checkout inventory in real D1', () => {
  it('aggregates duplicate variant lines before the pre-charge stock check', async () => {
    await insertVariant('u09-aggregate', {
      track_inventory: true,
      quantity: 2,
      allow_backorder: false,
    });
    const items = [line('u09-aggregate', 1, 'line-a'), line('u09-aggregate', 2, 'line-b')];

    await expect(assertCheckoutInventoryAvailable(items, { database: env.DB }))
      .rejects.toEqual(expect.objectContaining<Partial<InventoryUnavailableError>>({
        variantIds: ['u09-aggregate'],
      }));

    await env.DB.prepare(`
UPDATE product_variants SET inventory = json_set(inventory, '$.quantity', 3) WHERE id = ?
`).bind('u09-aggregate').run();
    await expect(assertCheckoutInventoryAvailable(items, { database: env.DB }))
      .resolves.toBeUndefined();
  });

  it('treats untracked and backorderable variants as fulfillable', async () => {
    await insertVariant('u09-untracked', { track_inventory: false, quantity: 0 });
    await insertVariant('u09-backorder', {
      track_inventory: true,
      quantity: 0,
      allow_backorder: true,
    });

    await expect(assertCheckoutInventoryAvailable([
      line('u09-untracked', 99),
      line('u09-backorder', 4),
    ], { database: env.DB })).resolves.toBeUndefined();
  });
});

describe('durable inventory adjustments in real D1', () => {
  it('keeps paid decrements dormant until the order is authoritatively paid', async () => {
    const pending = order('U09-PENDING', [line('u09-pending', 1)], 'pending');
    await insertOrder(pending);
    await insertVariant('u09-pending', { track_inventory: true, quantity: 1 });
    await stagePaidInventoryAdjustments(pending, { database: env.DB, now: start });
    await stageInventoryAdjustments([{
      adjustmentKey: 'restock:U09-PENDING:line-u09-pending:v1',
      orderId: pending.id!,
      lineId: 'line-u09-pending',
      variantId: 'u09-pending',
      kind: 'refund_restock',
      quantity: 1,
    }], { database: env.DB, now: start });

    await expect(claimNextInventoryAdjustment(env.DB, {
      orderId: pending.id,
      claimToken: 'pending-owner',
      now: start,
    })).resolves.toBeNull();
    await expect(claimNextInventoryAdjustment(env.DB, {
      orderId: pending.id,
      kind: 'refund_restock',
      claimToken: 'pending-restock-owner',
      now: start,
    })).resolves.toBeNull();
    expect(await quantity('u09-pending')).toBe(1);

    await env.DB.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?")
      .bind(pending.id).run();
    await expect(claimNextInventoryAdjustment(env.DB, {
      orderId: pending.id,
      claimToken: 'paid-owner',
      now: start,
    })).resolves.toMatchObject({ claim_token: 'paid-owner' });
  });

  it('aggregates duplicate paid lines into one exactly-once decrement', async () => {
    const paid = order('U09-DUPLICATE', [
      line('u09-duplicate', 1, 'line-a'),
      line('u09-duplicate', 2, 'line-b'),
    ]);
    await insertOrder(paid);
    await insertVariant('u09-duplicate', { track_inventory: true, quantity: 7 });

    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });
    const staged = await env.DB.prepare(`
SELECT COUNT(*) AS count, MAX(quantity) AS quantity FROM inventory_adjustments WHERE order_id = ?
`).bind(paid.id).first<{ count: number; quantity: number }>();
    expect(staged).toEqual({ count: 1, quantity: 3 });

    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });
    expect(drained).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(await quantity('u09-duplicate')).toBe(4);
  });

  it('lets only one of two paid orders consume the last tracked unit', async () => {
    const first = order('U09-RACE-A', [line('u09-race', 1, 'line-a')]);
    const second = order('U09-RACE-B', [line('u09-race', 1, 'line-b')]);
    await insertOrder(first);
    await insertOrder(second);
    await insertVariant('u09-race', {
      track_inventory: true,
      quantity: 1,
      allow_backorder: false,
    });
    await stagePaidInventoryAdjustments(first, { database: env.DB, now: start });
    await stagePaidInventoryAdjustments(second, { database: env.DB, now: start });

    await Promise.all([
      drainInventoryAdjustments({ database: env.DB, orderId: first.id, now: () => start }),
      drainInventoryAdjustments({ database: env.DB, orderId: second.id, now: () => start }),
    ]);

    expect(await quantity('u09-race')).toBe(0);
    expect((await adjustmentStatuses()).map(({ status }) => status).sort())
      .toEqual(['needs_review', 'succeeded']);
  });

  it('uses changes() to skip untracked stock and permits negative backorders', async () => {
    const paid = order('U09-POLICY', [
      line('u09-policy-untracked', 2),
      line('u09-policy-backorder', 3),
    ]);
    await insertOrder(paid);
    await insertVariant('u09-policy-untracked', { track_inventory: false, quantity: 8 });
    await insertVariant('u09-policy-backorder', {
      track_inventory: true,
      quantity: 1,
      allow_backorder: true,
    });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });

    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });
    expect(drained).toMatchObject({ claimed: 2, succeeded: 1, skipped: 1 });
    expect(await quantity('u09-policy-untracked')).toBe(8);
    expect(await quantity('u09-policy-backorder')).toBe(-2);
  });

  it('terminals fractional tracked inventory for review without mutating it', async () => {
    const paid = order('U09-FRACTIONAL', [line('u09-fractional', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-fractional', { track_inventory: true, quantity: 1.5 });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });

    expect(drained).toMatchObject({ claimed: 1, needsReview: 1, failed: 0 });
    expect(await quantity('u09-fractional')).toBe(1.5);
    const alert = JSON.parse(String(errorLog.mock.calls[0][0]));
    expect(alert).toMatchObject({
      marker: 'commerce.telemetry.v1',
      event: 'inventory.adjustment_needs_review',
      severity: 'critical',
      fields: {
        operation: 'process', outcome: 'needs_review', effect_type: 'paid_decrement',
        attempt: 1, retryable: false, trigger: 'request',
      },
    });
    expect(JSON.stringify(alert)).not.toContain(paid.id);
    errorLog.mockRestore();
  });

  it('reports a repeated mutation failure while retaining retry state', async () => {
    const paid = order('U09-REPEATED', [line('u09-repeated', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-repeated', { track_inventory: true, quantity: 2 });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });
    await env.DB.prepare(
      'UPDATE inventory_adjustments SET attempt_count = 2 WHERE order_id = ?',
    ).bind(paid.id).run();
    await env.DB.prepare(`
CREATE TRIGGER u09_reject_inventory_terminal
BEFORE UPDATE OF status ON inventory_adjustments
WHEN NEW.status IN ('succeeded', 'skipped', 'needs_review')
BEGIN
  SELECT RAISE(ABORT, 'terminal marker rejected');
END
`).run();
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });

    expect(drained).toMatchObject({ claimed: 1, succeeded: 0, failed: 1 });
    expect(await quantity('u09-repeated')).toBe(2);
    const alert = JSON.parse(String(errorLog.mock.calls[0][0]));
    expect(alert).toMatchObject({
      marker: 'commerce.telemetry.v1',
      event: 'inventory.adjustment_repeated_failure',
      severity: 'critical',
      fields: {
        operation: 'process', outcome: 'retry_scheduled', effect_type: 'paid_decrement',
        attempt: 3, retryable: true, trigger: 'request',
      },
      error_class: 'Error',
    });
    expect(JSON.stringify(alert)).not.toContain('terminal marker rejected');
    errorLog.mockRestore();
  });

  it('terminals a safe-integer overflow for review without restocking', async () => {
    const paid = order('U09-OVERFLOW', [line('u09-overflow', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-overflow', {
      track_inventory: true,
      quantity: Number.MAX_SAFE_INTEGER,
    });
    await stageInventoryAdjustments([{
      adjustmentKey: 'restock:U09-OVERFLOW:line-u09-overflow:v1',
      orderId: paid.id!,
      lineId: 'line-u09-overflow',
      variantId: 'u09-overflow',
      kind: 'refund_restock',
      quantity: 1,
    }], { database: env.DB, now: start });

    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });

    expect(drained).toMatchObject({ claimed: 1, needsReview: 1, failed: 0 });
    expect(await quantity('u09-overflow')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('terminals malformed inventory JSON for review instead of retrying forever', async () => {
    const paid = order('U09-MALFORMED', [line('u09-malformed', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-malformed', { track_inventory: true, quantity: 2 });
    await env.DB.prepare('UPDATE product_variants SET inventory = ? WHERE id = ?')
      .bind('{malformed', 'u09-malformed').run();
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });

    const drained = await drainInventoryAdjustments({
      database: env.DB,
      orderId: paid.id,
      now: () => start,
    });

    expect(drained).toMatchObject({ claimed: 1, needsReview: 1, failed: 0 });
    const variant = await env.DB.prepare('SELECT inventory FROM product_variants WHERE id = ?')
      .bind('u09-malformed').first<{ inventory: string }>();
    expect(variant?.inventory).toBe('{malformed');
  });

  it('rejects a stale owner after takeover before its mutation batch', async () => {
    const paid = order('U09-TAKEOVER', [line('u09-takeover', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-takeover', { track_inventory: true, quantity: 2 });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });
    const stale = await claimNextInventoryAdjustment(env.DB, {
      orderId: paid.id,
      claimToken: 'owner-stale',
      leaseDurationMs: 1_000,
      now: start,
    });
    const current = await claimNextInventoryAdjustment(env.DB, {
      orderId: paid.id,
      claimToken: 'owner-current',
      leaseDurationMs: 1_000,
      now: new Date(start.getTime() + 1_001),
    });

    await expect(applyClaimedInventoryAdjustment(env.DB, stale!, start)).resolves.toBeNull();
    expect(await quantity('u09-takeover')).toBe(2);
    await expect(applyClaimedInventoryAdjustment(env.DB, current!, start)).resolves.toBe('succeeded');
    expect(await quantity('u09-takeover')).toBe(1);
  });

  it('rolls back the variant mutation if the terminal marker fails', async () => {
    const paid = order('U09-ROLLBACK', [line('u09-rollback', 1)]);
    await insertOrder(paid);
    await insertVariant('u09-rollback', { track_inventory: true, quantity: 2 });
    await stagePaidInventoryAdjustments(paid, { database: env.DB, now: start });
    const claimed = await claimNextInventoryAdjustment(env.DB, {
      orderId: paid.id,
      claimToken: 'owner-rollback',
      now: start,
    });
    await env.DB.prepare(`
CREATE TRIGGER u09_reject_inventory_terminal
BEFORE UPDATE OF status ON inventory_adjustments
WHEN OLD.adjustment_key = 'paid:U09-ROLLBACK:inventory:u09-rollback:v1'
  AND NEW.status IN ('succeeded', 'skipped', 'needs_review')
BEGIN
  SELECT RAISE(ABORT, 'terminal marker rejected');
END
`).run();

    await expect(applyClaimedInventoryAdjustment(env.DB, claimed!, start)).rejects.toThrow();
    expect(await quantity('u09-rollback')).toBe(2);
    await expect(env.DB.prepare(`
SELECT status, claim_token FROM inventory_adjustments WHERE adjustment_key = ?
`).bind(claimed!.adjustment_key).first()).resolves.toEqual({
      status: 'processing',
      claim_token: 'owner-rollback',
    });
  });

  it('restocks a sold line once across distinct refund-event convergence calls', async () => {
    const paid = order('U09-RESTOCK', [line('u09-restock', 2, 'sold-line-1')]);
    await insertOrder(paid);
    await insertVariant('u09-restock', { track_inventory: true, quantity: 0 });
    const restock = {
      adjustmentKey: 'restock:U09-RESTOCK:sold-line-1:v1',
      orderId: paid.id!,
      lineId: 'sold-line-1',
      variantId: 'u09-restock',
      kind: 'refund_restock' as const,
      quantity: 2,
    };

    await stageInventoryAdjustments([restock], { database: env.DB, now: start });
    await stageInventoryAdjustments([restock], {
      database: env.DB,
      now: new Date(start.getTime() + 1_000),
    });
    await drainInventoryAdjustments({ database: env.DB, orderId: paid.id, now: () => start });
    await drainInventoryAdjustments({ database: env.DB, orderId: paid.id, now: () => start });

    expect(await quantity('u09-restock')).toBe(2);
    expect(await adjustmentStatuses()).toEqual([
      { adjustment_key: restock.adjustmentKey, status: 'succeeded' },
    ]);
  });

  it('runs the default inventory recipient only through a paid order effect', async () => {
    const pending = order('U09-EFFECT', [line('u09-effect', 1)], 'pending');
    await insertOrder(pending);
    await insertVariant('u09-effect', { track_inventory: true, quantity: 2 });
    await stagePaidOrderEffects(pending, { database: env.DB, now: start, includeEmail: false });
    await env.DB.prepare("DELETE FROM order_effects WHERE effect_type <> 'inventory'").run();

    await expect(drainOrderEffects({
      database: env.DB,
      orderId: pending.id,
      now: () => start,
    })).resolves.toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    expect(await quantity('u09-effect')).toBe(2);

    await env.DB.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?")
      .bind(pending.id).run();
    const paid = { ...pending, status: 'processing' as const, payment_status: 'paid' as const };
    await expect(drainOrderEffects({
      database: env.DB,
      orderId: paid.id,
      getOrder: async () => paid,
      now: () => start,
    })).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(await quantity('u09-effect')).toBe(1);
  });
});
