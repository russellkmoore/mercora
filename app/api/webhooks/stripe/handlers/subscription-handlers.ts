import { getCloudflareContext } from '@opennextjs/cloudflare';
import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import {
  mapProviderSubscriptionBinding,
  mapSubscriptionLifecycle,
} from '@/lib/subscriptions/stripe-mappers';
import { createStripeSubscriptionAdapter } from '@/lib/subscriptions/stripe-provider';
import { createSubscriptionRepository } from '@/lib/subscriptions/repository';
import {
  reconcileSubscriptionLifecycle,
  SubscriptionWebhookPermanentError,
  SubscriptionWebhookRetryError,
  type SubscriptionLifecycleProvider,
  type SubscriptionLifecycleRepository,
} from '@/lib/subscriptions/lifecycle-service';
import {
  fulfillSubscriptionInvoice,
  type SubscriptionInvoiceProvider,
} from '@/lib/subscriptions/invoice-service';
import type { WebhookEventOutcome } from '@/lib/webhooks/processed-events';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { getStoreConfig } from '@/lib/store-config';
import {
  sendSubscriptionLifecycleEmail,
  type SubscriptionLifecycleEmailInput,
  type SubscriptionLifecycleEmailResult,
  type SubscriptionLifecycleNotificationKind,
  type SubscriptionLifecycleNotificationRepository,
} from '@/lib/subscriptions/lifecycle-email';

const LIFECYCLE_EVENT_TYPES = new Set<Stripe.Event.Type>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
]);

export interface SubscriptionWebhookRuntime {
  database: D1Database;
  repository: SubscriptionLifecycleRepository
    & SubscriptionLifecycleNotificationRepository
    & Pick<ReturnType<typeof createSubscriptionRepository>, 'findAcquisitionById'>;
  lifecycleProvider: SubscriptionLifecycleProvider;
  invoiceProvider: SubscriptionInvoiceProvider;
  lifecycleEmailSender?: (
    input: SubscriptionLifecycleEmailInput,
  ) => Promise<SubscriptionLifecycleEmailResult>;
}

async function resolveRuntime(): Promise<SubscriptionWebhookRuntime> {
  const { env } = await getCloudflareContext({ async: true });
  const provider = createStripeSubscriptionAdapter(getStripeClient());
  return {
    database: env.DB,
    repository: createSubscriptionRepository(env.DB),
    lifecycleProvider: provider,
    invoiceProvider: provider,
  };
}

function expandableId(value: string | { id: string } | null | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return value?.id;
}

/** Read only a routing hint from the signed event; provider retrieval re-verifies it. */
export function signedInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  if (invoice.parent?.type !== 'subscription_details') return undefined;
  const subscriptionId = expandableId(invoice.parent.subscription_details?.subscription);
  if (!/^sub_[^\s]{1,251}$/.test(subscriptionId ?? '')) {
    throw new SubscriptionWebhookPermanentError('Signed invoice has an invalid subscription binding');
  }
  return subscriptionId;
}

/** Signed subscription-parent metadata distinguishes an owned persistence race. */
function signedInvoiceAcquisitionId(invoice: Stripe.Invoice): string | undefined {
  if (invoice.parent?.type !== 'subscription_details') return undefined;
  const value = invoice.parent.subscription_details?.metadata?.mercora_acquisition_id;
  return typeof value === 'string' && /^acq_[a-f0-9]{48}$/.test(value)
    ? value
    : undefined;
}

async function requireMappedInvoiceAcquisition(
  invoice: Stripe.Invoice,
  stripeSubscriptionId: string,
  repository: SubscriptionWebhookRuntime['repository'],
): Promise<NonNullable<Awaited<ReturnType<
  SubscriptionLifecycleRepository['findAcquisitionByStripeSubscription']
>>> | undefined> {
  const acquisition = await repository.findAcquisitionByStripeSubscription(
    stripeSubscriptionId,
  );
  if (acquisition) return acquisition;
  const signedAcquisitionId = signedInvoiceAcquisitionId(invoice);
  if (!signedAcquisitionId) return undefined;
  const durable = await repository.findAcquisitionById(signedAcquisitionId);
  if (!durable) return undefined;
  if (durable.acquisition.id === signedAcquisitionId
    && durable.status === 'pending'
    && durable.stripeSubscriptionId === undefined) {
    throw new SubscriptionWebhookRetryError(
      'Subscription invoice arrived before provider acquisition persistence',
    );
  }
  throw new SubscriptionWebhookPermanentError(
    'Signed invoice acquisition conflicts with durable provider ownership',
  );
}

function assertSignedInvoiceId(invoiceId: string): void {
  if (!/^in_[^\s]{1,252}$/.test(invoiceId)) {
    throw new SubscriptionWebhookPermanentError('Signed invoice identity is invalid');
  }
}

async function eventAuditId(eventId: string, eventType: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${eventId}\u0000${eventType}`),
  );
  return `se_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function recordInvoiceEvent(
  repository: SubscriptionLifecycleRepository,
  args: {
    subscriptionId: string;
    event: Stripe.Event;
    eventType: 'renewed' | 'payment_failed' | 'payment_recovered';
    outcome: 'applied' | 'duplicate' | 'ignored_stale';
    stripeInvoiceId: string;
  },
): Promise<'applied' | 'duplicate' | 'ignored_stale'> {
  const id = await eventAuditId(args.event.id, args.eventType);
  const inserted = await repository.recordSubscriptionEvent({
    id,
    subscriptionId: args.subscriptionId,
    providerEvent: { id: args.event.id, createdAt: args.event.created },
    eventType: args.eventType,
    outcome: args.outcome,
    details: { stripe_invoice_id: args.stripeInvoiceId },
  });
  return inserted ? args.outcome : 'duplicate';
}

function lifecycleAuditType(eventType: Stripe.Event.Type) {
  switch (eventType) {
    case 'customer.subscription.created': return 'created' as const;
    case 'customer.subscription.deleted': return 'canceled' as const;
    case 'customer.subscription.paused': return 'paused' as const;
    case 'customer.subscription.resumed': return 'resumed' as const;
    default: return 'updated' as const;
  }
}

function lifecycleAuditOutcome(
  decision: 'apply' | 'duplicate' | 'ignored_stale' | 'refresh_required',
) {
  return decision === 'apply' ? 'applied' as const : decision;
}

function directLifecycleNotificationKind(
  eventType: Stripe.Event.Type,
): SubscriptionLifecycleNotificationKind | undefined {
  switch (eventType) {
    case 'customer.subscription.created': return 'created';
    case 'customer.subscription.deleted': return 'canceled';
    case 'customer.subscription.paused': return 'paused';
    case 'customer.subscription.resumed': return 'resumed';
    default: return undefined;
  }
}

function signedUpdatedNotificationKind(
  event: Stripe.Event,
  signedSnapshot: ReturnType<typeof mapSubscriptionLifecycle>,
): SubscriptionLifecycleNotificationKind | undefined {
  if (event.type !== 'customer.subscription.updated') return undefined;
  const previous = event.data.previous_attributes as
    | Partial<Stripe.Subscription>
    | undefined;
  if (!previous) return undefined;
  if (signedSnapshot.cancelAtPeriodEnd && previous.cancel_at_period_end === false) {
    return 'cancel_scheduled';
  }
  if (Object.prototype.hasOwnProperty.call(previous, 'pause_collection')) {
    if (signedSnapshot.pauseCollection && previous.pause_collection === null) {
      return 'paused';
    }
    if (!signedSnapshot.pauseCollection && previous.pause_collection) {
      return 'resumed';
    }
  }
  return undefined;
}

async function sendLifecycleNotification(
  runtime: SubscriptionWebhookRuntime,
  args: Omit<SubscriptionLifecycleEmailInput, 'database'>,
): Promise<void> {
  const sender = runtime.lifecycleEmailSender ?? sendSubscriptionLifecycleEmail;
  await sender({ database: runtime.database, ...args });
}

async function handleLifecycle(
  event: Stripe.Event,
  runtime: SubscriptionWebhookRuntime,
): Promise<WebhookEventOutcome> {
  const subscription = event.data.object as Stripe.Subscription;
  const eventType = lifecycleAuditType(event.type);
  let signedBinding;
  let signedSnapshot;
  try {
    signedBinding = mapProviderSubscriptionBinding(subscription);
    signedSnapshot = mapSubscriptionLifecycle(subscription);
  } catch (error) {
    const stored = await runtime.repository.findSubscriptionByStripeSubscription(subscription.id);
    if (stored) {
      await runtime.repository.recordSubscriptionEvent({
        id: await eventAuditId(event.id, eventType),
        subscriptionId: stored.id,
        providerEvent: { id: event.id, createdAt: event.created },
        eventType,
        outcome: 'failed',
      });
    }
    recordTelemetry('webhook.payment_verification_rejected', {
      operation: 'process', outcome: 'rejected', provider: 'stripe',
      path: '/api/webhooks/stripe', trigger: 'webhook', retryable: false,
    }, error);
    return 'permanent_rejection';
  }
  try {
    const result = await reconcileSubscriptionLifecycle({
      repository: runtime.repository,
      provider: runtime.lifecycleProvider,
      event: { id: event.id, createdAt: event.created },
      stripeSubscriptionId: subscription.id,
      signedBinding,
      signedSnapshot,
    });
    const auditId = await eventAuditId(event.id, eventType);
    const outcome = lifecycleAuditOutcome(result.decision);
    const eligibleOutcome = outcome === 'applied' || outcome === 'duplicate';
    const signedTransitionKind = eligibleOutcome
      ? signedUpdatedNotificationKind(event, signedSnapshot)
      : undefined;
    await runtime.repository.recordSubscriptionEvent({
      id: auditId,
      subscriptionId: result.subscriptionId,
      providerEvent: { id: event.id, createdAt: event.created },
      eventType,
      outcome,
      ...(signedTransitionKind
        ? { details: { notification_kind: signedTransitionKind } }
        : {}),
    });
    if (eligibleOutcome) {
      const notificationKind = signedTransitionKind
        ?? (outcome === 'duplicate' && event.type === 'customer.subscription.updated'
          ? await runtime.repository.findSubscriptionEventNotificationKind(auditId)
          : directLifecycleNotificationKind(event.type));
      if (notificationKind) {
        await sendLifecycleNotification(runtime, {
          subscriptionId: result.subscriptionId,
          providerEventId: event.id,
          kind: notificationKind,
        });
      }
    }
    return 'handled';
  } catch (error) {
    if (error instanceof SubscriptionWebhookPermanentError) {
      const stored = await runtime.repository.findSubscriptionByStripeSubscription(subscription.id);
      if (stored) {
        await runtime.repository.recordSubscriptionEvent({
          id: await eventAuditId(event.id, eventType),
          subscriptionId: stored.id,
          providerEvent: { id: event.id, createdAt: event.created },
          eventType,
          outcome: 'failed',
        });
      }
      recordTelemetry('webhook.payment_verification_rejected', {
        operation: 'process', outcome: 'rejected', provider: 'stripe',
        path: '/api/webhooks/stripe', trigger: 'webhook', retryable: false,
      }, error);
      return 'permanent_rejection';
    }
    throw error;
  }
}

async function handlePaidInvoice(
  event: Stripe.Event,
  runtime: SubscriptionWebhookRuntime,
): Promise<WebhookEventOutcome> {
  const invoice = event.data.object as Stripe.Invoice;
  assertSignedInvoiceId(invoice.id);
  const stripeSubscriptionId = signedInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return 'ignored';
  const acquisition = await requireMappedInvoiceAcquisition(
    invoice,
    stripeSubscriptionId,
    runtime.repository,
  );
  if (!acquisition) return 'ignored';
  if (acquisition.status === 'failed') {
    throw new SubscriptionWebhookPermanentError('Subscription acquisition is terminally failed');
  }
  const result = await fulfillSubscriptionInvoice({
    database: runtime.database,
    provider: runtime.invoiceProvider,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId,
  });
  const stored = await runtime.repository.findSubscriptionByStripeSubscription(
    stripeSubscriptionId,
  );
  if (!stored) throw new Error('Paid invoice order lost its subscription binding');
  const previousFailure = await runtime.database.prepare(`
SELECT 1 AS present
FROM subscription_events
WHERE subscription_id = ?
  AND event_type = 'payment_failed'
  AND outcome = 'applied'
  AND json_valid(COALESCE(details, '{}')) = 1
  AND json_extract(details, '$.stripe_invoice_id') = ?
LIMIT 1
`).bind(stored.id, invoice.id).first<{ present: number }>();
  const outcome = await recordInvoiceEvent(runtime.repository, {
    subscriptionId: stored.id,
    event,
    eventType: previousFailure ? 'payment_recovered' : 'renewed',
    outcome: result.created ? 'applied' : 'duplicate',
    stripeInvoiceId: invoice.id,
  });
  if (previousFailure && (outcome === 'applied' || outcome === 'duplicate')) {
    await sendLifecycleNotification(runtime, {
      subscriptionId: stored.id,
      providerEventId: event.id,
      kind: 'payment_recovered',
    });
  }
  return 'handled';
}

async function handleFailedInvoice(
  event: Stripe.Event,
  runtime: SubscriptionWebhookRuntime,
): Promise<WebhookEventOutcome> {
  const invoice = event.data.object as Stripe.Invoice;
  assertSignedInvoiceId(invoice.id);
  const stripeSubscriptionId = signedInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return 'ignored';
  const acquisition = await requireMappedInvoiceAcquisition(
    invoice,
    stripeSubscriptionId,
    runtime.repository,
  );
  if (!acquisition) return 'ignored';
  if (acquisition.status === 'failed') {
    throw new SubscriptionWebhookPermanentError('Subscription acquisition is terminally failed');
  }
  const stored = await runtime.repository.findSubscriptionByStripeSubscription(
    stripeSubscriptionId,
  );
  if (!stored) {
    throw new Error('Failed invoice arrived before its subscription binding');
  }
  const paid = await runtime.database.prepare(`
SELECT 1 AS present
FROM subscription_invoice_orders
WHERE stripe_invoice_id = ? AND subscription_id = ?
LIMIT 1
`).bind(invoice.id, stored.id).first<{ present: number }>();
  const requestedOutcome = paid ? 'ignored_stale' : 'applied';
  const outcome = await recordInvoiceEvent(runtime.repository, {
    subscriptionId: stored.id,
    event,
    eventType: 'payment_failed',
    outcome: requestedOutcome,
    stripeInvoiceId: invoice.id,
  });
  if (requestedOutcome !== 'ignored_stale'
    && (outcome === 'applied' || outcome === 'duplicate')) {
    await sendLifecycleNotification(runtime, {
      subscriptionId: stored.id,
      providerEventId: event.id,
      kind: 'payment_failed',
    });
  }
  return 'handled';
}

export async function handleSubscriptionStripeEvent(
  event: Stripe.Event,
  providedRuntime?: SubscriptionWebhookRuntime,
): Promise<WebhookEventOutcome> {
  if (!getStoreConfig().commerce.features.subscriptionReconciliation) {
    return 'ignored';
  }
  const runtime = providedRuntime ?? await resolveRuntime();
  if (LIFECYCLE_EVENT_TYPES.has(event.type)) {
    return handleLifecycle(event, runtime);
  }
  try {
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      return await handlePaidInvoice(event, runtime);
    }
    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_attempt_required') {
      return await handleFailedInvoice(event, runtime);
    }
  } catch (error) {
    if (error instanceof SubscriptionWebhookPermanentError) {
      recordTelemetry('webhook.payment_verification_rejected', {
        operation: 'process', outcome: 'rejected', provider: 'stripe',
        path: '/api/webhooks/stripe', trigger: 'webhook', retryable: false,
      }, error);
      return 'permanent_rejection';
    }
    throw error;
  }
  return 'ignored';
}
