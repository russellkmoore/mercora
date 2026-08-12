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
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
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
