import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { sendEmail } from '@/lib/email/sender';
import { applyTestMigrations } from '../../helpers/d1';

const message = {
  from: 'Example Store <orders@example.test>',
  to: ['customer@example.test'],
  subject: 'Order received',
  html: '<p>Order received</p>',
  text: 'Order received',
};

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.prepare("DELETE FROM email_deliveries WHERE idempotency_key LIKE 'test/%'").run();
});

describe('email delivery idempotency in real D1', () => {
  it('calls Cloudflare once for repeated successful delivery keys', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-1' }));
    const options = {
      provider: 'cloudflare' as const,
      cloudflareBinding: { send },
      database: env.DB,
      env: {},
      idempotencyKey: 'test/order/1/v1',
      now: new Date('2026-08-11T20:00:00Z'),
    };

    await expect(sendEmail(message, options)).resolves.toMatchObject({ success: true, id: 'cf-1' });
    await expect(sendEmail(message, options)).resolves.toMatchObject({ success: true, id: 'cf-1' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('allows exactly one concurrent owner of a stable key', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const send = vi.fn(async () => {
      await pending;
      return { messageId: 'cf-2' };
    });
    const options = {
      provider: 'cloudflare' as const,
      cloudflareBinding: { send },
      database: env.DB,
      env: {},
      idempotencyKey: 'test/order/2/v1',
      now: new Date('2026-08-11T20:00:00Z'),
    };

    const first = sendEmail(message, options);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const second = await sendEmail(message, options);
    release();

    await expect(first).resolves.toMatchObject({ success: true, id: 'cf-2' });
    expect(second).toMatchObject({
      success: false,
      pending: true,
      errorCode: 'concurrent_idempotent_requests',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never resends an expired Cloudflare claim after an accepted send lost completion', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-accepted' }));
    const started = new Date('2026-08-11T20:00:00Z');
    const completionLost = {
      prepare(query: string) {
        const statement = env.DB.prepare(query);
        if (!query.includes('UPDATE email_deliveries SET\n      status = ?')) return statement;
        return new Proxy(statement, {
          get(target, property) {
            if (property === 'bind') return (...values: unknown[]) => {
              const bound = target.bind(...values);
              return new Proxy(bound, {
                get(boundTarget, boundProperty) {
                  if (boundProperty === 'run') return async () => { throw new Error('completion unavailable'); };
                  const boundValue = Reflect.get(boundTarget, boundProperty);
                  return typeof boundValue === 'function' ? boundValue.bind(boundTarget) : boundValue;
                },
              });
            };
            const value = Reflect.get(target, property);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
      batch: env.DB.batch.bind(env.DB),
      exec: env.DB.exec.bind(env.DB),
      dump: env.DB.dump.bind(env.DB),
      withSession: env.DB.withSession.bind(env.DB),
    } as D1Database;

    const accepted = await sendEmail(message, {
      provider: 'cloudflare',
      cloudflareBinding: { send },
      database: completionLost,
      env: {},
      idempotencyKey: 'test/order/lost-completion/v1',
      now: started,
    });
    expect(accepted).toMatchObject({
      success: false,
      needsReview: true,
      errorCode: 'E_IDEMPOTENCY_COMPLETE',
    });
    await expect(env.DB.prepare(`SELECT status FROM email_deliveries
      WHERE idempotency_key = ?`).bind('test/order/lost-completion/v1').first())
      .resolves.toMatchObject({ status: 'processing' });

    const result = await sendEmail(message, {
      provider: 'cloudflare',
      cloudflareBinding: { send },
      database: env.DB,
      env: {},
      idempotencyKey: 'test/order/lost-completion/v1',
      now: new Date(started.getTime() + 10 * 60 * 1_000 + 1),
    });

    expect(result).toMatchObject({
      success: false,
      needsReview: true,
      errorCode: 'E_DELIVERY_INDETERMINATE',
    });
    expect(send).toHaveBeenCalledTimes(1);
    await expect(env.DB.prepare(`SELECT status, error_code FROM email_deliveries
      WHERE idempotency_key = ?`).bind('test/order/lost-completion/v1').first())
      .resolves.toMatchObject({ status: 'needs_review', error_code: 'E_DELIVERY_INDETERMINATE' });
  });
});
