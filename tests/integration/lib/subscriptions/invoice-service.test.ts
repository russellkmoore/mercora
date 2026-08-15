import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { Money } from '@/lib/money';
import {
  fulfillSubscriptionInvoice,
  recordSubscriptionInvoiceFailure,
  recordSubscriptionInvoiceRecovery,
  type SubscriptionInvoiceProvider,
} from '@/lib/subscriptions/invoice-service';
import type { VerifiedSubscriptionInvoice } from '@/lib/subscriptions';
import { applyTestMigrations } from '../../helpers/d1';

const invoice: VerifiedSubscriptionInvoice = {
  stripeInvoiceId: 'in_renewal_concurrent',
  stripePaymentIntentId: 'pi_renewal_concurrent',
  paidAmount: Money.fromMinor(5_000, 'USD'),
  periodStart: 1_786_147_200,
  periodEnd: 1_788_825_600,
  verifiedPaidAt: 1_786_147_205,
};

const provider: SubscriptionInvoiceProvider = {
  retrieveVerifiedInvoice: vi.fn(async () => invoice),
};

async function seedSubscription(options: { shippingRequired?: boolean; withAddress?: boolean } = {}) {
  const shippingRequired = options.shippingRequired !== false;
  const withAddress = options.withAddress ?? shippingRequired;
  await env.DB.prepare(`INSERT INTO customers (id, type, status, person)
    VALUES ('customer-renewal', 'person', 'active', ?)`)
    .bind(JSON.stringify({ email: 'renewal@example.test', full_name: 'Renewal Customer' })).run();
  await env.DB.prepare(`INSERT INTO products
    (id, name, status, fulfillment_type, created_at, updated_at)
    VALUES ('product-renewal', 'Renewal Tea', 'active', ?, ?, ?)`)
    .bind(shippingRequired ? 'physical' : 'digital', new Date().toISOString(), new Date().toISOString())
    .run();
  await env.DB.prepare(`INSERT INTO product_variants
    (id, product_id, sku, status, option_values, price, shipping_required, created_at, updated_at)
    VALUES ('variant-renewal', 'product-renewal', 'TEA-RENEW', 'active', '[]', ?, ?, ?, ?)`)
    .bind(JSON.stringify(Money.fromMinor(2_500, 'USD').toJSON()), shippingRequired ? 1 : 0,
      new Date().toISOString(), new Date().toISOString())
    .run();
  await env.DB.prepare(`INSERT INTO subscription_plans
    (id, product_id, variant_id, currency_code, unit_amount_minor, stripe_price_id,
     cadence_unit, cadence_count, is_active)
    VALUES ('plan-renewal', 'product-renewal', 'variant-renewal', 'USD', 2500,
            'price_renewal', 'month', 1, 1)`).run();
  await env.DB.prepare(`INSERT INTO subscription_provider_customers
    (customer_id, stripe_customer_id) VALUES ('customer-renewal', 'cus_renewal')`).run();
  await env.DB.prepare(`INSERT INTO subscription_acquisitions
    (id, setup_intent_id, plan_id, product_id, variant_id, currency_code,
     unit_amount_minor, stripe_price_id, cadence_unit, cadence_count,
     customer_id, stripe_customer_id, quantity, shipping_required, shipping_address,
     consent_record, status, stripe_subscription_id)
    VALUES ('acq-renewal', 'seti_renewal', 'plan-renewal', 'product-renewal',
            'variant-renewal', 'USD', 2500, 'price_renewal', 'month', 1,
            'customer-renewal', 'cus_renewal', 2, ?, ?, ?, 'completed', 'sub_renewal')`)
    .bind(
      shippingRequired ? 1 : 0,
      withAddress
        ? JSON.stringify({
            line1: '1 Main St', city: 'Denver', region: 'CO', postal_code: '80202',
            country: 'US', recipient: 'Tea Customer', email: 'tea@example.test',
          })
        : null,
      JSON.stringify({
        termsVersion: '2026-08', acceptedAt: '2026-08-01T00:00:00.000Z', source: 'checkout',
      }),
    ).run();
  await env.DB.prepare(`INSERT INTO customer_subscriptions
    (id, plan_id, customer_id, acquisition_id, stripe_subscription_id,
     stripe_customer_id, quantity, shipping_required, status, shipping_address, consent_record,
     current_period_start, current_period_end, cancel_at_period_end,
     latest_lifecycle_event_created_at, latest_lifecycle_event_id)
    SELECT 'subscription-renewal', plan_id, customer_id, id, stripe_subscription_id,
           stripe_customer_id, quantity, shipping_required, 'active', shipping_address, consent_record,
           1786147200, 1788825600, 0, 1786147200, 'evt_subscription_created'
    FROM subscription_acquisitions WHERE id = 'acq-renewal'`).run();
}

async function clearFixture(): Promise<void> {
  await env.DB.prepare(`DELETE FROM subscription_events
    WHERE subscription_id = 'subscription-renewal'`).run();
  await env.DB.prepare(`DELETE FROM order_effects
    WHERE order_id = ?`).bind(`SUB-${invoice.stripeInvoiceId}`).run();
  await env.DB.prepare(`DELETE FROM subscription_invoice_orders
    WHERE subscription_id = 'subscription-renewal'`).run();
  await env.DB.prepare(`DELETE FROM orders WHERE id = ?`)
    .bind(`SUB-${invoice.stripeInvoiceId}`).run();
  await env.DB.prepare(`DELETE FROM customer_subscriptions
    WHERE id = 'subscription-renewal'`).run();
  await env.DB.prepare(`DELETE FROM subscription_acquisitions
    WHERE id = 'acq-renewal'`).run();
  await env.DB.prepare(`DELETE FROM subscription_provider_customers
    WHERE customer_id = 'customer-renewal'`).run();
  await env.DB.prepare(`DELETE FROM subscription_plans WHERE id = 'plan-renewal'`).run();
  await env.DB.prepare(`DELETE FROM product_variants WHERE id = 'variant-renewal'`).run();
  await env.DB.prepare(`DELETE FROM products WHERE id = 'product-renewal'`).run();
  await env.DB.prepare(`DELETE FROM customers WHERE id = 'customer-renewal'`).run();
}

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.exec('DROP TRIGGER IF EXISTS reject_renewal_effect');
  await clearFixture();
  vi.mocked(provider.retrieveVerifiedInvoice).mockResolvedValue(invoice);
});

describe('subscription invoice orders in real D1', () => {
  it('converges true concurrent invoice deliveries on one paid order and staged effect set', async () => {
    await seedSubscription();
    const args = {
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    };
    const results = await Promise.all([
      fulfillSubscriptionInvoice(args),
      fulfillSubscriptionInvoice(args),
    ]);
    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(results.map(({ order }) => order.id))).toEqual(
      new Set([`SUB-${invoice.stripeInvoiceId}`]),
    );
    const counts = await env.DB.prepare(`SELECT
      (SELECT count(*) FROM orders WHERE id = ?) AS orders_count,
      (SELECT count(*) FROM subscription_invoice_orders WHERE stripe_invoice_id = ?) AS maps_count,
      (SELECT count(*) FROM order_effects WHERE order_id = ?) AS effects_count,
      (SELECT count(*) FROM order_effects WHERE order_id = ? AND effect_type = 'subscription') AS recursive_count
    `).bind(
      `SUB-${invoice.stripeInvoiceId}`,
      invoice.stripeInvoiceId,
      `SUB-${invoice.stripeInvoiceId}`,
      `SUB-${invoice.stripeInvoiceId}`,
    ).first<{
      orders_count: number; maps_count: number; effects_count: number; recursive_count: number;
    }>();
    expect(counts).toEqual({
      orders_count: 1,
      maps_count: 1,
      effects_count: 3,
      recursive_count: 0,
    });
    await expect(env.DB.prepare(`SELECT status, payment_status FROM orders WHERE id = ?`)
      .bind(`SUB-${invoice.stripeInvoiceId}`).first()).resolves.toEqual({
        status: 'processing',
        payment_status: 'paid',
      });
    const stored = await env.DB.prepare('SELECT extensions FROM orders WHERE id = ?')
      .bind(`SUB-${invoice.stripeInvoiceId}`).first<{ extensions: string }>();
    expect(JSON.parse(stored!.extensions)).toMatchObject({
      checkout_subtotal: Money.fromMinor(5_000, 'USD').toJSON(),
      checkout_catalog_subtotal: Money.fromMinor(5_000, 'USD').toJSON(),
    });
  });

  it('orders an in-flight paid delivery after failure and records one recovery across aliases', async () => {
    await seedSubscription();
    let releaseInvoice!: () => void;
    let announceInvoiceRead!: () => void;
    const invoiceRead = new Promise<void>((resolve) => { announceInvoiceRead = resolve; });
    const invoiceRelease = new Promise<void>((resolve) => { releaseInvoice = resolve; });
    const blockedProvider: SubscriptionInvoiceProvider = {
      retrieveVerifiedInvoice: vi.fn(async () => {
        announceInvoiceRead();
        await invoiceRelease;
        return invoice;
      }),
    };
    const paid = fulfillSubscriptionInvoice({
      database: env.DB,
      provider: blockedProvider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    });
    await invoiceRead;

    await expect(recordSubscriptionInvoiceFailure({
      database: env.DB,
      subscriptionId: 'subscription-renewal',
      providerEvent: { id: 'evt_failure_before_paid', createdAt: 1_786_147_204 },
      stripeInvoiceId: invoice.stripeInvoiceId,
    })).resolves.toEqual({ outcome: 'applied', notify: true });
    releaseInvoice();
    await expect(paid).resolves.toMatchObject({ created: true });

    await expect(recordSubscriptionInvoiceRecovery({
      database: env.DB,
      subscriptionId: 'subscription-renewal',
      providerEvent: { id: 'evt_invoice_paid_alias', createdAt: 1_786_147_205 },
      stripeInvoiceId: invoice.stripeInvoiceId,
    })).resolves.toEqual({ recovered: true, outcome: 'applied' });
    await expect(recordSubscriptionInvoiceRecovery({
      database: env.DB,
      subscriptionId: 'subscription-renewal',
      providerEvent: { id: 'evt_payment_succeeded_alias', createdAt: 1_786_147_206 },
      stripeInvoiceId: invoice.stripeInvoiceId,
    })).resolves.toEqual({ recovered: true, outcome: 'duplicate' });

    const decisions = await env.DB.prepare(`SELECT event_type, outcome, count(*) AS count
      FROM subscription_events
      WHERE subscription_id = 'subscription-renewal'
        AND json_extract(details, '$.stripe_invoice_id') = ?
      GROUP BY event_type, outcome ORDER BY event_type`)
      .bind(invoice.stripeInvoiceId)
      .all<{ event_type: string; outcome: string; count: number }>();
    expect(decisions.results).toEqual([
      { event_type: 'payment_failed', outcome: 'applied', count: 1 },
      { event_type: 'payment_recovered', outcome: 'applied', count: 1 },
    ]);
  });

  it('makes a failure stale when the paid invoice batch wins first', async () => {
    await seedSubscription();
    await fulfillSubscriptionInvoice({
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    });

    await expect(recordSubscriptionInvoiceFailure({
      database: env.DB,
      subscriptionId: 'subscription-renewal',
      providerEvent: { id: 'evt_failure_after_paid', createdAt: 1_786_147_206 },
      stripeInvoiceId: invoice.stripeInvoiceId,
    })).resolves.toEqual({ outcome: 'ignored_stale', notify: false });
    await expect(recordSubscriptionInvoiceRecovery({
      database: env.DB,
      subscriptionId: 'subscription-renewal',
      providerEvent: { id: 'evt_paid_no_failure', createdAt: 1_786_147_205 },
      stripeInvoiceId: invoice.stripeInvoiceId,
    })).resolves.toEqual({ recovered: false });
  });

  it('rolls back order, invoice map, and every effect when staging fails, then retries cleanly', async () => {
    await seedSubscription();
    await env.DB.prepare(`CREATE TRIGGER reject_renewal_effect
      BEFORE INSERT ON order_effects
      WHEN NEW.effect_type = 'merchant_notification'
      BEGIN SELECT RAISE(ABORT, 'renewal effect rejected'); END`).run();
    const args = {
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    };
    await expect(fulfillSubscriptionInvoice(args)).rejects.toThrow();
    await expect(env.DB.prepare(`SELECT
      (SELECT count(*) FROM orders WHERE id = ?) AS orders_count,
      (SELECT count(*) FROM subscription_invoice_orders WHERE stripe_invoice_id = ?) AS maps_count,
      (SELECT count(*) FROM order_effects WHERE order_id = ?) AS effects_count
    `).bind(
      `SUB-${invoice.stripeInvoiceId}`,
      invoice.stripeInvoiceId,
      `SUB-${invoice.stripeInvoiceId}`,
    ).first()).resolves.toEqual({ orders_count: 0, maps_count: 0, effects_count: 0 });

    await env.DB.exec('DROP TRIGGER reject_renewal_effect');
    await expect(fulfillSubscriptionInvoice(args)).resolves.toMatchObject({ created: true });
  });

  it('permits a digital renewal without shipping while retaining the exact variant binding', async () => {
    await seedSubscription({ shippingRequired: false, withAddress: false });
    const result = await fulfillSubscriptionInvoice({
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    });
    expect(result.order.shipping_address).toBeUndefined();
    expect(result.order.extensions).toMatchObject({
      email: 'renewal@example.test',
      customer_name: 'Renewal Customer',
      subscription_shipping_required: false,
    });
    expect(result.order.items).toEqual([
      expect.objectContaining({
        product_id: 'product-renewal',
        variant_id: 'variant-renewal',
        sku: 'TEA-RENEW',
        quantity: 2,
      }),
    ]);
  });

  it('fails before order persistence when the durable customer email is unavailable', async () => {
    await seedSubscription({ shippingRequired: false, withAddress: false });
    await env.DB.prepare("UPDATE customers SET person = '{}' WHERE id = 'customer-renewal'").run();
    await expect(fulfillSubscriptionInvoice({
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    })).rejects.toThrow('delivery email');
    await expect(env.DB.prepare('SELECT count(*) AS count FROM orders WHERE id = ?')
      .bind(`SUB-${invoice.stripeInvoiceId}`).first()).resolves.toEqual({ count: 0 });
  });

  it('rejects a deterministic order-id collision instead of accepting malformed winner data', async () => {
    await seedSubscription();
    await env.DB.prepare(`INSERT INTO orders
      (id, customer_id, status, total_amount, currency_code, items, payment_status, extensions)
      VALUES (?, 'customer-renewal', 'pending', ?, 'USD', '[]', 'pending', '{}')`)
      .bind(`SUB-${invoice.stripeInvoiceId}`, JSON.stringify(Money.fromMinor(1, 'USD').toJSON()))
      .run();
    await expect(fulfillSubscriptionInvoice({
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    })).rejects.toThrow();
    await expect(env.DB.prepare(`SELECT count(*) AS count FROM subscription_invoice_orders
      WHERE stripe_invoice_id = ?`).bind(invoice.stripeInvoiceId).first())
      .resolves.toEqual({ count: 0 });
  });

  it('accepts an immutable matching winner after later fulfillment and extension updates', async () => {
    await seedSubscription();
    const args = {
      database: env.DB,
      provider,
      stripeInvoiceId: invoice.stripeInvoiceId,
      stripeSubscriptionId: 'sub_renewal',
    };
    await expect(fulfillSubscriptionInvoice(args)).resolves.toMatchObject({ created: true });
    await env.DB.prepare(`UPDATE orders
      SET status = 'shipped', tracking_number = 'TRACK-1',
          extensions = json_set(extensions, '$.refunds_version', 1)
      WHERE id = ?`).bind(`SUB-${invoice.stripeInvoiceId}`).run();
    await expect(fulfillSubscriptionInvoice(args)).resolves.toMatchObject({
      created: false,
      order: { status: 'shipped', payment_status: 'paid' },
    });
  });
});
