import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { SubscriptionWebhookRuntime } from '@/app/api/webhooks/stripe/handlers/subscription-handlers';
import { Money } from '@/lib/money';
import {
  SubscriptionWebhookPermanentError,
  SubscriptionWebhookRetryError,
} from '@/lib/subscriptions/lifecycle-service';
import { subscriptionLifecycleEmailKey } from '@/lib/subscriptions/lifecycle-email';

const mocks = vi.hoisted(() => ({
  reconciliationEnabled: true,
  fulfillSubscriptionInvoice: vi.fn(),
  recordSubscriptionInvoiceFailure: vi.fn(),
  recordSubscriptionInvoiceRecovery: vi.fn(),
  recordTelemetry: vi.fn(),
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    commerce: { features: { subscriptionReconciliation: mocks.reconciliationEnabled } },
  }),
}));
vi.mock('@/lib/subscriptions/invoice-service', () => ({
  fulfillSubscriptionInvoice: mocks.fulfillSubscriptionInvoice,
  recordSubscriptionInvoiceFailure: mocks.recordSubscriptionInvoiceFailure,
  recordSubscriptionInvoiceRecovery: mocks.recordSubscriptionInvoiceRecovery,
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
  } as unknown as Stripe.Event;
}

function markInvoiceAsMercoraOwned(value: Stripe.Event): Stripe.Event {
  const invoice = value.data.object as Stripe.Invoice;
  if (invoice.parent?.type === 'subscription_details' && invoice.parent.subscription_details) {
    invoice.parent.subscription_details.metadata = {
      mercora_acquisition_id: `acq_${'a'.repeat(48)}`,
    };
  }
  return value;
}

function lifecycleEvent(
  type: Stripe.Event.Type,
  id: string,
  options: {
    created?: number;
    cancelAtPeriodEnd?: boolean;
    previousCancelAtPeriodEnd?: boolean;
    pauseCollection?: boolean;
    previousPauseCollection?: 'none' | 'paused';
    status?: Stripe.Subscription.Status;
  } = {},
): Stripe.Event {
  const cancelAtPeriodEnd = options.cancelAtPeriodEnd ?? false;
  const pauseCollection = options.pauseCollection
    ?? type === 'customer.subscription.paused';
  const previousAttributes = {
    ...(options.previousCancelAtPeriodEnd === undefined
      ? {}
      : { cancel_at_period_end: options.previousCancelAtPeriodEnd }),
    ...(options.previousPauseCollection === undefined
      ? {}
      : {
          pause_collection: options.previousPauseCollection === 'none'
            ? null
            : { behavior: 'void', resumes_at: null },
        }),
  };
  return {
    id,
    type,
    created: options.created ?? 1_786_147_205,
    data: {
      object: {
        id: 'sub_ordering',
        object: 'subscription',
        cancel_at: cancelAtPeriodEnd ? 1_788_825_600 : null,
        cancel_at_period_end: cancelAtPeriodEnd,
        canceled_at: null,
        currency: 'usd',
        customer: 'cus_ordering',
        ended_at: null,
        items: {
          object: 'list',
          data: [{
            id: 'si_ordering',
            object: 'subscription_item',
            current_period_start: 1_786_147_200,
            current_period_end: 1_788_825_600,
            price: {
              id: 'price_ordering',
              object: 'price',
              active: true,
              billing_scheme: 'per_unit',
              currency: 'usd',
              recurring: {
                interval: 'month', interval_count: 1, meter: null,
                trial_period_days: null, usage_type: 'licensed',
              },
              unit_amount: 2_500,
              unit_amount_decimal: Stripe.Decimal.from('2500'),
            },
            quantity: 1,
            subscription: 'sub_ordering',
          }],
          has_more: false,
          url: '/v1/subscription_items?subscription=sub_ordering',
        },
        metadata: {
          mercora_acquisition_id: 'acq-ordering',
          mercora_plan_id: 'plan-ordering',
        },
        pause_collection: pauseCollection
          ? { behavior: 'void', resumes_at: null }
          : null,
        status: options.status ?? 'active',
      },
      ...(Object.keys(previousAttributes).length === 0
        ? {}
        : { previous_attributes: previousAttributes }),
    },
  } as unknown as Stripe.Event;
}

function runtime(options: {
  priorFailure?: boolean;
  paidOrder?: boolean;
  notificationMarker?: 'cancel_scheduled';
  auditInserted?: boolean;
} = {}) {
  const acquisition = {
    id: 'acq-ordering',
    setupIntentId: 'seti_ordering',
    customerId: 'customer-ordering',
    stripeCustomerId: 'cus_ordering',
    plan: {
      id: 'plan-ordering', productId: 'product-ordering', variantId: 'variant-ordering',
      price: Money.fromMinor(2_500, 'USD'), stripePriceId: 'price_ordering',
      cadence: { unit: 'month' as const, count: 1 },
      shippingRequired: true,
    },
    quantity: 1,
    shippingAddress: {
      recipient: 'Ordering Customer',
      line1: '1 Main Street',
      city: 'Denver',
      region: 'CO',
      postal_code: '80202',
      country: 'US',
    },
    consent: {
      termsVersion: '2026-08', acceptedAt: '2026-08-01T00:00:00.000Z', source: 'checkout' as const,
    },
  };
  const findAcquisition = vi.fn<
    SubscriptionWebhookRuntime['repository']['findAcquisitionByStripeSubscription']
  >(async () => ({
    acquisition,
    status: 'completed',
    stripeSubscriptionId: 'sub_ordering',
  }));
  const repository = {
    findAcquisitionByStripeSubscription: findAcquisition,
    findAcquisitionById: vi.fn<
      SubscriptionWebhookRuntime['repository']['findAcquisitionById']
    >(async () => ({
      acquisition,
      status: 'completed' as const,
      stripeSubscriptionId: 'sub_ordering',
    })),
    findSubscriptionByStripeSubscription: vi.fn(async () => ({
      id: 'subscription-ordering',
      acquisitionId: 'acq-ordering',
      stripeSubscriptionId: 'sub_ordering',
      latestLifecycleEvent: { id: 'evt_current', createdAt: 100 },
    })),
    completeAcquisitionFromLifecycleWebhook: vi.fn(),
    compareAndApplyLifecycle: vi.fn(async () => 'applied' as const),
    findSubscriptionEventNotificationKind: vi.fn(async () => options.notificationMarker),
    recordSubscriptionEvent: vi.fn(async () => options.auditInserted ?? true),
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
  const lifecycleEmailSender = vi.fn<
    NonNullable<SubscriptionWebhookRuntime['lifecycleEmailSender']>
  >(async () => ({ status: 'sent' as const }));
  return {
    database,
    repository,
    lifecycleProvider: provider,
    invoiceProvider: provider,
    lifecycleEmailSender,
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
  mocks.recordSubscriptionInvoiceFailure.mockResolvedValue({
    outcome: 'applied',
    notify: true,
  });
  mocks.recordSubscriptionInvoiceRecovery.mockResolvedValue({ recovered: false });
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
    expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
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
    expect(first.lifecycleEmailSender).not.toHaveBeenCalled();

    const recovered = runtime({ priorFailure: true });
    mocks.recordSubscriptionInvoiceRecovery.mockResolvedValueOnce({
      recovered: true,
      outcome: 'applied',
    });
    await handleSubscriptionStripeEvent(event('invoice.payment_succeeded', 'evt_recovered'), recovered);
    expect(mocks.recordSubscriptionInvoiceRecovery).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionId: 'subscription-ordering',
      stripeInvoiceId: 'in_ordering',
      providerEvent: { id: 'evt_recovered', createdAt: 1_786_147_205 },
    }));
    expect(recovered.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionId: 'subscription-ordering',
      deliveryScope: 'in_ordering',
      kind: 'payment_recovered',
    }));

    mocks.fulfillSubscriptionInvoice.mockResolvedValueOnce({
      created: false,
      order: {
        id: 'SUB-in_ordering', status: 'processing', payment_status: 'paid',
        total_amount: Money.fromMinor(2_500).toJSON(), currency_code: 'USD', items: [],
      },
    });
    const duplicate = runtime({ priorFailure: true });
    mocks.recordSubscriptionInvoiceRecovery.mockResolvedValueOnce({
      recovered: true,
      outcome: 'duplicate',
    });
    await handleSubscriptionStripeEvent(event('invoice.paid', 'evt_duplicate'), duplicate);
    expect(duplicate.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      deliveryScope: 'in_ordering',
      kind: 'payment_recovered',
    }));
  });

  it('ignores unrelated paid and failed subscription invoices before provider or order work', async () => {
    for (const type of ['invoice.paid', 'invoice.payment_failed'] as const) {
      const dependencies = runtime();
      dependencies.repository.findAcquisitionByStripeSubscription.mockResolvedValue(undefined);
      await expect(handleSubscriptionStripeEvent(
        event(type, `evt_unrelated_${type}`),
        dependencies,
      )).resolves.toBe('ignored');
      expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
      expect(dependencies.repository.findSubscriptionByStripeSubscription).not.toHaveBeenCalled();
      expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
      expect(dependencies.database.prepare).not.toHaveBeenCalled();
      expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
      mocks.fulfillSubscriptionInvoice.mockClear();
    }
  });

  it('does not trust an acquisition marker outside the signed subscription parent', async () => {
    const dependencies = runtime();
    dependencies.repository.findAcquisitionByStripeSubscription.mockResolvedValue(undefined);
    const unrelated = event('invoice.paid', 'evt_untrusted_invoice_metadata');
    (unrelated.data.object as Stripe.Invoice).metadata = {
      mercora_acquisition_id: `acq_${'a'.repeat(48)}`,
    };

    await expect(handleSubscriptionStripeEvent(unrelated, dependencies))
      .resolves.toBe('ignored');
    expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
    expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
    expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
  });

  it('retries an early owned invoice until its signed acquisition mapping appears', async () => {
    for (const type of ['invoice.paid', 'invoice.payment_failed'] as const) {
      const dependencies = runtime();
      const acquisition = await dependencies.repository.findAcquisitionByStripeSubscription(
        'sub_ordering',
      );
      dependencies.repository.findAcquisitionByStripeSubscription
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(acquisition);
      dependencies.repository.findAcquisitionById.mockResolvedValue({
        ...acquisition!,
        acquisition: {
          ...acquisition!.acquisition,
          id: `acq_${'a'.repeat(48)}`,
        },
        status: 'pending',
        stripeSubscriptionId: undefined,
      });
      const owned = markInvoiceAsMercoraOwned(event(type, `evt_early_${type}`));

      await expect(handleSubscriptionStripeEvent(owned, dependencies))
        .rejects.toBeInstanceOf(SubscriptionWebhookRetryError);
      expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
      expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
      expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();

      await expect(handleSubscriptionStripeEvent(owned, dependencies)).resolves.toBe('handled');
      if (type === 'invoice.paid') {
        expect(dependencies.repository.recordSubscriptionEvent).toHaveBeenCalledTimes(1);
        expect(mocks.fulfillSubscriptionInvoice).toHaveBeenCalledTimes(1);
      } else {
        expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
        expect(mocks.recordSubscriptionInvoiceFailure).toHaveBeenCalledTimes(1);
        expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
      }
      mocks.fulfillSubscriptionInvoice.mockClear();
    }
  });

  it('ignores well-formed signed acquisition metadata with no durable local row', async () => {
    const dependencies = runtime();
    dependencies.repository.findAcquisitionByStripeSubscription.mockResolvedValue(undefined);
    dependencies.repository.findAcquisitionById.mockResolvedValue(undefined);
    const unrelated = markInvoiceAsMercoraOwned(event(
      'invoice.payment_failed',
      'evt_unrelated_well_formed_marker',
    ));

    await expect(handleSubscriptionStripeEvent(unrelated, dependencies))
      .resolves.toBe('ignored');
    expect(dependencies.repository.findAcquisitionById).toHaveBeenCalledWith(
      `acq_${'a'.repeat(48)}`,
    );
    expect(dependencies.database.prepare).not.toHaveBeenCalled();
    expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
    expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
  });

  it('permanently rejects every non-pending early-invoice acquisition state', async () => {
    const cases = [
      { status: 'provider_created' as const, stripeSubscriptionId: undefined },
      { status: 'completed' as const, stripeSubscriptionId: undefined },
      { status: 'provider_created' as const, stripeSubscriptionId: 'sub_other' },
      { status: 'completed' as const, stripeSubscriptionId: 'sub_ordering' },
      { status: 'failed' as const, stripeSubscriptionId: undefined },
    ];
    for (const durable of cases) {
      const dependencies = runtime();
      const existing = await dependencies.repository.findAcquisitionById('ignored');
      dependencies.repository.findAcquisitionByStripeSubscription.mockResolvedValue(undefined);
      dependencies.repository.findAcquisitionById.mockResolvedValue({
        ...existing!,
        acquisition: {
          ...existing!.acquisition,
          id: `acq_${'a'.repeat(48)}`,
        },
        ...durable,
      });
      const owned = markInvoiceAsMercoraOwned(event(
        'invoice.paid',
        `evt_terminal_early_${durable.status}_${durable.stripeSubscriptionId ?? 'none'}`,
      ));

      await expect(handleSubscriptionStripeEvent(owned, dependencies))
        .resolves.toBe('permanent_rejection');
      expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
      expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
      expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
      expect(mocks.recordTelemetry).toHaveBeenCalledWith(
        'webhook.payment_verification_rejected',
        expect.objectContaining({ retryable: false }),
        expect.any(SubscriptionWebhookPermanentError),
      );
      mocks.recordTelemetry.mockClear();
    }
  });

  it('permanently rejects paid and failed invoices for a terminally failed acquisition', async () => {
    for (const type of ['invoice.paid', 'invoice.payment_failed'] as const) {
      const dependencies = runtime();
      const current = await dependencies.repository.findAcquisitionByStripeSubscription(
        'sub_ordering',
      );
      dependencies.repository.findAcquisitionByStripeSubscription.mockResolvedValue({
        ...current!,
        status: 'failed',
      });
      await expect(handleSubscriptionStripeEvent(
        event(type, `evt_terminal_${type}`),
        dependencies,
      )).resolves.toBe('permanent_rejection');
      expect(mocks.fulfillSubscriptionInvoice).not.toHaveBeenCalled();
      expect(dependencies.repository.findSubscriptionByStripeSubscription).not.toHaveBeenCalled();
      expect(dependencies.repository.recordSubscriptionEvent).not.toHaveBeenCalled();
      expect(dependencies.database.prepare).not.toHaveBeenCalled();
      expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
      expect(mocks.recordTelemetry).toHaveBeenCalledWith(
        'webhook.payment_verification_rejected',
        expect.objectContaining({ operation: 'process', retryable: false }),
        expect.any(SubscriptionWebhookPermanentError),
      );
      mocks.fulfillSubscriptionInvoice.mockClear();
      mocks.recordTelemetry.mockClear();
    }
  });

  it('records failure→paid recovery and makes paid→late-failure stale by invoice identity', async () => {
    const failure = runtime();
    await expect(handleSubscriptionStripeEvent(
      event('invoice.payment_failed', 'evt_failed'),
      failure,
    )).resolves.toBe('handled');
    expect(mocks.recordSubscriptionInvoiceFailure).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionId: 'subscription-ordering',
      stripeInvoiceId: 'in_ordering',
      providerEvent: { id: 'evt_failed', createdAt: 1_786_147_205 },
    }));
    expect(failure.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      deliveryScope: 'evt_failed',
      kind: 'payment_failed',
    }));

    const lateFailure = runtime({ paidOrder: true });
    mocks.recordSubscriptionInvoiceFailure.mockResolvedValueOnce({
      outcome: 'ignored_stale',
      notify: false,
    });
    await handleSubscriptionStripeEvent(
      event('invoice.payment_attempt_required', 'evt_late_failure'),
      lateFailure,
    );
    expect(lateFailure.lifecycleEmailSender).not.toHaveBeenCalled();
  });

  it('retries the same payment-failure notification after its audit row already exists', async () => {
    const duplicate = runtime({ auditInserted: false });
    mocks.recordSubscriptionInvoiceFailure.mockResolvedValueOnce({
      outcome: 'duplicate',
      notify: true,
    });
    await expect(handleSubscriptionStripeEvent(
      event('invoice.payment_failed', 'evt_failed_email_retry'),
      duplicate,
    )).resolves.toBe('handled');
    expect(duplicate.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      deliveryScope: 'evt_failed_email_retry',
      kind: 'payment_failed',
    }));
  });

  it('uses one invoice business delivery key across recovery alias event IDs', async () => {
    mocks.recordSubscriptionInvoiceRecovery
      .mockResolvedValueOnce({ recovered: true, outcome: 'applied' })
      .mockResolvedValueOnce({ recovered: true, outcome: 'duplicate' });
    const paid = runtime();
    const succeeded = runtime();

    await handleSubscriptionStripeEvent(event('invoice.paid', 'evt_paid_alias'), paid);
    await handleSubscriptionStripeEvent(
      event('invoice.payment_succeeded', 'evt_succeeded_alias'),
      succeeded,
    );

    const scopes = [paid, succeeded].map((dependencies) => (
      dependencies.lifecycleEmailSender.mock.calls[0]?.[0].deliveryScope
    ));
    expect(scopes).toEqual(['in_ordering', 'in_ordering']);
    await expect(Promise.all(scopes.map((scope) => subscriptionLifecycleEmailKey(
      scope!,
      'payment_recovered',
    )))).resolves.toEqual([
      await subscriptionLifecycleEmailKey('in_ordering', 'payment_recovered'),
      await subscriptionLifecycleEmailKey('in_ordering', 'payment_recovered'),
    ]);
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
    expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
  });

  it('notifies only exact applied lifecycle event kinds, including a non-active creation', async () => {
    const cases = [
      ['customer.subscription.created', 'created', 'incomplete'],
      ['customer.subscription.paused', 'paused', 'active'],
      ['customer.subscription.resumed', 'resumed', 'active'],
      ['customer.subscription.deleted', 'canceled', 'canceled'],
    ] as const;
    for (const [type, kind, status] of cases) {
      const dependencies = runtime();
      await expect(handleSubscriptionStripeEvent(
        lifecycleEvent(type, `evt_${kind}`, { status }),
        dependencies,
      )).resolves.toBe('handled');
      expect(dependencies.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
        subscriptionId: 'subscription-ordering',
        deliveryScope: `evt_${kind}`,
        kind,
      }));
    }
  });

  it('persists and sends scheduled cancellation only from a signed false-to-true transition', async () => {
    const scheduled = runtime();
    await handleSubscriptionStripeEvent(lifecycleEvent(
      'customer.subscription.updated',
      'evt_cancel_scheduled',
      { cancelAtPeriodEnd: true, previousCancelAtPeriodEnd: false },
    ), scheduled);
    expect(scheduled.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'updated',
        outcome: 'applied',
        details: { notification_kind: 'cancel_scheduled' },
      }),
    );
    expect(scheduled.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'cancel_scheduled',
    }));

    const retained = runtime();
    await handleSubscriptionStripeEvent(lifecycleEvent(
      'customer.subscription.updated',
      'evt_retained_cancel',
      { cancelAtPeriodEnd: true, previousCancelAtPeriodEnd: true },
    ), retained);
    expect(retained.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
      expect.not.objectContaining({ details: expect.anything() }),
    );
    expect(retained.lifecycleEmailSender).not.toHaveBeenCalled();
  });

  it('classifies pause-collection transitions carried by subscription.updated events', async () => {
    for (const [kind, options] of [
      ['paused', { pauseCollection: true, previousPauseCollection: 'none' }],
      ['resumed', { pauseCollection: false, previousPauseCollection: 'paused' }],
    ] as const) {
      const dependencies = runtime();
      await handleSubscriptionStripeEvent(lifecycleEvent(
        'customer.subscription.updated',
        `evt_updated_${kind}`,
        options,
      ), dependencies);
      expect(dependencies.repository.recordSubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({ details: { notification_kind: kind } }),
      );
      expect(dependencies.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
        deliveryScope: `evt_updated_${kind}`,
        kind,
      }));
    }
  });

  it('recovers a scheduled-cancel email after lifecycle CAS succeeds but audit insertion fails', async () => {
    const dependencies = runtime();
    const signedEvent = lifecycleEvent(
      'customer.subscription.updated',
      'evt_cancel_retry',
      { cancelAtPeriodEnd: true, previousCancelAtPeriodEnd: false },
    );
    dependencies.repository.recordSubscriptionEvent
      .mockRejectedValueOnce(new Error('audit temporarily unavailable'));
    const keys: string[] = [];
    dependencies.lifecycleEmailSender.mockImplementation(async (input) => {
      keys.push(await subscriptionLifecycleEmailKey(input.deliveryScope, input.kind));
      return { status: 'sent' };
    });

    await expect(handleSubscriptionStripeEvent(signedEvent, dependencies))
      .rejects.toThrow('audit temporarily unavailable');
    expect(dependencies.lifecycleEmailSender).not.toHaveBeenCalled();
    dependencies.repository.findSubscriptionByStripeSubscription.mockResolvedValue({
      id: 'subscription-ordering',
      acquisitionId: 'acq-ordering',
      stripeSubscriptionId: 'sub_ordering',
      latestLifecycleEvent: { id: signedEvent.id, createdAt: signedEvent.created },
    });

    await expect(handleSubscriptionStripeEvent(signedEvent, dependencies))
      .resolves.toBe('handled');
    expect(dependencies.repository.recordSubscriptionEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: 'duplicate',
        details: { notification_kind: 'cancel_scheduled' },
      }),
    );
    expect(keys).toEqual([
      await subscriptionLifecycleEmailKey('evt_cancel_retry', 'cancel_scheduled'),
    ]);
  });

  it('uses the durable marker for duplicate cancellation retries and sends nothing for stale updates', async () => {
    const duplicate = runtime({ notificationMarker: 'cancel_scheduled' });
    duplicate.repository.findSubscriptionByStripeSubscription.mockResolvedValue({
      id: 'subscription-ordering', acquisitionId: 'acq-ordering',
      stripeSubscriptionId: 'sub_ordering',
      latestLifecycleEvent: { id: 'evt_marker_retry', createdAt: 1_786_147_205 },
    });
    await handleSubscriptionStripeEvent(lifecycleEvent(
      'customer.subscription.updated',
      'evt_marker_retry',
      { cancelAtPeriodEnd: true },
    ), duplicate);
    expect(duplicate.repository.findSubscriptionEventNotificationKind).toHaveBeenCalled();
    expect(duplicate.lifecycleEmailSender).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'cancel_scheduled',
    }));

    const stale = runtime();
    stale.repository.findSubscriptionByStripeSubscription.mockResolvedValue({
      id: 'subscription-ordering', acquisitionId: 'acq-ordering',
      stripeSubscriptionId: 'sub_ordering',
      latestLifecycleEvent: { id: 'evt_newer', createdAt: 1_786_147_206 },
    });
    await handleSubscriptionStripeEvent(lifecycleEvent(
      'customer.subscription.paused',
      'evt_stale_pause',
    ), stale);
    expect(stale.lifecycleEmailSender).not.toHaveBeenCalled();
  });
});
