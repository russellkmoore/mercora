import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import {
  claimWebhookEvent,
  completeWebhookEvent,
  createProcessedEventsExecutor,
  failWebhookEvent,
} from '@/lib/webhooks/processed-events';
import { applyTestMigrations } from '../../helpers/d1';

const start = new Date('2026-08-05T18:00:00.000Z');

beforeEach(async () => {
  await applyTestMigrations();
});

describe('durable webhook claims in real D1', () => {
  it('grants one owner under concurrent same-event delivery', async () => {
    const executor = createProcessedEventsExecutor(env.DB);

    const claims = await Promise.all([
      claimWebhookEvent({
        eventId: 'evt_race',
        eventType: 'payment_intent.succeeded',
        claimToken: 'owner_a',
        now: start,
      }, executor),
      claimWebhookEvent({
        eventId: 'evt_race',
        eventType: 'payment_intent.succeeded',
        claimToken: 'owner_b',
        now: start,
      }, executor),
    ]);
    const row = await env.DB.prepare(`
      SELECT status, attempt_count, claim_token
      FROM processed_webhook_events
      WHERE event_id = ?
    `).bind('evt_race').first<{
      status: string;
      attempt_count: number;
      claim_token: string;
    }>();

    expect(claims.map(({ state }) => state).sort()).toEqual(['acquired', 'busy']);
    expect(row).toMatchObject({ status: 'processing', attempt_count: 1 });
    expect(['owner_a', 'owner_b']).toContain(row?.claim_token);
  });

  it('retries an owned failure without deleting its audit row', async () => {
    const executor = createProcessedEventsExecutor(env.DB);
    const first = await claimWebhookEvent({
      eventId: 'evt_retry',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_first',
      now: start,
    }, executor);
    expect(first.state).toBe('acquired');
    if (first.state !== 'acquired') throw new Error('Expected first claim ownership');

    await expect(failWebhookEvent({
      eventId: 'evt_retry',
      claimToken: first.claimToken,
      error: new Error('D1 downstream failed'),
      now: start,
    }, executor)).resolves.toBe(true);

    const retry = await claimWebhookEvent({
      eventId: 'evt_retry',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_retry',
      now: new Date(start.getTime() + 1_000),
    }, executor);
    expect(retry).toMatchObject({
      state: 'acquired',
      claimToken: 'owner_retry',
      attemptCount: 2,
    });

    const rows = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM processed_webhook_events WHERE event_id = ?'
    ).bind('evt_retry').first<{ count: number }>();
    expect(rows?.count).toBe(1);
  });

  it('allows stale takeover and rejects the stale owner token', async () => {
    const executor = createProcessedEventsExecutor(env.DB);
    const stale = await claimWebhookEvent({
      eventId: 'evt_stale',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_stale',
      leaseDurationMs: 1_000,
      now: start,
    }, executor);
    expect(stale.state).toBe('acquired');

    const current = await claimWebhookEvent({
      eventId: 'evt_stale',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_current',
      leaseDurationMs: 1_000,
      now: new Date(start.getTime() + 1_001),
    }, executor);
    expect(current).toMatchObject({
      state: 'acquired',
      claimToken: 'owner_current',
      attemptCount: 2,
    });

    await expect(completeWebhookEvent({
      eventId: 'evt_stale',
      claimToken: 'owner_stale',
      outcome: 'handled',
      now: new Date(start.getTime() + 1_002),
    }, executor)).resolves.toBe(false);
    await expect(failWebhookEvent({
      eventId: 'evt_stale',
      claimToken: 'owner_stale',
      error: new Error('late failure'),
      now: new Date(start.getTime() + 1_002),
    }, executor)).resolves.toBe(false);
    await expect(completeWebhookEvent({
      eventId: 'evt_stale',
      claimToken: 'owner_current',
      outcome: 'handled',
      now: new Date(start.getTime() + 1_003),
    }, executor)).resolves.toBe(true);
  });

  it('keeps completed events terminal across later deliveries', async () => {
    const executor = createProcessedEventsExecutor(env.DB);
    const claim = await claimWebhookEvent({
      eventId: 'evt_done',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_done',
      now: start,
    }, executor);
    if (claim.state !== 'acquired') throw new Error('Expected claim ownership');

    await expect(completeWebhookEvent({
      eventId: 'evt_done',
      claimToken: claim.claimToken,
      outcome: 'permanent_rejection',
      now: start,
    }, executor)).resolves.toBe(true);
    await expect(claimWebhookEvent({
      eventId: 'evt_done',
      eventType: 'payment_intent.succeeded',
      claimToken: 'owner_late',
      now: new Date(start.getTime() + 86_400_000),
    }, executor)).resolves.toEqual({
      state: 'completed',
      outcome: 'permanent_rejection',
    });

    const row = await env.DB.prepare(`
      SELECT status, attempt_count, claim_token, outcome
      FROM processed_webhook_events
      WHERE event_id = ?
    `).bind('evt_done').first<{
      status: string;
      attempt_count: number;
      claim_token: string | null;
      outcome: string;
    }>();
    expect(row).toEqual({
      status: 'completed',
      attempt_count: 1,
      claim_token: null,
      outcome: 'permanent_rejection',
    });
  });
});
