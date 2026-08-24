import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyTestMigrations } from '../../helpers/d1';
import { Money } from '@/lib/money';
import { createSubscriptionRepository } from '@/lib/subscriptions/repository';
import {
  sendSubscriptionLifecycleEmail,
  subscriptionLifecycleEmailKey,
} from '@/lib/subscriptions/lifecycle-email';

const mocks = vi.hoisted(() => ({
  database: undefined as D1Database | undefined,
  send: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      DB: mocks.database,
      EMAIL: { send: mocks.send },
    },
  })),
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: 'Lifecycle Test Store' },
    contact: {
      senderEmail: 'Lifecycle Test Store <orders@example.test>',
      supportEmail: 'help@example.test',
      replyToEmail: 'reply@example.test',
      postalAddress: '1 Main Street, Denver, CO',
    },
    urls: { site: 'https://store.example.test' },
    commerce: { locale: 'en-US' },
  }),
}));

async function seedSubscription(): Promise<string> {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO products
      (id, name, status, fulfillment_type)
      VALUES ('prod_email', 'Email Tea', 'active', 'physical')`),
    env.DB.prepare(`INSERT INTO product_variants
      (id, product_id, sku, status, option_values, price, shipping_required)
      VALUES ('var_email', 'prod_email', 'EMAIL-SKU', 'active', '[]', ?, 1)`)
      .bind(JSON.stringify({ amount: 2500, currency: 'USD' })),
    env.DB.prepare(`INSERT INTO customers (id, type, person)
      VALUES ('customer_email', 'person', ?)`)
      .bind(JSON.stringify({ email: 'customer@example.test', full_name: 'Lifecycle Customer' })),
    env.DB.prepare(`INSERT INTO subscription_plans
      (id, product_id, variant_id, currency_code, unit_amount_minor,
       stripe_price_id, cadence_unit, cadence_count, is_active)
      VALUES ('plan_email', 'prod_email', 'var_email', 'USD', 2500,
       'price_email', 'month', 1, 1)`),
  ]);
  const repository = createSubscriptionRepository(env.DB);
  const acquisition = {
    id: 'acq_email',
    setupIntentId: 'seti_email',
    customerId: 'customer_email',
    stripeCustomerId: 'cus_email',
    plan: {
      id: 'plan_email',
      productId: 'prod_email',
      variantId: 'var_email',
      price: Money.fromMinor(2500, 'USD'),
      stripePriceId: 'price_email',
      cadence: { unit: 'month' as const, count: 1 },
      shippingRequired: true,
    },
    quantity: 1,
    shippingAddress: { line1: '1 Main', city: 'Denver', country: 'US' },
    consent: {
      termsVersion: 'terms-email',
      acceptedAt: '2026-08-15T00:00:00.000Z',
      source: 'checkout' as const,
    },
  };
  const provider = {
    acquisitionId: acquisition.id,
    planId: acquisition.plan.id,
    stripeSubscriptionId: 'sub_email',
    stripeCustomerId: acquisition.stripeCustomerId,
    stripePriceId: acquisition.plan.stripePriceId,
    price: acquisition.plan.price,
    cadence: acquisition.plan.cadence,
    shippingRequired: true,
    quantity: 1,
  };
  await repository.bindProviderCustomer({
    customerId: acquisition.customerId,
    stripeCustomerId: acquisition.stripeCustomerId,
  });
  await repository.reserveAcquisition(acquisition);
  await repository.recordProviderCreated({ acquisition, provider });
  return (await repository.completeAcquisitionFromLifecycleWebhook({
    acquisition,
    provider,
    lifecycle: {
      status: 'active',
      quantity: 1,
      currentPeriodEnd: 1_799_712_000,
      cancelAtPeriodEnd: false,
    },
    lifecycleEvent: { id: 'evt_email_created', createdAt: 10 },
  })).id;
}

beforeAll(async () => {
  await applyTestMigrations();
});

beforeEach(async () => {
  Reflect.deleteProperty(process.env, 'EMAIL_PROVIDER');
  Reflect.deleteProperty(process.env, 'RESEND_API_KEY');
  mocks.database = env.DB;
  mocks.send.mockResolvedValue({ messageId: 'cf-lifecycle-message' });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_deliveries WHERE idempotency_key LIKE 'subscription-lifecycle/%'"),
    env.DB.prepare("DELETE FROM subscription_events WHERE subscription_id = 'subscription_acq_email'"),
    env.DB.prepare("DELETE FROM subscription_invoice_orders WHERE subscription_id = 'subscription_acq_email'"),
    env.DB.prepare("DELETE FROM customer_subscriptions WHERE id = 'subscription_acq_email'"),
    env.DB.prepare("DELETE FROM subscription_acquisitions WHERE id = 'acq_email'"),
    env.DB.prepare("DELETE FROM subscription_provider_customers WHERE customer_id = 'customer_email'"),
    env.DB.prepare("DELETE FROM subscription_plans WHERE id = 'plan_email'"),
    env.DB.prepare("DELETE FROM product_variants WHERE id = 'var_email'"),
    env.DB.prepare("DELETE FROM products WHERE id = 'prod_email'"),
    env.DB.prepare("DELETE FROM customers WHERE id = 'customer_email'"),
  ]);
});

describe('subscription lifecycle email through the default durable sender', () => {
  it('locks paid recovery aliases to one invoice-scoped transport delivery', async () => {
    const subscriptionId = await seedSubscription();
    const input = {
      database: env.DB,
      subscriptionId,
      deliveryScope: 'in_recovery_alias',
      kind: 'payment_recovered' as const,
    };

    await expect(sendSubscriptionLifecycleEmail(input))
      .resolves.toEqual({ status: 'sent', providerId: 'cf-lifecycle-message' });
    await expect(sendSubscriptionLifecycleEmail(input))
      .resolves.toEqual({ status: 'sent', providerId: 'cf-lifecycle-message' });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const key = await subscriptionLifecycleEmailKey('in_recovery_alias', 'payment_recovered');
    await expect(env.DB.prepare(`SELECT provider, status, provider_message_id
      FROM email_deliveries WHERE idempotency_key = ?`).bind(key).first())
      .resolves.toEqual({
        provider: 'cloudflare',
        status: 'succeeded',
        provider_message_id: 'cf-lifecycle-message',
      });
  });

  it('deduplicates one failure event retry but sends once for each distinct failed attempt alias', async () => {
    const subscriptionId = await seedSubscription();
    const attemptOne = {
      database: env.DB,
      subscriptionId,
      deliveryScope: 'evt_failure_attempt_one',
      kind: 'payment_failed' as const,
    };
    const attemptTwo = { ...attemptOne, deliveryScope: 'evt_failure_attempt_two' };

    await sendSubscriptionLifecycleEmail(attemptOne);
    await sendSubscriptionLifecycleEmail(attemptOne);
    await sendSubscriptionLifecycleEmail(attemptTwo);

    expect(mocks.send).toHaveBeenCalledTimes(2);
    const keys = await Promise.all([
      subscriptionLifecycleEmailKey(attemptOne.deliveryScope, attemptOne.kind),
      subscriptionLifecycleEmailKey(attemptTwo.deliveryScope, attemptTwo.kind),
    ]);
    expect(keys[0]).not.toBe(keys[1]);
    await expect(env.DB.prepare(`SELECT COUNT(*) AS count FROM email_deliveries
      WHERE idempotency_key IN (?, ?) AND status = 'succeeded'`)
      .bind(...keys).first()).resolves.toEqual({ count: 2 });
  });
});
