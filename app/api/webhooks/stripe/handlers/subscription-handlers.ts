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
  repository: SubscriptionLifecycleRepository;
  lifecycleProvider: SubscriptionLifecycleProvider;
  invoiceProvider: SubscriptionInvoiceProvider;
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
): Promise<void> {
  const id = await eventAuditId(args.event.id, args.eventType);
  await repository.recordSubscriptionEvent({
    id,
    subscriptionId: args.subscriptionId,
    providerEvent: { id: args.event.id, createdAt: args.event.created },
    eventType: args.eventType,
    outcome: args.outcome,
    details: { stripe_invoice_id: args.stripeInvoiceId },
  });
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
    await runtime.repository.recordSubscriptionEvent({
      id: await eventAuditId(event.id, eventType),
      subscriptionId: result.subscriptionId,
      providerEvent: { id: event.id, createdAt: event.created },
      eventType,
      outcome: lifecycleAuditOutcome(result.decision),
    });
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
  const acquisition = await runtime.repository.findAcquisitionByStripeSubscription(
    stripeSubscriptionId,
  );
  if (!acquisition) return 'ignored';
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
  await recordInvoiceEvent(runtime.repository, {
    subscriptionId: stored.id,
    event,
    eventType: previousFailure ? 'payment_recovered' : 'renewed',
    outcome: result.created ? 'applied' : 'duplicate',
    stripeInvoiceId: invoice.id,
  });
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
  const acquisition = await runtime.repository.findAcquisitionByStripeSubscription(
    stripeSubscriptionId,
  );
  if (!acquisition) return 'ignored';
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
  await recordInvoiceEvent(runtime.repository, {
    subscriptionId: stored.id,
    event,
    eventType: 'payment_failed',
    outcome: paid ? 'ignored_stale' : 'applied',
    stripeInvoiceId: invoice.id,
  });
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
