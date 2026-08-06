import { describe, expect, it } from 'vitest';
import {
  claimWebhookEvent,
  cleanupCompletedWebhookEvents,
  completeWebhookEvent,
  failWebhookEvent,
  type ProcessedEventsExecutor,
} from '@/lib/webhooks/processed-events';

type SqlCall = {
  query: string;
  bindings: readonly (string | number | null)[];
};

class ScriptedExecutor implements ProcessedEventsExecutor {
  readonly firstCalls: SqlCall[] = [];
  readonly runCalls: SqlCall[] = [];
  firstResults: unknown[] = [];
  runChanges: number[] = [];

  async first<T>(
    query: string,
    bindings: readonly (string | number | null)[]
  ): Promise<T | null> {
    this.firstCalls.push({ query, bindings });
    const result = this.firstResults.shift();
    return (result ?? null) as T | null;
  }

  async run(
    query: string,
    bindings: readonly (string | number | null)[]
  ): Promise<{ changes: number }> {
    this.runCalls.push({ query, bindings });
    return { changes: this.runChanges.shift() ?? 0 };
  }
}

const now = new Date('2026-08-05T18:00:00.000Z');

describe('processed webhook event claims', () => {
  it('uses one conditional upsert and returns acquired ownership', async () => {
    const executor = new ScriptedExecutor();
    executor.firstResults.push({
      claim_token: 'claim_1',
      attempt_count: 1,
      lease_expires_at: '2026-08-05T18:05:00.000Z',
    });

    await expect(claimWebhookEvent({
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      claimToken: 'claim_1',
      now,
    }, executor)).resolves.toEqual({
      state: 'acquired',
      claimToken: 'claim_1',
      attemptCount: 1,
      leaseExpiresAt: '2026-08-05T18:05:00.000Z',
    });

    expect(executor.firstCalls).toHaveLength(1);
    expect(executor.firstCalls[0].query).toContain('ON CONFLICT(event_id) DO UPDATE');
    expect(executor.firstCalls[0].query).toContain("status = 'failed'");
    expect(executor.firstCalls[0].query).toContain('lease_expires_at <= ?');
    expect(executor.firstCalls[0].query).toContain('RETURNING claim_token');
    expect(executor.firstCalls[0].bindings).toEqual([
      'evt_1',
      'payment_intent.succeeded',
      'claim_1',
      '2026-08-05T18:00:00.000Z',
      '2026-08-05T18:05:00.000Z',
      '2026-08-05T18:00:00.000Z',
      '2026-08-05T18:00:00.000Z',
      '2026-08-05T18:00:00.000Z',
    ]);
  });

  it('distinguishes completed duplicates from busy/non-terminal rows', async () => {
    const completedExecutor = new ScriptedExecutor();
    completedExecutor.firstResults.push(
      null,
      { status: 'completed', outcome: 'handled' }
    );
    await expect(claimWebhookEvent({
      eventId: 'evt_done',
      eventType: 'payment_intent.succeeded',
      claimToken: 'claim_done',
      now,
    }, completedExecutor)).resolves.toEqual({ state: 'completed', outcome: 'handled' });

    const busyExecutor = new ScriptedExecutor();
    busyExecutor.firstResults.push(
      null,
      { status: 'processing', outcome: null }
    );
    await expect(claimWebhookEvent({
      eventId: 'evt_busy',
      eventType: 'payment_intent.succeeded',
      claimToken: 'claim_busy',
      now,
    }, busyExecutor)).resolves.toEqual({ state: 'busy' });
  });

  it('rejects invalid lease durations before querying', async () => {
    const executor = new ScriptedExecutor();

    await expect(claimWebhookEvent({
      eventId: 'evt_invalid',
      eventType: 'test',
      leaseDurationMs: 0,
      now,
    }, executor)).rejects.toThrow('positive integer');
    expect(executor.firstCalls).toHaveLength(0);
  });

  it('guards completion and failure updates with the owner token', async () => {
    const executor = new ScriptedExecutor();
    executor.runChanges.push(1, 0);

    await expect(completeWebhookEvent({
      eventId: 'evt_1',
      claimToken: 'owner',
      outcome: 'handled',
      now,
    }, executor)).resolves.toBe(true);
    await expect(failWebhookEvent({
      eventId: 'evt_2',
      claimToken: 'stale',
      error: new Error('temporary failure'),
      now,
    }, executor)).resolves.toBe(false);

    expect(executor.runCalls[0].query).toContain("status = 'processing'");
    expect(executor.runCalls[0].query).toContain('claim_token = ?');
    expect(executor.runCalls[0].bindings).toEqual([
      '2026-08-05T18:00:00.000Z',
      'handled',
      '2026-08-05T18:00:00.000Z',
      'evt_1',
      'owner',
    ]);
    expect(executor.runCalls[1].query).toContain("SET status = 'failed'");
    expect(executor.runCalls[1].bindings).toEqual([
      'temporary failure',
      '2026-08-05T18:00:00.000Z',
      'evt_2',
      'stale',
    ]);
  });

  it('bounds stored errors and cleans up completed rows only', async () => {
    const executor = new ScriptedExecutor();
    executor.runChanges.push(1, 3);

    await failWebhookEvent({
      eventId: 'evt_error',
      claimToken: 'owner',
      error: 'x'.repeat(3_000),
      now,
    }, executor);
    await expect(cleanupCompletedWebhookEvents(now, executor)).resolves.toBe(3);

    expect(executor.runCalls[0].bindings[0]).toHaveLength(2_000);
    expect(executor.runCalls[1].query).toContain("WHERE status = 'completed'");
    expect(executor.runCalls[1].query).not.toContain("status = 'failed'");
  });
});
