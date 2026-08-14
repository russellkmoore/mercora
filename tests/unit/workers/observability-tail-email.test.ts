import { describe, expect, it, vi } from 'vitest';
import type { AlertConfiguration, AlertEmailMessage } from '@/workers/observability-tail/src/core';
import { sendAlertEmail } from '@/workers/observability-tail/src/email';

const message: AlertEmailMessage = {
  from: 'alerts@merchant.test',
  to: 'operator@merchant.test',
  subject: 'Commerce alert production',
  html: '<p>bounded</p>',
  text: 'bounded',
};

const base: Omit<AlertConfiguration, 'provider'> = {
  recipient: message.to,
  sender: message.from,
  subjectPrefix: 'Commerce alert',
  operatorIdentity: 'on-call',
  environment: 'production',
  cooldownMs: 900_000,
  failureBackoffMs: 30_000,
};

describe('observability alert email providers', () => {
  it('uses the native binding for Cloudflare Email Sending', async () => {
    const send = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    await sendAlertEmail(
      message,
      { ...base, provider: 'cloudflare' },
      { ALERT_EMAIL: { send } },
      fetcher,
    );
    expect(send).toHaveBeenCalledWith(message);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the selected Resend API without touching the Cloudflare binding', async () => {
    const send = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    await sendAlertEmail(
      message,
      { ...base, provider: 'resend', resendApiKey: 'test-api-key' },
      { ALERT_EMAIL: { send } },
      fetcher,
    );
    expect(send).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }));
  });

  it('does not fail over to another provider after delivery starts', async () => {
    const send = vi.fn(async () => { throw new Error('native delivery failed'); });
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    await expect(sendAlertEmail(
      message,
      { ...base, provider: 'cloudflare' },
      { ALERT_EMAIL: { send }, RESEND_API_KEY: 'test-api-key' },
      fetcher,
    )).rejects.toThrow('native delivery failed');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects failed Resend responses without reading or logging their body', async () => {
    const cancel = vi.fn(async () => undefined);
    const response = new Response(new ReadableStream({ cancel }), { status: 500 });
    const send = vi.fn(async () => undefined);
    await expect(sendAlertEmail(
      message,
      { ...base, provider: 'resend', resendApiKey: 'test-api-key' },
      { ALERT_EMAIL: { send } },
      async () => response,
    )).rejects.toThrow('Resend alert delivery failed');
    expect(cancel).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not fail over to Cloudflare when the selected Resend request throws', async () => {
    const send = vi.fn(async () => undefined);
    const networkError = new Error('Resend network unavailable');
    await expect(sendAlertEmail(
      message,
      { ...base, provider: 'resend', resendApiKey: 'test-api-key' },
      { ALERT_EMAIL: { send } },
      async () => { throw networkError; },
    )).rejects.toBe(networkError);
    expect(send).not.toHaveBeenCalled();
  });
});
