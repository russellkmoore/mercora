import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  drainOrderEffects: vi.fn(),
  drainInventoryAdjustments: vi.fn(),
  drainGiftCardDeliveries: vi.fn(),
  regenerateAnalytics: vi.fn(),
  runRecommendationCron: vi.fn(),
  recordTelemetry: vi.fn(),
  runGiftCardHonorGuard: vi.fn(),
}));

vi.mock('@/lib/services/order-effects', () => ({
  drainOrderEffects: mocks.drainOrderEffects,
}));
vi.mock('@/lib/services/inventory-adjustments', () => ({
  drainInventoryAdjustments: mocks.drainInventoryAdjustments,
}));
vi.mock('@/lib/services/gift-card-fulfillment', () => ({
  drainGiftCardDeliveries: mocks.drainGiftCardDeliveries,
}));
vi.mock('@/lib/analytics/generate-insights', () => ({
  regenerateAnalytics: mocks.regenerateAnalytics,
}));
vi.mock('@/lib/recommendations/cron', () => ({
  runRecommendationCron: mocks.runRecommendationCron,
}));
vi.mock('@/lib/observability/telemetry', () => ({
  recordTelemetry: mocks.recordTelemetry,
}));
// Only the cron's entry point is mocked. Stubbing this one module keeps the
// gift-card repository, its aggregate SQL and the runtime capability factory
// out of a test that is about scheduled routing, not about measurement.
vi.mock('@/lib/gift-cards/honor-guard', () => ({
  runGiftCardHonorGuard: mocks.runGiftCardHonorGuard,
}));

import { noOpCommerceCapabilities } from '@/lib/commerce/capabilities';
import { handleScheduled } from '@/lib/observability/scheduled';

function controller(cron: string): ScheduledController {
  return { cron } as ScheduledController;
}

function context(): { ctx: ExecutionContext; waits: Promise<unknown>[] } {
  const waits: Promise<unknown>[] = [];
  return {
    waits,
    ctx: { waitUntil: (promise: Promise<unknown>) => { waits.push(promise); } } as ExecutionContext,
  };
}

beforeEach(() => {
  mocks.drainOrderEffects.mockResolvedValue({ claimed: 0, succeeded: 0, failed: 0 });
  mocks.drainInventoryAdjustments.mockResolvedValue({ claimed: 0, succeeded: 0, failed: 0 });
  mocks.drainGiftCardDeliveries.mockResolvedValue({ attempted: 0 });
  mocks.regenerateAnalytics.mockResolvedValue(undefined);
  mocks.runRecommendationCron.mockResolvedValue(undefined);
  mocks.runGiftCardHonorGuard.mockResolvedValue({
    honorEffective: true,
    record: { outstanding_minor: 0, currency: 'USD', open_reservations: 0, measured_at: 0 },
  });
});

/** The capabilities object the order-effects drain was handed on this tick. */
function drainedCapabilities() {
  const [call] = mocks.drainOrderEffects.mock.calls;
  return (call?.[0] as { capabilities: typeof noOpCommerceCapabilities }).capabilities;
}

describe('Worker scheduled routing behavior', () => {
  it('reports recovery failure through the bounded critical event and settles waitUntil', async () => {
    const recoveryError = new Error('effect recovery unavailable');
    mocks.drainOrderEffects.mockRejectedValue(recoveryError);
    const { ctx, waits } = context();

    handleScheduled(controller('*/5 * * * *'), { DB: {} } as CloudflareEnv, ctx);
    await Promise.all(waits);

    expect(waits).toHaveLength(1);
    expect(mocks.drainInventoryAdjustments).toHaveBeenCalledWith({ database: {}, limit: 25 });
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'cron.recovery_failed',
      {
        operation: 'process', outcome: 'failed', provider: 'd1',
        retryable: true, trigger: 'recovery',
      },
      recoveryError,
    );
  });

  it('retries encrypted gift-card delivery under reconciliation even when acquisition is disabled', async () => {
    const { ctx, waits } = context();
    const runtime = {
      DB: {} as D1Database,
      STORE_FEATURE_GIFT_CARD_ACQUISITION: 'false',
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'true',
    } as unknown as CloudflareEnv;

    handleScheduled(controller('*/5 * * * *'), runtime, ctx);
    await Promise.all(waits);

    expect(mocks.drainGiftCardDeliveries).toHaveBeenCalledWith({
      environment: runtime,
      limit: 25,
    });
  });

  it('does not open the gift-card retry boundary while reconciliation is disabled', async () => {
    const { ctx, waits } = context();
    handleScheduled(controller('*/5 * * * *'), { DB: {} } as CloudflareEnv, ctx);
    await Promise.all(waits);
    expect(mocks.drainGiftCardDeliveries).not.toHaveBeenCalled();
  });

  it('measures outstanding gift-card value on every five-minute tick', async () => {
    const { ctx, waits } = context();
    const database = {} as D1Database;
    const runtime = {
      DB: database,
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'false',
    } as unknown as CloudflareEnv;

    handleScheduled(controller('*/5 * * * *'), runtime, ctx);
    await Promise.all(waits);

    expect(mocks.runGiftCardHonorGuard).toHaveBeenCalledTimes(1);
    const [passedDatabase, configuredHonor, nowSeconds] = mocks.runGiftCardHonorGuard.mock.calls[0];
    // The scheduled handler already holds the binding; it must not reach for
    // getCloudflareContext to rediscover it.
    expect(passedDatabase).toBe(database);
    expect(configuredHonor).toBe(false);
    expect(nowSeconds).toBeTypeOf('number');
  });

  it('keeps honoring on the drained capabilities while the guard finds outstanding value', async () => {
    const { ctx, waits } = context();
    mocks.runGiftCardHonorGuard.mockResolvedValue({
      honorEffective: true,
      record: { outstanding_minor: 4_500, currency: 'USD', open_reservations: 1, measured_at: 10 },
    });

    handleScheduled(controller('*/5 * * * *'), {
      DB: {} as D1Database,
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'false',
    } as unknown as CloudflareEnv, ctx);
    await Promise.all(waits);

    expect(drainedCapabilities().giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
  });

  it('leaves honoring disabled once the guard reports nothing outstanding', async () => {
    const { ctx, waits } = context();
    mocks.runGiftCardHonorGuard.mockResolvedValue({
      honorEffective: false,
      record: { outstanding_minor: 0, currency: 'USD', open_reservations: 0, measured_at: 10 },
    });

    handleScheduled(controller('*/5 * * * *'), {
      DB: {} as D1Database,
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'false',
    } as unknown as CloudflareEnv, ctx);
    await Promise.all(waits);

    expect(drainedCapabilities().giftCards).toBe(noOpCommerceCapabilities.giftCards);
  });

  it('drains the recovery queues even when the honor measurement fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ctx, waits } = context();
    mocks.runGiftCardHonorGuard.mockRejectedValue(new Error('guard measurement unavailable'));

    handleScheduled(controller('*/5 * * * *'), {
      DB: {} as D1Database,
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: 'false',
    } as unknown as CloudflareEnv, ctx);
    await Promise.all(waits);

    expect(waits).toHaveLength(1);
    expect(mocks.drainInventoryAdjustments).toHaveBeenCalledWith({ database: {}, limit: 25 });
    // Degrades to the configured flags rather than widening honoring on a
    // measurement we could not take.
    expect(drainedCapabilities().giftCards).toBe(noOpCommerceCapabilities.giftCards);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports analytics failure while preserving background completion', async () => {
    const analyticsError = new Error('analytics D1 unavailable');
    mocks.regenerateAnalytics.mockRejectedValue(analyticsError);
    const { ctx, waits } = context();

    handleScheduled(controller('0 */6 * * *'), {} as CloudflareEnv, ctx);
    await Promise.all(waits);

    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      'cron.analytics_failed',
      {
        operation: 'rebuild', outcome: 'failed', provider: 'd1',
        retryable: true, trigger: 'scheduled',
      },
      analyticsError,
    );
  });

  it('routes recommendation work unchanged and ignores unknown schedules', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const recommendation = context();
    const env = {} as CloudflareEnv;
    handleScheduled(controller('15 8 * * *'), env, recommendation.ctx);
    await Promise.all(recommendation.waits);
    expect(mocks.runRecommendationCron).toHaveBeenCalledWith(env);

    const unknown = context();
    handleScheduled(controller('1 2 3 4 5'), env, unknown.ctx);
    expect(unknown.waits).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[cron] ignoring unknown scheduled trigger', '1 2 3 4 5');
  });
});
