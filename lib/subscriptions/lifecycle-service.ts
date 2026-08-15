import {
  assertLifecycleSnapshot,
  assertProviderSubscriptionMatchesAcquisition,
  decideLifecycleEvent,
  type LifecycleEventCursor,
  type LifecycleEventDecision,
  type ProviderSubscriptionBinding,
  type SubscriptionAcquisition,
  type SubscriptionLifecycleSnapshot,
} from '@/lib/subscriptions/domain';

const MAX_LIFECYCLE_CAS_ATTEMPTS = 5;

export class SubscriptionWebhookPermanentError extends Error {}
export class SubscriptionWebhookRetryError extends Error {}

export interface StoredSubscriptionLifecycle {
  id: string;
  stripeSubscriptionId: string;
  acquisitionId: string;
  latestLifecycleEvent: LifecycleEventCursor;
}

export interface SubscriptionLifecycleRepository {
  findAcquisitionByStripeSubscription(stripeSubscriptionId: string): Promise<{
    acquisition: SubscriptionAcquisition;
    status: 'pending' | 'provider_created' | 'completed' | 'failed';
    stripeSubscriptionId?: string;
  } | undefined>;
  findSubscriptionByStripeSubscription(
    stripeSubscriptionId: string,
  ): Promise<StoredSubscriptionLifecycle | undefined>;
  completeAcquisitionFromLifecycleWebhook(args: {
    acquisition: SubscriptionAcquisition;
    provider: ProviderSubscriptionBinding;
    lifecycle: SubscriptionLifecycleSnapshot;
    lifecycleEvent: LifecycleEventCursor;
  }): Promise<{ id: string; created: boolean }>;
  compareAndApplyLifecycle(args: {
    subscriptionId: string;
    expected: LifecycleEventCursor;
    incoming: LifecycleEventCursor;
    snapshot: SubscriptionLifecycleSnapshot;
  }): Promise<'applied' | 'already_applied' | 'conflict'>;
  recordSubscriptionEvent(args: {
    id: string;
    subscriptionId: string;
    providerEvent: LifecycleEventCursor;
    eventType:
      | 'created' | 'updated' | 'paused' | 'resumed' | 'canceled'
      | 'renewed' | 'payment_failed' | 'payment_recovered' | 'skipped';
    outcome: 'applied' | 'duplicate' | 'ignored_stale' | 'refresh_required' | 'failed';
    details?: Record<string, unknown>;
  }): Promise<boolean>;
}

export interface SubscriptionLifecycleProvider {
  retrieveLifecycle(stripeSubscriptionId: string): Promise<SubscriptionLifecycleSnapshot>;
  retrieveAuthoritativeLifecycle(stripeSubscriptionId: string): Promise<{
    binding: ProviderSubscriptionBinding;
    snapshot: SubscriptionLifecycleSnapshot;
  }>;
}

export interface ReconcileSubscriptionLifecycleArgs {
  repository: SubscriptionLifecycleRepository;
  provider: SubscriptionLifecycleProvider;
  /** Identity and time come only from the verified Stripe event envelope. */
  event: LifecycleEventCursor;
  stripeSubscriptionId: string;
  signedBinding: ProviderSubscriptionBinding;
  signedSnapshot: SubscriptionLifecycleSnapshot;
}

export interface ReconcileSubscriptionLifecycleResult {
  subscriptionId: string;
  decision: LifecycleEventDecision;
  created: boolean;
}

function assertSignedEventCursor(cursor: LifecycleEventCursor): void {
  try {
    // Reuse the domain's complete cursor validation without manufacturing a
    // provider timestamp or ordering event ids ourselves.
    decideLifecycleEvent(cursor, cursor);
  } catch (error) {
    throw new SubscriptionWebhookPermanentError('Signed lifecycle event cursor is invalid', {
      cause: error,
    });
  }
}

function assertSignedBinding(
  acquisition: SubscriptionAcquisition,
  binding: ProviderSubscriptionBinding,
  stripeSubscriptionId: string,
): void {
  try {
    if (binding.stripeSubscriptionId !== stripeSubscriptionId) {
      throw new Error('Signed subscription identity conflicts with the event object');
    }
    assertProviderSubscriptionMatchesAcquisition(acquisition, binding);
  } catch (error) {
    throw new SubscriptionWebhookPermanentError(
      'Signed provider subscription conflicts with its reserved acquisition',
      { cause: error },
    );
  }
}

async function requireAcquisition(
  repository: SubscriptionLifecycleRepository,
  stripeSubscriptionId: string,
): Promise<SubscriptionAcquisition> {
  const record = await repository.findAcquisitionByStripeSubscription(stripeSubscriptionId);
  if (!record || record.stripeSubscriptionId !== stripeSubscriptionId) {
    throw new SubscriptionWebhookRetryError(
      'Subscription lifecycle arrived before provider acquisition persistence',
    );
  }
  if (record.status === 'failed') {
    throw new SubscriptionWebhookPermanentError('Subscription acquisition is terminally failed');
  }
  return record.acquisition;
}

export async function reconcileSubscriptionLifecycle(
  args: ReconcileSubscriptionLifecycleArgs,
): Promise<ReconcileSubscriptionLifecycleResult> {
  assertSignedEventCursor(args.event);
  const acquisition = await requireAcquisition(args.repository, args.stripeSubscriptionId);
  assertSignedBinding(acquisition, args.signedBinding, args.stripeSubscriptionId);
  try {
    assertLifecycleSnapshot(args.signedSnapshot);
  } catch (error) {
    throw new SubscriptionWebhookPermanentError('Signed subscription lifecycle is invalid', {
      cause: error,
    });
  }

  for (let attempt = 0; attempt < MAX_LIFECYCLE_CAS_ATTEMPTS; attempt += 1) {
    const stored = await args.repository.findSubscriptionByStripeSubscription(
      args.stripeSubscriptionId,
    );
    if (!stored) {
      const completed = await args.repository.completeAcquisitionFromLifecycleWebhook({
        acquisition,
        provider: args.signedBinding,
        lifecycle: args.signedSnapshot,
        lifecycleEvent: args.event,
      });
      if (completed.created) {
        return {
          subscriptionId: completed.id,
          decision: 'apply',
          created: true,
        };
      }
      // A concurrent event created the row. Re-read and order our signed event
      // against that winner instead of treating creation as unconditional.
      continue;
    }
    if (stored.stripeSubscriptionId !== args.stripeSubscriptionId ||
        stored.acquisitionId !== acquisition.id) {
      throw new SubscriptionWebhookPermanentError(
        'Persisted lifecycle binding conflicts with the reserved acquisition',
      );
    }
    const decision = decideLifecycleEvent(stored.latestLifecycleEvent, args.event);
    if (decision === 'duplicate' || decision === 'ignored_stale') {
      return { subscriptionId: stored.id, decision, created: false };
    }
    let snapshot = args.signedSnapshot;
    if (decision === 'refresh_required') {
      const refreshed = await args.provider.retrieveAuthoritativeLifecycle(
        args.stripeSubscriptionId,
      );
      assertSignedBinding(acquisition, refreshed.binding, args.stripeSubscriptionId);
      snapshot = refreshed.snapshot;
    }
    assertLifecycleSnapshot(snapshot);
    const applied = await args.repository.compareAndApplyLifecycle({
      subscriptionId: stored.id,
      expected: stored.latestLifecycleEvent,
      // Even an equal-time refresh retains a signed webhook cursor; provider
      // retrieval never invents or advances lifecycle event identity.
      incoming: args.event,
      snapshot,
    });
    if (applied === 'applied') {
      return { subscriptionId: stored.id, decision, created: false };
    }
    if (applied === 'already_applied') {
      return { subscriptionId: stored.id, decision: 'duplicate', created: false };
    }
  }
  throw new SubscriptionWebhookRetryError('Subscription lifecycle CAS attempts exhausted');
}
