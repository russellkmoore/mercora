import { regenerateAnalytics } from '@/lib/analytics/generate-insights';
import { runRecommendationCron } from '@/lib/recommendations/cron';
import { drainInventoryAdjustments } from '@/lib/services/inventory-adjustments';
import { drainOrderEffects } from '@/lib/services/order-effects';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { noOpCommerceCapabilities, resolveCommerceCapabilities } from '@/lib/commerce/capabilities';
import { createRuntimeGiftCardCapabilityFactory } from '@/lib/gift-cards/runtime';
import { drainGiftCardDeliveries } from '@/lib/services/gift-card-fulfillment';
import { runGiftCardHonorGuard } from '@/lib/gift-cards/honor-guard';

/**
 * `honorEffective` comes from the honor guard, not from the environment: while
 * shoppers still hold balances, honoring keeps running even though the flag is
 * off (D-04). The other three flags are read straight from the environment.
 */
function runtimeCapabilities(env: CloudflareEnv, honorEffective: boolean) {
  const enabled = (key: string) => String((env as unknown as Record<string, unknown>)[key] ?? '')
    .trim().toLowerCase() === 'true';
  return resolveCommerceCapabilities({
    giftCardAcquisition: enabled('STORE_FEATURE_GIFT_CARD_ACQUISITION'),
    giftCardReconciliation: honorEffective,
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
    const giftCardsEnabled = String((env as unknown as Record<string, unknown>)
      .STORE_FEATURE_GIFT_CARD_RECONCILIATION ?? '').trim().toLowerCase() === 'true';
    ctx.waitUntil(
      // `env.DB` directly: a scheduled handler already holds its bindings and
      // has no request context to rediscover them from.
      runGiftCardHonorGuard(env.DB, giftCardsEnabled, Math.floor(Date.now() / 1000))
        // A measurement we could not take must not stop the recovery drains.
        // Degrade to the configured flags and keep going.
        //
        // The message, not the exception object: this file is an instrumented
        // boundary, and `tests/unit/observability/instrumentation-source.test.ts`
        // holds those to structured logging. A failed measurement is also not
        // an alarm on its own — honoring stays wherever the flag left it, and
        // the guard tries again in five minutes.
        .catch((error) => {
          console.warn(
            '[cron] gift-card honor guard unavailable',
            error instanceof Error ? error.message : String(error),
          );
          return { honorEffective: giftCardsEnabled };
        })
        .then(({ honorEffective }) => Promise.all([
          drainOrderEffects({
            database: env.DB,
            // Resolved here, not above: it needs `honorEffective`, and
            // resolving lazily leaves the gift-card key ring untouched on a
            // tick where honoring is genuinely off.
            capabilities: runtimeCapabilities(env, honorEffective),
            giftCardEnvironment: env as unknown as Record<string, unknown> & { DB?: D1Database },
            limit: 25,
          }),
          drainInventoryAdjustments({ database: env.DB, limit: 25 }),
          // Delivery is the acquisition side of the feature, so it stays on the
          // configured flag. D-04 covers redemption, settlement and refunds.
          giftCardsEnabled
            ? drainGiftCardDeliveries({ environment: env as unknown as Record<string, unknown> & { DB?: D1Database }, limit: 25 })
            : Promise.resolve({ attempted: 0 }),
        ]))
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
