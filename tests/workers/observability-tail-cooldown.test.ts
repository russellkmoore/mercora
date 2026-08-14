import { env } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('AlertCooldown Durable Object', () => {
  it('atomically suppresses a bucket until its reservation expires', async () => {
    const stub = env.ALERT_COOLDOWN.get(
      env.ALERT_COOLDOWN.idFromName('payment.intent_create_failed|Error|stripe'),
    );
    const now = Date.now() + 60_000;
    const first = await stub.reserve(now, 60_000);
    expect(first).toEqual({ reservedUntil: now + 60_000 });
    expect(await stub.reserve(now + 1, 60_000)).toBeNull();
    expect(await stub.reserve(now + 60_000, 60_000))
      .toEqual({ reservedUntil: now + 120_000 });
  });

  it('uses an optimistic token when shortening a failed delivery reservation', async () => {
    const stub = env.ALERT_COOLDOWN.get(
      env.ALERT_COOLDOWN.idFromName('webhook.processing_failed|Error|stripe'),
    );
    const now = Date.now() + 60_000;
    const first = await stub.reserve(now, 60_000);
    if (!first) throw new Error('expected initial reservation');
    await stub.shortenAfterFailure(first.reservedUntil, now + 1_000, 10_000);
    expect(await stub.reserve(now + 10_999, 60_000)).toBeNull();
    const retry = await stub.reserve(now + 11_000, 60_000);
    expect(retry).toEqual({ reservedUntil: now + 71_000 });

    await stub.shortenAfterFailure(first.reservedUntil, now + 12_000, 10_000);
    expect(await stub.reserve(now + 22_000, 60_000)).toBeNull();
  });

  it('cleans expired state idempotently with its alarm', async () => {
    const stub = env.ALERT_COOLDOWN.get(
      env.ALERT_COOLDOWN.idFromName('refund.settlement_failed|Error|stripe'),
    );
    expect(await stub.reserve(Date.now(), 60_000)).not.toBeNull();
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        'UPDATE alert_cooldown SET reserved_until = ? WHERE singleton = 1',
        Date.now() - 1,
      );
      await state.storage.setAlarm(Date.now() + 60_000);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      const rows = state.storage.sql.exec(
        'SELECT reserved_until FROM alert_cooldown',
      ).toArray();
      expect(rows).toEqual([]);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(false);
  });
});
