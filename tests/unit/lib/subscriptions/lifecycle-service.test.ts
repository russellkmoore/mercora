import { describe, expect, it, vi } from 'vitest';
import { Money } from '@/lib/money';
import {
  reconcileSubscriptionLifecycle,
  SubscriptionWebhookPermanentError,
  SubscriptionWebhookRetryError,
  type StoredSubscriptionLifecycle,
  type SubscriptionLifecycleProvider,
  type SubscriptionLifecycleRepository,
} from '@/lib/subscriptions/lifecycle-service';
import type {
  ProviderSubscriptionBinding,
  SubscriptionAcquisition,
  SubscriptionLifecycleSnapshot,
} from '@/lib/subscriptions';

const acquisition: SubscriptionAcquisition = {
  id: 'acq_lifecycle',
  setupIntentId: 'seti_lifecycle',
  customerId: 'customer-lifecycle',
  stripeCustomerId: 'cus_lifecycle',
  plan: {
    id: 'plan-lifecycle',
    productId: 'product-lifecycle',
    variantId: 'variant-lifecycle',
    price: Money.fromMinor(2_500, 'USD'),
    stripePriceId: 'price_lifecycle',
    cadence: { unit: 'month', count: 1 },
  },
  quantity: 2,
  shippingAddress: { line1: '1 Main St', city: 'Denver', country: 'US' },
  consent: {
    termsVersion: '2026-08',
    acceptedAt: '2026-08-01T00:00:00.000Z',
    source: 'checkout',
  },
};

const binding: ProviderSubscriptionBinding = {
  acquisitionId: acquisition.id,
  planId: acquisition.plan.id,
  stripeSubscriptionId: 'sub_lifecycle',
  stripeCustomerId: acquisition.stripeCustomerId,
  stripePriceId: acquisition.plan.stripePriceId,
  price: acquisition.plan.price,
  cadence: acquisition.plan.cadence,
  quantity: acquisition.quantity,
};

const snapshot: SubscriptionLifecycleSnapshot = {
  status: 'active',
  quantity: 2,
  currentPeriodStart: 100,
  currentPeriodEnd: 200,
  cancelAtPeriodEnd: false,
};

function stored(event = { id: 'evt_current', createdAt: 100 }): StoredSubscriptionLifecycle {
  return {
    id: 'subscription_acq_lifecycle',
    stripeSubscriptionId: binding.stripeSubscriptionId,
    acquisitionId: acquisition.id,
    latestLifecycleEvent: event,
  };
}

function runtime(options: {
  current?: StoredSubscriptionLifecycle;
  apply?: 'applied' | 'already_applied' | 'conflict';
  refreshedBinding?: ProviderSubscriptionBinding;
  refreshedSnapshot?: SubscriptionLifecycleSnapshot;
} = {}) {
  const repository: SubscriptionLifecycleRepository = {
    findAcquisitionByStripeSubscription: vi.fn(async () => ({
      acquisition,
      status: 'provider_created' as const,
      stripeSubscriptionId: binding.stripeSubscriptionId,
    })),
    findSubscriptionByStripeSubscription: vi.fn(async () => options.current),
    completeAcquisitionFromLifecycleWebhook: vi.fn(async () => ({
      id: 'subscription_acq_lifecycle',
      created: true,
    })),
    compareAndApplyLifecycle: vi.fn(async () => options.apply ?? 'applied'),
    recordSubscriptionEvent: vi.fn(async () => true),
  };
  const provider: SubscriptionLifecycleProvider = {
    retrieveLifecycle: vi.fn(async () => options.refreshedSnapshot ?? snapshot),
    retrieveAuthoritativeLifecycle: vi.fn(async () => ({
      binding: options.refreshedBinding ?? binding,
      snapshot: options.refreshedSnapshot ?? snapshot,
    })),
  };
  return { repository, provider };
}

describe('subscription lifecycle reconciliation', () => {
  it('creates the lifecycle row only from the exact signed acquisition binding', async () => {
    const dependencies = runtime();
    await expect(reconcileSubscriptionLifecycle({
      ...dependencies,
      event: { id: 'evt_created', createdAt: 100 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: snapshot,
    })).resolves.toEqual({
      subscriptionId: 'subscription_acq_lifecycle',
      decision: 'apply',
      created: true,
    });
    expect(dependencies.repository.completeAcquisitionFromLifecycleWebhook)
      .toHaveBeenCalledWith({
        acquisition,
        provider: binding,
        lifecycle: snapshot,
        lifecycleEvent: { id: 'evt_created', createdAt: 100 },
      });
  });

  it('ignores duplicate and stale signed events without provider retrieval or mutation', async () => {
    for (const event of [
      { id: 'evt_current', createdAt: 100 },
      { id: 'evt_old', createdAt: 99 },
    ]) {
      const dependencies = runtime({ current: stored() });
      const result = await reconcileSubscriptionLifecycle({
        ...dependencies,
        event,
        stripeSubscriptionId: binding.stripeSubscriptionId,
        signedBinding: binding,
        signedSnapshot: snapshot,
      });
      expect(result.decision).toBe(event.id === 'evt_current' ? 'duplicate' : 'ignored_stale');
      expect(dependencies.provider.retrieveAuthoritativeLifecycle).not.toHaveBeenCalled();
      expect(dependencies.repository.compareAndApplyLifecycle).not.toHaveBeenCalled();
    }
  });

  it('applies a newer signed snapshot without replacing its cursor with provider state', async () => {
    const dependencies = runtime({ current: stored() });
    await expect(reconcileSubscriptionLifecycle({
      ...dependencies,
      event: { id: 'evt_new', createdAt: 101 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: { ...snapshot, status: 'past_due' },
    })).resolves.toMatchObject({ decision: 'apply', created: false });
    expect(dependencies.repository.compareAndApplyLifecycle).toHaveBeenCalledWith({
      subscriptionId: 'subscription_acq_lifecycle',
      expected: { id: 'evt_current', createdAt: 100 },
      incoming: { id: 'evt_new', createdAt: 101 },
      snapshot: { ...snapshot, status: 'past_due' },
    });
  });

  it('refreshes equal-time ambiguity once and revalidates full frozen provider binding', async () => {
    const refreshed = { ...snapshot, pauseCollection: { behavior: 'void' as const } };
    const dependencies = runtime({ current: stored(), refreshedSnapshot: refreshed });
    await expect(reconcileSubscriptionLifecycle({
      ...dependencies,
      event: { id: 'evt_equal', createdAt: 100 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: snapshot,
    })).resolves.toMatchObject({ decision: 'refresh_required' });
    expect(dependencies.provider.retrieveAuthoritativeLifecycle)
      .toHaveBeenCalledWith(binding.stripeSubscriptionId);
    expect(dependencies.repository.compareAndApplyLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: { id: 'evt_equal', createdAt: 100 },
        snapshot: refreshed,
      }),
    );
  });

  it('permanently rejects a mutated price or quantity returned by equal-time refresh', async () => {
    for (const changed of [
      { ...binding, price: Money.fromMinor(2_501, 'USD') },
      { ...binding, quantity: 3 },
    ]) {
      const dependencies = runtime({
        current: stored(),
        refreshedBinding: changed,
      });
      await expect(reconcileSubscriptionLifecycle({
        ...dependencies,
        event: { id: 'evt_equal', createdAt: 100 },
        stripeSubscriptionId: binding.stripeSubscriptionId,
        signedBinding: binding,
        signedSnapshot: snapshot,
      })).rejects.toBeInstanceOf(SubscriptionWebhookPermanentError);
      expect(dependencies.repository.compareAndApplyLifecycle).not.toHaveBeenCalled();
    }
  });

  it('permanently rejects malformed authoritative provider lifecycle state', async () => {
    const dependencies = runtime({
      current: stored(),
      refreshedSnapshot: { ...snapshot, quantity: 0 },
    });
    await expect(reconcileSubscriptionLifecycle({
      ...dependencies,
      event: { id: 'evt_equal', createdAt: 100 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: snapshot,
    })).rejects.toBeInstanceOf(SubscriptionWebhookPermanentError);
    expect(dependencies.repository.compareAndApplyLifecycle).not.toHaveBeenCalled();
  });

  it('retries invoice-before-acquisition races and bounds lifecycle CAS conflicts', async () => {
    const missing = runtime();
    vi.mocked(missing.repository.findAcquisitionByStripeSubscription).mockResolvedValue(undefined);
    await expect(reconcileSubscriptionLifecycle({
      ...missing,
      event: { id: 'evt_early', createdAt: 100 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: snapshot,
    })).rejects.toBeInstanceOf(SubscriptionWebhookRetryError);

    const conflicts = runtime({ current: stored(), apply: 'conflict' });
    await expect(reconcileSubscriptionLifecycle({
      ...conflicts,
      event: { id: 'evt_new', createdAt: 101 },
      stripeSubscriptionId: binding.stripeSubscriptionId,
      signedBinding: binding,
      signedSnapshot: snapshot,
    })).rejects.toThrow('CAS attempts exhausted');
    expect(conflicts.repository.compareAndApplyLifecycle).toHaveBeenCalledTimes(5);
  });
});
