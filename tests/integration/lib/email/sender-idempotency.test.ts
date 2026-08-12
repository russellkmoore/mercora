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
});
