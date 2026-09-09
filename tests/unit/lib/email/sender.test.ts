import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '@/lib/email/sender';

const message = {
  from: 'Example Store <orders@example.test>',
  to: ['customer@example.test'],
  subject: 'Order received',
  html: '<p>Order received</p>',
  text: 'Order received',
};

beforeEach(() => {
  Reflect.deleteProperty(process.env, "EMAIL_PROVIDER");
  Reflect.deleteProperty(process.env, "RESEND_API_KEY");
});

describe('provider-neutral email sender', () => {
  it('uses Cloudflare when it is the only configured provider', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-1' }));
    await expect(sendEmail(message, {
      cloudflareBinding: { send },
      env: {},
    })).resolves.toEqual({ success: true, id: 'cf-1', provider: 'cloudflare' });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: 'Example Store', email: 'orders@example.test' },
      text: 'Order received',
    }));
  });

  it('uses Resend when it is the only configured provider', async () => {
    const send = vi.fn(async () => ({ data: { id: 're-1' }, error: null }));
    await expect(sendEmail(message, {
      resendClient: { emails: { send } },
      env: {},
    })).resolves.toEqual({ success: true, id: 're-1', provider: 'resend' });
  });

  it('requires an explicit provider when both are configured', async () => {
    const cloudflare = vi.fn();
    const resend = vi.fn();
    const result = await sendEmail(message, {
      cloudflareBinding: { send: cloudflare },
      resendClient: { emails: { send: resend } },
      env: {},
    });

    expect(result).toMatchObject({ success: false, errorCode: 'E_PROVIDER_CONFIG' });
    expect(result.error).toContain('Both email providers');
    expect(cloudflare).not.toHaveBeenCalled();
    expect(resend).not.toHaveBeenCalled();
  });

  it('does not fall back after the selected provider fails', async () => {
    const cloudflare = vi.fn(async () => { throw new Error('Cloudflare unavailable'); });
    const resend = vi.fn(async () => ({ data: { id: 'unexpected' }, error: null }));
    const result = await sendEmail(message, {
      provider: 'cloudflare',
      cloudflareBinding: { send: cloudflare },
      resendClient: { emails: { send: resend } },
      env: {},
    });

    expect(result).toMatchObject({ success: false, provider: 'cloudflare' });
    expect(result).toMatchObject({ needsReview: true, errorCode: 'E_DELIVERY_INDETERMINATE' });
    expect(resend).not.toHaveBeenCalled();
  });

  it('keeps coded Cloudflare rejections retryable because they are known failures', async () => {
    const failure = Object.assign(new Error('Recipient rejected'), { code: 'recipient_rejected' });
    const result = await sendEmail(message, {
      provider: 'cloudflare',
      cloudflareBinding: { send: vi.fn(async () => { throw failure; }) },
      env: {},
    });

    expect(result).toMatchObject({
      success: false,
      provider: 'cloudflare',
      errorCode: 'recipient_rejected',
    });
    expect(result.needsReview).toBeUndefined();
  });

  // The production failure the gift-card drain hit was inside resolveRuntime,
  // not inside deliver(): the cron handler has no request context, so the
  // sender has to find the EMAIL binding in the env it is handed. Every other
  // test here passes cloudflareBinding directly, which skips that path.
  it('resolves the Cloudflare binding out of the env it is handed', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-env-1' }));
    await expect(sendEmail(message, {
      env: { EMAIL: { send } as unknown as CloudflareEnv['EMAIL'], EMAIL_PROVIDER: 'cloudflare' },
    })).resolves.toEqual({ success: true, id: 'cf-env-1', provider: 'cloudflare' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('reports E_PROVIDER_CONFIG when a cloudflare env carries no EMAIL binding', async () => {
    const result = await sendEmail(message, { env: { EMAIL_PROVIDER: 'cloudflare' } });
    expect(result).toMatchObject({ success: false, errorCode: 'E_PROVIDER_CONFIG' });
    expect(result.error).toContain('EMAIL binding');
  });

  it('fails closed when Cloudflare idempotency lacks D1', async () => {
    const send = vi.fn();
    const result = await sendEmail(message, {
      provider: 'cloudflare',
      cloudflareBinding: { send },
      env: {},
      idempotencyKey: 'order/1/v1',
    });
    expect(result).toMatchObject({ success: false, errorCode: 'E_IDEMPOTENCY_CONFIG' });
    expect(send).not.toHaveBeenCalled();
  });
});
