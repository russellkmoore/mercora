import { regenerateAnalytics } from '@/lib/analytics/generate-insights';
import { runRecommendationCron } from '@/lib/recommendations/cron';
import { drainInventoryAdjustments } from '@/lib/services/inventory-adjustments';
import { drainOrderEffects } from '@/lib/services/order-effects';
import { recordTelemetry } from '@/lib/observability/telemetry';

export function handleScheduled(
  controller: ScheduledController,
  env: CloudflareEnv,
  ctx: ExecutionContext,
): void {
  if (controller.cron === '*/5 * * * *') {
    ctx.waitUntil(
      Promise.all([
        drainOrderEffects({ database: env.DB, limit: 25 }),
        drainInventoryAdjustments({ database: env.DB, limit: 25 }),
      ])
        .then(([effects, inventory]) =>
          console.log('[cron] recovery queues drained', { effects, inventory })
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
