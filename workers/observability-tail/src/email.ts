import type { AlertConfiguration, AlertEmailMessage } from './core';

export type AlertFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
export type NativeEmailFactory = (
  from: string,
  to: string,
  raw: string,
) => Promise<EmailMessage>;

const MIME_BOUNDARY = 'mercora-observability-alert-v1';

async function defaultNativeEmailFactory(
  from: string,
  to: string,
  raw: string,
): Promise<EmailMessage> {
  const { EmailMessage } = await import('cloudflare:email');
  return new EmailMessage(from, to, raw);
}

export function buildRawEmail(message: AlertEmailMessage): string {
  const lines = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${MIME_BOUNDARY}"`,
    '',
    `--${MIME_BOUNDARY}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    `--${MIME_BOUNDARY}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    `--${MIME_BOUNDARY}--`,
    '',
  ];
  return lines.join('\r\n');
}

function emailBinding(source: unknown): SendEmail | null {
  try {
    if (!source || (typeof source !== 'object' && typeof source !== 'function')) return null;
    const binding = Reflect.get(source, 'ALERT_EMAIL');
    return binding !== null && (typeof binding === 'object' || typeof binding === 'function') &&
      typeof Reflect.get(binding, 'send') === 'function'
      ? binding as SendEmail
      : null;
  } catch {
    return null;
  }
}

async function sendWithCloudflare(
  message: AlertEmailMessage,
  source: unknown,
  nativeEmailFactory: NativeEmailFactory,
): Promise<void> {
  const binding = emailBinding(source);
  if (!binding) throw new Error('Cloudflare Email Sending binding is unavailable');
  const nativeMessage = await nativeEmailFactory(
    message.from,
    message.to,
    buildRawEmail(message),
  );
  await binding.send(nativeMessage);
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The bounded delivery result is intentionally not read or logged.
  }
}

async function sendWithResend(
  message: AlertEmailMessage,
  config: AlertConfiguration,
  fetcher: AlertFetch,
): Promise<void> {
  if (!config.resendApiKey) throw new Error('Resend API key is unavailable');
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  await discardBody(response);
  if (!response.ok) throw new Error('Resend alert delivery failed');
}

export async function sendAlertEmail(
  message: AlertEmailMessage,
  config: AlertConfiguration,
  source: unknown,
  fetcher: AlertFetch = fetch,
  nativeEmailFactory: NativeEmailFactory = defaultNativeEmailFactory,
): Promise<void> {
  if (config.provider === 'cloudflare') {
    await sendWithCloudflare(message, source, nativeEmailFactory);
    return;
  }
  await sendWithResend(message, config, fetcher);
}
