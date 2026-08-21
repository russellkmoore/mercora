import { regenerateAnalytics } from '@/lib/analytics/generate-insights';
import { runRecommendationCron } from '@/lib/recommendations/cron';
import { drainInventoryAdjustments } from '@/lib/services/inventory-adjustments';
import { drainOrderEffects } from '@/lib/services/order-effects';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { noOpCommerceCapabilities, resolveCommerceCapabilities } from '@/lib/commerce/capabilities';
import { createRuntimeGiftCardCapabilityFactory } from '@/lib/gift-cards/runtime';
import { drainGiftCardDeliveries } from '@/lib/services/gift-card-fulfillment';

function runtimeCapabilities(env: CloudflareEnv) {
  const enabled = (key: string) => String((env as unknown as Record<string, unknown>)[key] ?? '')
    .trim().toLowerCase() === 'true';
  return resolveCommerceCapabilities({
    giftCardAcquisition: enabled('STORE_FEATURE_GIFT_CARD_ACQUISITION'),
    giftCardReconciliation: enabled('STORE_FEATURE_GIFT_CARD_RECONCILIATION'),
    subscriptionAcquisition: enabled('STORE_FEATURE_SUBSCRIPTION_ACQUISITION'),
    subscriptionReconciliation: enabled('STORE_FEATURE_SUBSCRIPTION_RECONCILIATION'),
  }, { giftCards: createRuntimeGiftCardCapabilityFactory({
    getEnvironment: async () => env as unknown as Record<string, unknown> & { DB?: D1Database },
  }), subscriptions: () => noOpCommerceCapabilities.subscriptions });
}

export function handleScheduled(
  controller: ScheduledController,
  env: CloudflareEnv,
  ctx: ExecutionContext,
): void {
  if (controller.cron === '*/5 * * * *') {
    const capabilities = runtimeCapabilities(env);
    const giftCardsEnabled = String((env as unknown as Record<string, unknown>)
      .STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() === 'true';
    ctx.waitUntil(
      Promise.all([
        drainOrderEffects({
          database: env.DB,
          capabilities,
          giftCardEnvironment: env as unknown as Record<string, unknown> & { DB?: D1Database },
          limit: 25,
        }),
        drainInventoryAdjustments({ database: env.DB, limit: 25 }),
        giftCardsEnabled
          ? drainGiftCardDeliveries({ environment: env as unknown as Record<string, unknown> & { DB?: D1Database }, limit: 25 })
          : Promise.resolve({ attempted: 0 }),
      ])
        .then(([effects, inventory, giftCardDeliveries]) =>
          console.log('[cron] recovery queues drained', { effects, inventory, giftCardDeliveries })
        )
        .catch((error) => recordTelemetry('cron.recovery_failed', {
          operation: 'process', outcome: 'failed', provider: 'd1',
          retryable: true, trigger: 'recovery',
        }, error)),
    );
    return;
  }

  if (controller.cron === '15 8 * * *') {
    ctx.waitUntil(runRecommendationCron(env));
    return;
  }

  if (controller.cron !== '0 */6 * * *') {
    console.warn('[cron] ignoring unknown scheduled trigger', controller.cron);
    return;
  }

  ctx.waitUntil(
    regenerateAnalytics(env)
      .then(() => console.log('[cron] analytics cache regenerated'))
      .catch((error) => recordTelemetry('cron.analytics_failed', {
        operation: 'rebuild', outcome: 'failed', provider: 'd1',
        retryable: true, trigger: 'scheduled',
      }, error)),
  );
}
