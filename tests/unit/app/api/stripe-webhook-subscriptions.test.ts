import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { SubscriptionWebhookRuntime } from '@/app/api/webhooks/stripe/handlers/subscription-handlers';
import { Money } from '@/lib/money';

const mocks = vi.hoisted(() => ({
  reconciliationEnabled: true,
  fulfillSubscriptionInvoice: vi.fn(),
  recordTelemetry: vi.fn(),
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    commerce: { features: { subscriptionReconciliation: mocks.reconciliationEnabled } },
  }),
}));
vi.mock('@/lib/subscriptions/invoice-service', () => ({
  fulfillSubscriptionInvoice: mocks.fulfillSubscriptionInvoice,
}));
vi.mock('@/lib/observability/telemetry', () => ({
  recordTelemetry: mocks.recordTelemetry,
}));

import {
  handleSubscriptionStripeEvent,
  signedInvoiceSubscriptionId,
} from '@/app/api/webhooks/stripe/handlers/subscription-handlers';

function event(type: Stripe.Event.Type, id: string, invoiceId = 'in_ordering'): Stripe.Event {
  return {
    id,
    type,
    created: 1_786_147_205,
    data: {
      object: {
        id: invoiceId,
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: 'sub_ordering' },
        },
      },
    },
  } as Stripe.Event;
}

function runtime(options: { priorFailure?: boolean; paidOrder?: boolean } = {}) {
  const repository = {
    findAcquisitionByStripeSubscription: vi.fn(),
    findSubscriptionByStripeSubscription: vi.fn(async () => ({
      id: 'subscription-ordering',
      acquisitionId: 'acq-ordering',
      stripeSubscriptionId: 'sub_ordering',
      latestLifecycleEvent: { id: 'evt_current', createdAt: 100 },
    })),
    completeAcquisitionFromLifecycleWebhook: vi.fn(),
    compareAndApplyLifecycle: vi.fn(),
    recordSubscriptionEvent: vi.fn(async () => true),
  };
  const database = {
    prepare: vi.fn((query: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => query.includes('FROM subscription_events')
          ? options.priorFailure ? { present: 1 } : null
          : options.paidOrder ? { present: 1 } : null),
      })),
    })),
  } as unknown as D1Database;
  const provider = {
    retrieveLifecycle: vi.fn(),
    retrieveAuthoritativeLifecycle: vi.fn(),
    retrieveVerifiedInvoice: vi.fn(),
  };
  return {
    database,
    repository,
    lifecycleProvider: provider,
    invoiceProvider: provider,
  } satisfies SubscriptionWebhookRuntime;
}

beforeEach(() => {
  mocks.reconciliationEnabled = true;
  mocks.fulfillSubscriptionInvoice.mockResolvedValue({
    created: true,
    order: {
      id: 'SUB-in_ordering', status: 'processing', payment_status: 'paid',
      total_amount: Money.fromMinor(2_500).toJSON(), currency_code: 'USD', items: [],
    },
  });
});

describe('subscription Stripe webhook classification', () => {
  it('does no subscription provider or table work while reconciliation is disabled', async () => {
    mocks.reconciliationEnabled = false;
    const dependencies = runtime();
    await expect(handleSubscriptionStripeEvent(
      event('invoice.paid', 'evt_disabled'),
      dependencies,
    )).resolves.toBe('ignored');
    expect(dependencies.repository.findSubscriptionByStripeSubscription).not.toHaveBeenCalled();
    expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
  });

  it('uses only a signed invoice parent as the routing hint', () => {
    expect(signedInvoiceSubscriptionId(
      event('invoice.paid', 'evt_route').data.object as Stripe.Invoice,
    )).toBe('sub_ordering');
    expect(signedInvoiceSubscriptionId({
      id: 'in_manual',
      parent: { type: 'quote_details', quote_details: {} },
    } as Stripe.Invoice)).toBeUndefined();
  });

  it('classifies first paid, recovered, and business-duplicate invoices distinctly', async () => {
    const first = runtime();
    await expect(handleSubscriptionStripeEvent(event('invoice.paid', 'evt_paid'), first))
      .resolves.toBe('handled');
    expect(first.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'subscription-ordering',
        eventType: 'renewed',
        outcome: 'applied',
        details: { stripe_invoice_id: 'in_ordering' },
      }),
    );

    const recovered = runtime({ priorFailure: true });
    await handleSubscriptionStripeEvent(event('invoice.payment_succeeded', 'evt_recovered'), recovered);
    expect(recovered.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'payment_recovered', outcome: 'applied' }),
    );

    mocks.fulfillSubscriptionInvoice.mockResolvedValueOnce({
      created: false,
      order: {
        id: 'SUB-in_ordering', status: 'processing', payment_status: 'paid',
        total_amount: Money.fromMinor(2_500).toJSON(), currency_code: 'USD', items: [],
      },
    });
    const duplicate = runtime({ priorFailure: true });
    await handleSubscriptionStripeEvent(event('invoice.paid', 'evt_duplicate'), duplicate);
    expect(duplicate.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'renewed', outcome: 'duplicate' }),
    );
  });

  it('records failure→paid recovery and makes paid→late-failure stale by invoice identity', async () => {
    const failure = runtime();
    await expect(handleSubscriptionStripeEvent(
      event('invoice.payment_failed', 'evt_failed'),
      failure,
    )).resolves.toBe('handled');
    expect(failure.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'payment_failed', outcome: 'applied' }),
    );

    const lateFailure = runtime({ paidOrder: true });
    await handleSubscriptionStripeEvent(
      event('invoice.payment_attempt_required', 'evt_late_failure'),
      lateFailure,
    );
    expect(lateFailure.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'payment_failed', outcome: 'ignored_stale' }),
    );
  });

  it('permanently rejects a malformed signed lifecycle object and audits failure when bound', async () => {
    const dependencies = runtime();
    const malformed = event('customer.subscription.updated', 'evt_malformed');
    Object.assign(malformed.data.object, {
      id: 'sub_ordering', metadata: {}, items: { data: [] }, parent: undefined,
    });
    await expect(handleSubscriptionStripeEvent(malformed, dependencies))
      .resolves.toBe('permanent_rejection');
    expect(dependencies.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'updated', outcome: 'failed' }),
    );
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'webhook.payment_verification_rejected',
      expect.objectContaining({ operation: 'process', retryable: false }),
      expect.any(Error),
    );
  });
});
