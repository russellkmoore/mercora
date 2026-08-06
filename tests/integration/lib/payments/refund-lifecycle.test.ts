import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  applyRefundLifecycleToOrder,
  readExternalRestockEnabled,
} from '@/app/api/webhooks/stripe/handlers/refund-handlers';
import { drainInventoryAdjustments } from '@/lib/services/inventory-adjustments';
import { applyTestMigrations } from '../../helpers/d1';

const now = new Date('2026-08-06T20:00:00.000Z');
const productId = 'u09-refund-lifecycle-product';
const variantId = 'u09-refund-lifecycle-variant';
const paymentIntentId = 'pi_u09_lifecycle';

async function insertOrder(orderId: string, refunds: Array<Record<string, unknown>>): Promise<void> {
  const items = [{
    id: 'line-returned', product_id: productId, variant_id: variantId,
    sku: 'U09-REFUND', quantity: 2,
    unit_price: { amount: 500, currency: 'USD' },
    total_price: { amount: 1_000, currency: 'USD' },
    product_name: 'Refund lifecycle product',
  }];
  await env.DB.prepare(`
INSERT INTO orders (
  id, status, total_amount, currency_code, items, payment_status,
  external_references, extensions, created_at, updated_at
) VALUES (?, 'processing', ?, 'USD', ?, 'paid', ?, ?, ?, ?)
`).bind(
    orderId,
    JSON.stringify({ amount: 1_000, currency: 'USD' }),
    JSON.stringify(items),
    JSON.stringify({ payment_intent_id: paymentIntentId }),
    JSON.stringify({ payment_intent_id: paymentIntentId, refunds, refunds_version: 0 }),
    now.toISOString(),
    now.toISOString()
  ).run();
}

async function inventoryQuantity(): Promise<number> {
  const row = await env.DB.prepare(`
SELECT json_extract(inventory, '$.quantity') AS quantity
FROM product_variants WHERE id = ?
`).bind(variantId).first<{ quantity: number }>();
  return row!.quantity;
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare(`
UPDATE admin_settings SET value = 'false' WHERE key = 'refund.external_full_restock_enabled'
`).run();
  await env.DB.exec('DROP TRIGGER IF EXISTS u09_reject_refund_restock_insert');
  await env.DB.prepare("DELETE FROM inventory_adjustments WHERE order_id LIKE 'U09-LIFECYCLE-%'").run();
  await env.DB.prepare("DELETE FROM orders WHERE id LIKE 'U09-LIFECYCLE-%'").run();
  await env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run();
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
  await env.DB.prepare(`
INSERT INTO products (id, name, status, created_at, updated_at)
VALUES (?, 'Refund lifecycle product', 'active', ?, ?)
`).bind(productId, now.toISOString(), now.toISOString()).run();
  await env.DB.prepare(`
INSERT INTO product_variants (
  id, product_id, sku, option_values, price, status, inventory, created_at, updated_at
) VALUES (?, ?, 'U09-REFUND', '[]', ?, 'active', ?, ?, ?)
`).bind(
    variantId,
    productId,
    JSON.stringify({ amount: 500, currency: 'USD' }),
    JSON.stringify({ track_inventory: true, quantity: 0, allow_backorder: false }),
    now.toISOString(),
    now.toISOString()
  ).run();
});

describe('refund lifecycle persistence in real D1', () => {
  it('defaults external restock off and fails closed for malformed settings', async () => {
    await expect(readExternalRestockEnabled(env.DB)).resolves.toBe(false);
    await env.DB.prepare(`
UPDATE admin_settings SET value = '"yes"' WHERE key = 'refund.external_full_restock_enabled'
`).run();
    await expect(readExternalRestockEnabled(env.DB)).rejects.toThrow('must be boolean');
  });

  it('rejects a provider currency that conflicts with the bound order', async () => {
    const orderId = 'U09-LIFECYCLE-CURRENCY';
    await insertOrder(orderId, [{
      idempotency_key: 'request-currency', amount: 1_000, type: 'full',
      items: [], status: 'pending',
    }]);

    await expect(applyRefundLifecycleToOrder({
      database: env.DB,
      paymentIntentId,
      providerCurrency: 'EUR',
      providerRefunds: [{
        id: 're_currency', amount: 1_000, status: 'succeeded',
        paymentIntentId, requestId: 'request-currency',
      }],
      chargeAmountRefunded: 1_000,
      mode: 'charge',
      externalRestockEnabled: false,
      now: () => now,
    })).rejects.toThrow('order currency');
  });

  it('settles and stages one line exactly once across distinct refund events', async () => {
    const orderId = 'U09-LIFECYCLE-CONVERGE';
    await insertOrder(orderId, [
      {
        idempotency_key: 'request-a', amount: 400, type: 'partial',
        items: ['line-returned'], status: 'pending',
      },
      {
        idempotency_key: 'request-b', amount: 600, type: 'partial',
        items: ['line-returned'], status: 'pending',
      },
    ]);
    const first = {
      id: 're_a', amount: 400, status: 'succeeded',
      paymentIntentId, requestId: 'request-a',
    };
    const second = {
      id: 're_b', amount: 600, status: 'succeeded',
      paymentIntentId, requestId: 'request-b',
    };

    await applyRefundLifecycleToOrder({
      database: env.DB,
      paymentIntentId,
      providerCurrency: 'USD',
      providerRefunds: [first],
      chargeAmountRefunded: 400,
      mode: 'charge',
      externalRestockEnabled: false,
      now: () => now,
    });
    await applyRefundLifecycleToOrder({
      database: env.DB,
      paymentIntentId,
      providerCurrency: 'USD',
      providerRefunds: [first, second],
      chargeAmountRefunded: 1_000,
      mode: 'charge',
      externalRestockEnabled: false,
      now: () => new Date(now.getTime() + 1_000),
    });

    const adjustment = await env.DB.prepare(`
SELECT adjustment_key, status, quantity FROM inventory_adjustments WHERE order_id = ?
`).bind(orderId).all<{ adjustment_key: string; status: string; quantity: number }>();
    expect(adjustment.results).toEqual([{
      adjustment_key: `restock:${orderId}:line-returned:v1`,
      status: 'pending',
      quantity: 2,
    }]);
    expect(await inventoryQuantity()).toBe(0);

    const drained = await drainInventoryAdjustments({
      database: env.DB, orderId, kind: 'refund_restock', now: () => now,
    });
    expect(drained).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(await inventoryQuantity()).toBe(2);
    const order = await env.DB.prepare(
      'SELECT status, payment_status FROM orders WHERE id = ?'
    ).bind(orderId).first<{ status: string; payment_status: string }>();
    expect(order).toEqual({ status: 'cancelled', payment_status: 'refunded' });
  });

  it('rolls back ledger settlement when its restock insert cannot commit', async () => {
    const orderId = 'U09-LIFECYCLE-ATOMIC';
    await insertOrder(orderId, [{
      idempotency_key: 'request-atomic', amount: 1_000, type: 'full',
      items: [], status: 'pending',
    }]);
    await env.DB.prepare(`
CREATE TRIGGER u09_reject_refund_restock_insert
BEFORE INSERT ON inventory_adjustments
WHEN NEW.order_id = 'U09-LIFECYCLE-ATOMIC'
BEGIN
  SELECT RAISE(ABORT, 'restock insert rejected');
END
`).run();

    await expect(applyRefundLifecycleToOrder({
      database: env.DB,
      paymentIntentId,
      providerCurrency: 'USD',
      providerRefunds: [{
        id: 're_atomic', amount: 1_000, status: 'succeeded',
        paymentIntentId, requestId: 'request-atomic',
      }],
      chargeAmountRefunded: 1_000,
      mode: 'charge',
      externalRestockEnabled: false,
      now: () => now,
    })).rejects.toThrow('restock insert rejected');

    const order = await env.DB.prepare(
      'SELECT payment_status, extensions FROM orders WHERE id = ?'
    ).bind(orderId).first<{ payment_status: string; extensions: string }>();
    expect(order?.payment_status).toBe('paid');
    expect(JSON.parse(order!.extensions)).toMatchObject({
      refunds_version: 0,
      refunds: [{ status: 'pending' }],
    });
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM inventory_adjustments WHERE order_id = ?'
    ).bind(orderId).first<{ count: number }>();
    expect(count?.count).toBe(0);
  });
});
