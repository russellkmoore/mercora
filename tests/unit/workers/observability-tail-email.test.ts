import { describe, expect, it, vi } from 'vitest';
import type { AlertConfiguration, AlertEmailMessage } from '@/workers/observability-tail/src/core';
import {
  buildRawEmail,
  sendAlertEmail,
} from '@/workers/observability-tail/src/email';

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
    const nativeMessage = { from: message.from, to: message.to };
    const nativeEmailFactory = vi.fn(async () => nativeMessage);
    await sendAlertEmail(
      message,
      { ...base, provider: 'cloudflare' },
      { ALERT_EMAIL: { send } },
      fetcher,
      nativeEmailFactory,
    );
    expect(send).toHaveBeenCalledWith(nativeMessage);
    expect(nativeEmailFactory).toHaveBeenCalledWith(
      message.from,
      message.to,
      expect.stringContaining(`Subject: ${message.subject}\r\n`),
    );
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
    const nativeEmailFactory = vi.fn(async () => ({ from: message.from, to: message.to }));
    await expect(sendAlertEmail(
      message,
      { ...base, provider: 'cloudflare' },
      { ALERT_EMAIL: { send }, RESEND_API_KEY: 'test-api-key' },
      fetcher,
      nativeEmailFactory,
    )).rejects.toThrow('native delivery failed');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('builds a bounded multipart message for the native provider', () => {
    const raw = buildRawEmail(message);
    expect(raw).toContain('Content-Type: text/plain; charset=UTF-8\r\n');
    expect(raw).toContain('Content-Type: text/html; charset=UTF-8\r\n');
    expect(raw).toContain(message.text);
    expect(raw).toContain(message.html);
    expect(raw).not.toMatch(/\nBcc:/i);
  });

  it('rejects failed Resend responses without reading or logging their body', async () => {
    const cancel = vi.fn(async () => undefined);
    const response = new Response(new ReadableStream({ cancel }), { status: 500 });
    await expect(sendAlertEmail(
      message,
      { ...base, provider: 'resend', resendApiKey: 'test-api-key' },
      {},
      async () => response,
    )).rejects.toThrow('Resend alert delivery failed');
    expect(cancel).toHaveBeenCalledOnce();
  });
});
