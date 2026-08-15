import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendSubscriptionLifecycleEmail,
  subscriptionLifecycleEmailKey,
  SubscriptionLifecycleEmailRetryError,
  type SubscriptionLifecycleEmailSender,
  type SubscriptionLifecycleNotificationKind,
} from '@/lib/subscriptions/lifecycle-email';

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    identity: { name: '<Test Store>' },
    contact: {
      senderEmail: 'Test Store <orders@example.com>',
      supportEmail: 'help@example.com',
      replyToEmail: 'reply@example.com',
      postalAddress: '<1 Main Street>',
    },
    urls: { site: 'https://store.example.com' },
    commerce: { locale: 'en-US' },
  }),
}));

const customerRow = {
  person: JSON.stringify({
    email: ' Current.Customer@Example.com ',
    full_name: '<Current Customer>',
  }),
  contacts: null,
  current_period_end: 1_799_712_000,
  cancel_at: null,
};

function database(row: typeof customerRow | undefined): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({ first: vi.fn(async () => row) })),
    })),
  } as unknown as D1Database;
}

const kinds: SubscriptionLifecycleNotificationKind[] = [
  'created',
  'paused',
  'resumed',
  'cancel_scheduled',
  'canceled',
  'payment_failed',
  'payment_recovered',
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('subscription lifecycle email', () => {
  it('renders every transactional kind with bounded config-derived, escaped copy', async () => {
    const sender = vi.fn<SubscriptionLifecycleEmailSender>(async () => ({
      success: true,
      id: 'message_1',
      provider: 'resend' as const,
    }));

    for (const kind of kinds) {
      await expect(sendSubscriptionLifecycleEmail({
        database: database(customerRow),
        subscriptionId: 'subscription_local',
        deliveryScope: `evt_${kind}`,
        kind,
      }, sender)).resolves.toEqual({ status: 'sent', providerId: 'message_1' });
    }

    expect(sender).toHaveBeenCalledTimes(kinds.length);
    expect(sender.mock.calls[0]?.[0].subject).toBe(
      'Your subscription was created - <Test Store>',
    );
    expect(sender.mock.calls[0]?.[0].html).toContain('Review its current status');
    expect(sender.mock.calls[0]?.[0].html).not.toContain('is active');
    for (const [message, options] of sender.mock.calls) {
      expect(message).toMatchObject({
        from: 'Test Store <orders@example.com>',
        to: ['current.customer@example.com'],
        replyTo: 'reply@example.com',
      });
      expect(message.subject.length).toBeLessThanOrEqual(200);
      expect(message.html).toContain('&lt;Current Customer&gt;');
      expect(message.html).toContain('&lt;Test Store&gt;');
      expect(message.html).toContain('&lt;1 Main Street&gt;');
      expect(message.html).toContain('https://store.example.com/account/subscriptions');
      expect(message.html).not.toContain('sub_');
      expect(message.html).not.toContain('evt_');
      expect(message.text).not.toContain('sub_');
      expect(options.idempotencyKey).toMatch(
        /^subscription-lifecycle\/[a-z_]+\/[a-f0-9]{64}\/v1$/,
      );
      expect(options.idempotencyKey).not.toContain('evt_');
      expect(options.database).toBeDefined();
    }
  });

  it('uses a stable event-scoped key that changes by event and notification kind', async () => {
    const one = await subscriptionLifecycleEmailKey('evt_one', 'paused');
    await expect(subscriptionLifecycleEmailKey('evt_one', 'paused')).resolves.toBe(one);
    await expect(subscriptionLifecycleEmailKey('evt_two', 'paused')).resolves.not.toBe(one);
    await expect(subscriptionLifecycleEmailKey('evt_one', 'resumed')).resolves.not.toBe(one);
  });

  it('skips a missing or invalid current customer email without calling the sender', async () => {
    const sender = vi.fn();
    for (const row of [
      undefined,
      { ...customerRow, person: JSON.stringify({ full_name: 'No email' }) },
      { ...customerRow, person: '{broken' },
    ]) {
      await expect(sendSubscriptionLifecycleEmail({
        database: database(row),
        subscriptionId: 'subscription_local',
        deliveryScope: 'evt_missing',
        kind: 'created',
      }, sender)).resolves.toEqual({ status: 'skipped' });
    }
    expect(sender).not.toHaveBeenCalled();
  });

  it('retries definite failures but terminates ambiguous needs-review outcomes without leaking payloads', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const definite = vi.fn<SubscriptionLifecycleEmailSender>(async () => ({
      success: false,
      error: 'private recipient Current.Customer@Example.com provider detail',
      errorCode: 'E_PROVIDER_PRIVATE',
    }));
    const input = {
      database: database(customerRow),
      subscriptionId: 'subscription_local',
      deliveryScope: 'evt_delivery',
      kind: 'payment_failed' as const,
    };

    let thrown: unknown;
    try {
      await sendSubscriptionLifecycleEmail(input, definite);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SubscriptionLifecycleEmailRetryError);
    expect((thrown as Error).message).toBe(
      'Subscription lifecycle notification delivery must be retried',
    );
    expect((thrown as Error).message).not.toContain('Current.Customer');
    expect(consoleError).not.toHaveBeenCalled();

    const recovered = vi.fn<SubscriptionLifecycleEmailSender>(async () => ({
      success: true,
      id: 'message_retry',
      provider: 'cloudflare' as const,
    }));
    await expect(sendSubscriptionLifecycleEmail(input, recovered))
      .resolves.toEqual({ status: 'sent', providerId: 'message_retry' });
    expect(definite.mock.calls[0]?.[1].idempotencyKey).toBe(
      recovered.mock.calls[0]?.[1].idempotencyKey,
    );

    const ambiguous = vi.fn(async () => ({
      success: false,
      needsReview: true,
      error: 'accepted state unknown',
    }));
    await expect(sendSubscriptionLifecycleEmail(input, ambiguous))
      .resolves.toEqual({ status: 'needs_review' });
  });
});
